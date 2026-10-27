import { fetch } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { cookiesFrom, get, postJson, useTestServer } from './server'

describe('accounts with registration on', async () => {
  const { db } = await useTestServer({ NUXT_PUBLIC_REGISTRATION_ENABLED: 'true' })

  const ada = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'analytical engine' }

  it('registers an account, hashes the password and signs it in', async () => {
    const response = await postJson('/api/auth/register', { ...ada, email: '  Ada@Example.com ' })
    expect(response.status).toBe(201)
    const { user } = await response.json()
    expect(user).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com', isDemo: false, demoExpiresAt: null })
    expect(user).not.toHaveProperty('passwordHash')

    const me = await get('/api/me', cookiesFrom(response))
    expect((await me.json()).user.id).toBe(user.id)

    const row = await db.execute({ sql: 'select password_hash from users where id = ?', args: [user.id] })
    const hash = String(row.rows[0]!.password_hash)
    expect(hash).toMatch(/^\$scrypt\$/)
    expect(hash).not.toContain(ada.password)
  })

  it('rejects a second account with the same email, whatever its case', async () => {
    const response = await postJson('/api/auth/register', { ...ada, email: 'ADA@example.com' })
    expect(response.status).toBe(409)
    expect((await response.json()).data.fieldErrors.email).toEqual(['An account with this email already exists.'])
  })

  it('reports every invalid field', async () => {
    const response = await postJson('/api/auth/register', { name: ' ', email: 'not-an-email', password: 'short' })
    expect(response.status).toBe(400)
    expect((await response.json()).data.fieldErrors).toEqual({
      name: ['Enter your name.'],
      email: ['Enter a valid email address.'],
      password: ['Use at least 8 characters.'],
    })
  })

  it('signs in with the right password only', async () => {
    const ok = await postJson('/api/auth/login', { email: 'ADA@example.com', password: ada.password })
    expect(ok.status).toBe(200)
    expect((await get('/api/me', cookiesFrom(ok))).status).toBe(200)

    const wrongPassword = await postJson('/api/auth/login', { email: ada.email, password: 'difference engine' })
    const unknownEmail = await postJson('/api/auth/login', { email: 'grace@example.com', password: ada.password })
    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    // The same message either way, so the response doesn't reveal which emails have accounts.
    expect((await wrongPassword.json()).message).toBe((await unknownEmail.json()).message)
  })

  // Sessions are sealed cookies with no server-side record, so signing out works by clearing
  // the cookie in the browser.
  it('signs out by clearing the session cookie', async () => {
    const login = await postJson('/api/auth/login', { email: ada.email, password: ada.password })
    const signOut = await fetch('/api/_auth/session', { method: 'DELETE', headers: { cookie: cookiesFrom(login) } })
    expect(signOut.status).toBe(200)
    expect(signOut.headers.getSetCookie().join()).toMatch(/nuxt-session=;/)
    expect((await get('/api/me', cookiesFrom(signOut))).status).toBe(401)
  })

  it('shows the sign-up form', async () => {
    const html = await (await get('/register')).text()
    expect(html).toContain('Create account')
    expect(html).not.toContain('Registration is closed')
  })

  // Last: it uses up this address's sign-in allowance for the rest of the file.
  it('rate-limits sign-in attempts', async () => {
    let response: Response
    do {
      response = await postJson('/api/auth/login', { email: ada.email, password: 'guessing' })
    } while (response.status === 401)

    expect(response.status).toBe(429)
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0)
    // Even the right password is refused until the window ends.
    expect((await postJson('/api/auth/login', { email: ada.email, password: ada.password })).status).toBe(429)
  })
})
