import { fetch } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { get, newDemo, send, useTestServer } from './server'

describe('hardening', async () => {
  const { db } = await useTestServer({ NUXT_TRUST_PROXY: 'true' })

  it('sends a strict Content Security Policy whose nonce matches the page’s scripts', async () => {
    const response = await get('/')
    const csp = response.headers.get('content-security-policy') ?? ''
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1]
    expect(nonce).toBeTruthy()
    for (const directive of ['default-src \'self\'', 'object-src \'none\'', 'base-uri \'none\'', 'frame-ancestors \'none\'', 'connect-src \'self\'', '\'strict-dynamic\'']) {
      expect(csp).toContain(directive)
    }

    // Every inline script carries this response's nonce (scripts loaded by URL don't need one).
    const html = await response.text()
    const inlineScripts = [...html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>/g)].map(match => match[1]!)
    expect(inlineScripts.length).toBeGreaterThan(0)
    for (const attributes of inlineScripts) {
      expect(attributes).toContain(`nonce="${nonce}"`)
    }

    // A fresh nonce per response.
    const again = (await get('/')).headers.get('content-security-policy')
    expect(/'nonce-([^']+)'/.exec(again ?? '')?.[1]).not.toBe(nonce)
  })

  it('compresses pages for browsers that accept it', async () => {
    const brotli = await fetch('/', { headers: { 'accept-encoding': 'br, gzip' } })
    expect(brotli.headers.get('content-encoding')).toBe('br')
    expect(brotli.headers.get('vary')).toContain('Accept-Encoding')
    expect(await brotli.text()).toContain('Try the demo')

    const gzip = await fetch('/', { headers: { 'accept-encoding': 'gzip' } })
    expect(gzip.headers.get('content-encoding')).toBe('gzip')
  })

  it('sends the other security headers', async () => {
    const headers = (await get('/login')).headers
    expect(headers.get('x-frame-options')).toBe('DENY')
    expect(headers.get('x-content-type-options')).toBe('nosniff')
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(headers.get('strict-transport-security')).toContain('max-age=')
    expect(headers.get('x-powered-by')).toBeNull()
  })

  it('sets the session cookie HttpOnly, Secure and SameSite=Lax', async () => {
    const response = await fetch('/api/auth/demo', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.250' },
      body: '{}',
    })
    const cookie = response.headers.getSetCookie().find(value => value.startsWith('nuxt-session='))!
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/Secure/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).toMatch(/Path=\//)
  })

  it('rejects malformed and oversized requests', async () => {
    const { cookie } = await newDemo()
    const malformed = await fetch('/api/projects', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{"name":' })
    expect(malformed.status).toBe(400)

    const huge = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'Big', description: 'x'.repeat(3_000_000) }),
    })
    expect(huge.status).toBe(413)

    // Over the field limits, though under the size limit.
    expect((await send('POST', '/api/projects', cookie, { name: 'n'.repeat(101) })).status).toBe(400)
    expect((await send('POST', '/api/tasks/1/move', cookie, { status: 'todo', position: -1 })).status).toBe(400)

    for (const path of ['/api/projects/abc', '/api/projects/0', '/api/projects/1.5', '/api/projects/99999999999999999999']) {
      expect((await get(path, cookie)).status).toBe(404)
    }
    expect((await get('/api/not-a-route', cookie)).status).toBe(404)
  })

  it('doesn’t reveal internals in error responses', async () => {
    const { cookie } = await newDemo()
    const body = await (await get('/api/projects/abc', cookie)).json()
    expect(JSON.stringify(body)).not.toMatch(/stack|node_modules|\.ts:|sqlite/i)
  })

  /** The query plan SQLite chooses, as one string. */
  async function plan(sql: string, args: (string | number)[] = []) {
    const rows = await db.execute({ sql: `explain query plan ${sql}`, args })
    return rows.rows.map(row => String(row.detail)).join(' | ')
  }

  it('answers its frequent queries from indexes', async () => {
    // The board: one project's column, in order.
    expect(await plan('select id from tasks where project_id = ? and status = ? order by position', [1, 'todo']))
      .toMatch(/USING (COVERING )?INDEX tasks_board_idx/)
    // The running timer (the partial unique index).
    expect(await plan('select id from work_sessions where user_id = ? and ended_at is null', [1]))
      .toContain('work_sessions_running_idx')
    // Time tracked per day.
    expect(await plan('select sum(ended_at - started_at) from work_sessions where user_id = ? and started_at >= ? and started_at < ?', [1, 0, 1]))
      .toContain('work_sessions_user_idx')
    // A task's sessions, comments and tags (the subqueries on every card).
    expect(await plan('select count(*) from work_sessions where task_id = ?', [1])).toContain('work_sessions_task_idx')
    expect(await plan('select count(*) from task_comments where task_id = ?', [1])).toContain('task_comments_task_idx')
    expect(await plan('select tag_id from task_tags where task_id = ?', [1])).toMatch(/USING (COVERING |PRIMARY KEY|INDEX sqlite_autoindex)/)
    // The activity feed, the projects list and expired-demo cleanup.
    expect(await plan('select id from activity_logs where user_id = ? order by created_at desc limit 20', [1]))
      .toContain('activity_user_idx')
    expect(await plan('select id from projects where owner_id = ? and archived_at is null', [1])).toContain('projects_owner_idx')
    expect(await plan('delete from users where is_demo = 1 and demo_expires_at <= ?', [1])).toContain('users_demo_expires_at_idx')
    // Signing in, and API tokens.
    expect(await plan('select id from users where email = ?', ['a@b.c'])).toContain('users_email_unique')
    expect(await plan('select id from api_tokens where token_hash = ?', ['x'])).toContain('api_tokens_token_hash_unique')
  })
})
