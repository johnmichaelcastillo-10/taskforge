import { fetch } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { cookiesFrom, get, postJson, useTestServer } from './server'

// Registration is off by default, as on the hosted demo.
describe('demo access', async () => {
  const { db } = await useTestServer()

  async function startDemo(cookie?: string) {
    const response = await postJson('/api/auth/demo', {}, cookie)
    return { response, cookie: cookiesFrom(response), body: await response.json() }
  }

  async function countUsers() {
    const result = await db.execute('select count(*) as n from users')
    return Number(result.rows[0]!.n)
  }

  it('turns guests away from the API and the app pages', async () => {
    expect((await get('/api/me')).status).toBe(401)

    const page = await get('/dashboard')
    expect(page.status).toBe(302)
    expect(page.headers.get('location')).toBe('/login?redirect=/dashboard')
  })

  it('creates a private demo account and signs it in', async () => {
    const before = Date.now()
    const demo = await startDemo()
    const after = Date.now()

    expect(demo.response.status).toBe(201)
    expect(demo.body.user).toMatchObject({ name: 'Demo user', email: null, isDemo: true })
    // Expires demoTtlHours (72) after the request, stored in whole seconds (so up to 1 s early).
    const ttl = 72 * 3_600_000
    expect(demo.body.user.demoExpiresAt).toBeGreaterThanOrEqual(before + ttl - 1000)
    expect(demo.body.user.demoExpiresAt).toBeLessThanOrEqual(after + ttl)

    const me = await get('/api/me', demo.cookie)
    expect(me.status).toBe(200)
    expect((await me.json()).user.id).toBe(demo.body.user.id)

    const row = await db.execute({ sql: 'select is_demo, email, password_hash from users where id = ?', args: [demo.body.user.id] })
    expect(row.rows[0]).toMatchObject({ is_demo: 1, email: null, password_hash: null })
  })

  it('renders the app shell for the demo account', async () => {
    const { cookie } = await startDemo()
    const page = await get('/dashboard', cookie)
    expect(page.status).toBe(200)
    const html = await page.text()
    expect(html).toContain('Welcome, Demo user')
    expect(html).toContain('Demo workspace')
  })

  it('gives a visitor with a live demo the same demo again', async () => {
    const first = await startDemo()
    const usersBefore = await countUsers()

    const again = await startDemo(first.cookie)
    expect(again.response.status).toBe(200)
    expect(again.body.user.id).toBe(first.body.user.id)
    expect(await countUsers()).toBe(usersBefore)
  })

  it('signs out an expired demo, and deletes it when the next demo starts', async () => {
    const demo = await startDemo()
    await db.execute({ sql: 'update users set demo_expires_at = unixepoch() - 1 where id = ?', args: [demo.body.user.id] })

    expect((await get('/api/me', demo.cookie)).status).toBe(401)
    const session = await (await get('/api/_auth/session', demo.cookie)).json()
    expect(session.user).toBeUndefined()
    expect((await get('/dashboard', demo.cookie)).status).toBe(302)

    await startDemo()
    const row = await db.execute({ sql: 'select id from users where id = ?', args: [demo.body.user.id] })
    expect(row.rows).toHaveLength(0)
  })

  it('refuses registration while it is switched off', async () => {
    const response = await postJson('/api/auth/register', { name: 'Ada', email: 'ada@example.com', password: 'correct horse' })
    expect(response.status).toBe(403)
    expect(await countUsers()).toBeGreaterThan(0)
    const row = await db.execute(`select id from users where email = 'ada@example.com'`)
    expect(row.rows).toHaveLength(0)
  })

  it('shows the demo button to guests and hides sign-up', async () => {
    const home = await (await get('/')).text()
    expect(home).toContain('Try the demo')

    const register = await (await get('/register')).text()
    expect(register).toContain('Registration is closed')
  })

  // Last: it uses up this address's demo allowance (10 an hour) for the rest of the file.
  it('rate-limits demo creation', async () => {
    let response: Response
    do {
      response = await postJson('/api/auth/demo')
    } while (response.status === 201)

    expect(response.status).toBe(429)
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0)
    const row = await db.execute(`select count from rate_limits where key like 'demo:%'`)
    expect(Number(row.rows[0]!.count)).toBe(11)

    // NUXT_TRUST_PROXY is off here, so a forged X-Forwarded-For doesn't buy a new allowance.
    const forged = await fetch('/api/auth/demo', { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.9' } })
    expect(forged.status).toBe(429)
  })
})
