import { fetch } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { get, newDemo, send, useTestServer } from './server'

/* eslint-disable @typescript-eslint/no-explicit-any */
async function json(response: Response): Promise<any> {
  return response.json()
}

describe('REST API and tokens', async () => {
  const { db } = await useTestServer({ NUXT_TRUST_PROXY: 'true' })

  /** A demo user with an API token, and a client that sends it. */
  async function apiUser() {
    const demo = await newDemo()
    const created = await send('POST', '/api/tokens', demo.cookie, { name: 'Test script' })
    expect(created.status).toBe(201)
    const { token, secret } = await json(created)
    const api = (method: string, path: string, body?: unknown) => fetch(`/api/v1${path}`, {
      method,
      headers: { 'authorization': `Bearer ${secret}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { ...demo, token, secret, api }
  }

  it('creates tokens, shows each secret once and stores only a hash', async () => {
    const user = await apiUser()
    expect(user.secret).toMatch(/^tf_[\w-]{43}$/)
    expect(user.token).toMatchObject({ name: 'Test script', prefix: user.secret.slice(0, 10), lastUsedAt: null })
    expect(user.token).not.toHaveProperty('tokenHash')

    const { tokens } = await json(await get('/api/tokens', user.cookie))
    expect(JSON.stringify(tokens)).not.toContain(user.secret)
    const stored = await db.execute({ sql: 'select token_hash from api_tokens where id = ?', args: [user.token.id] })
    expect(String(stored.rows[0]!.token_hash)).toMatch(/^[0-9a-f]{64}$/)
    expect(String(stored.rows[0]!.token_hash)).not.toContain(user.secret)
  })

  it('answers with the token’s account and records its use', async () => {
    const user = await apiUser()
    const me = await json(await user.api('GET', '/me'))
    expect(me.user).toMatchObject({ id: user.userId, name: 'Demo user' })
    const { tokens } = await json(await get('/api/tokens', user.cookie))
    expect(tokens[0].lastUsedAt).not.toBeNull()
  })

  it('rejects missing, malformed, unknown and revoked tokens, and session cookies', async () => {
    const user = await apiUser()
    const attempts = [
      fetch('/api/v1/projects'),
      fetch('/api/v1/projects', { headers: { authorization: 'Basic abc' } }),
      fetch('/api/v1/projects', { headers: { authorization: 'Bearer tf_not-a-real-token' } }),
      // The app's session cookie doesn't open the API.
      fetch('/api/v1/projects', { headers: { cookie: user.cookie } }),
    ]
    for (const response of await Promise.all(attempts)) {
      expect(response.status).toBe(401)
      expect(response.headers.get('www-authenticate')).toBe('Bearer realm="taskforge"')
    }

    expect((await send('DELETE', `/api/tokens/${user.token.id}`, user.cookie)).status).toBe(204)
    expect((await user.api('GET', '/projects')).status).toBe(401)

    // And a token doesn't open the app's own routes.
    expect((await fetch('/api/projects', { headers: { authorization: `Bearer ${user.secret}` } })).status).toBe(401)
  })

  it('manages projects, tasks and the timer', async () => {
    const user = await apiUser()
    const created = await user.api('POST', '/projects', { name: 'From the API', priority: 'high' })
    expect(created.status).toBe(201)
    const { project } = await json(created)

    const taskResponse = await user.api('POST', '/tasks', { projectId: project.id, title: 'Scripted task', status: 'todo' })
    expect(taskResponse.status).toBe(201)
    const { task } = await json(taskResponse)

    const listed = await json(await user.api('GET', `/projects/${project.id}/tasks`))
    expect(listed.tasks.map((t: any) => t.title)).toEqual(['Scripted task'])

    const started = await json(await user.api('POST', '/timer/start', { taskId: task.id }))
    expect(started.session.taskId).toBe(task.id)
    expect((await json(await user.api('GET', '/timer'))).running.taskId).toBe(task.id)

    const moved = await json(await user.api('POST', `/tasks/${task.id}/move`, { status: 'done', position: 0 }))
    expect(moved.task.completedAt).not.toBeNull()
    expect((await json(await user.api('GET', '/timer'))).running).toBeNull()

    const patched = await json(await user.api('PATCH', `/tasks/${task.id}`, { title: 'Renamed by script' }))
    expect(patched.task.title).toBe('Renamed by script')

    expect((await user.api('PATCH', `/projects/${project.id}`, { archived: true })).status).toBe(200)
    expect((await user.api('PATCH', `/tasks/${task.id}`, { title: 'Too late' })).status).toBe(409)
    expect((await user.api('DELETE', `/projects/${project.id}`)).status).toBe(204)
    expect((await user.api('GET', `/projects/${project.id}`)).status).toBe(404)
  })

  it('validates input and returns field errors', async () => {
    const user = await apiUser()
    const bad = await user.api('POST', '/projects', { name: '', priority: 'urgent' })
    expect(bad.status).toBe(400)
    const body = await json(bad)
    expect(body.message).toBe('Check the highlighted fields.')
    expect(Object.keys(body.data.fieldErrors).sort()).toEqual(['name', 'priority'])
    expect((await user.api('GET', '/tasks?priority=urgent')).status).toBe(400)
  })

  it('keeps each token to its own account’s data', async () => {
    const alice = await apiUser()
    const bob = await apiUser()
    const { project } = await json(await alice.api('POST', '/projects', { name: 'Alice’s' }))
    const { task } = await json(await alice.api('POST', '/tasks', { projectId: project.id, title: 'Hers' }))

    for (const response of [
      await bob.api('GET', `/projects/${project.id}`),
      await bob.api('GET', `/projects/${project.id}/tasks`),
      await bob.api('PATCH', `/projects/${project.id}`, { name: 'Mine' }),
      await bob.api('DELETE', `/projects/${project.id}`),
      await bob.api('GET', `/tasks/${task.id}`),
      await bob.api('POST', `/tasks/${task.id}/move`, { status: 'done', position: 0 }),
      await bob.api('POST', '/tasks', { projectId: project.id, title: 'Sneaky' }),
      await bob.api('POST', '/timer/start', { taskId: task.id }),
    ]) {
      expect(response.status).toBe(404)
    }
    expect((await json(await bob.api('GET', '/tasks'))).tasks.map((t: any) => t.id)).not.toContain(task.id)
  })

  it('stops working when the account is gone', async () => {
    const user = await apiUser()
    await db.execute({ sql: 'update users set demo_expires_at = unixepoch() - 1 where id = ?', args: [user.userId] })
    expect((await user.api('GET', '/me')).status).toBe(401)
  })

  it('limits tokens per account', async () => {
    const { cookie } = await newDemo()
    for (let i = 0; i < 10; i++) {
      expect((await send('POST', '/api/tokens', cookie, { name: `Token ${i}` })).status).toBe(201)
    }
    expect((await send('POST', '/api/tokens', cookie, { name: 'One too many' })).status).toBe(409)
  })

  it('rate-limits each token', async () => {
    const user = await apiUser()
    const statuses: number[] = []
    for (let i = 0; i < 121; i++) {
      statuses.push((await user.api('GET', '/me')).status)
    }
    expect(statuses.slice(0, 120).every(status => status === 200)).toBe(true)
    expect(statuses[120]).toBe(429)
    // Another token has its own allowance.
    const other = await apiUser()
    expect((await other.api('GET', '/me')).status).toBe(200)
  })

  it('updates and deletes the signed-in account', async () => {
    const { cookie } = await newDemo()
    const updated = await send('PATCH', '/api/me', cookie, { name: 'Renamed', timezone: 'Europe/Berlin' })
    expect(updated.status).toBe(200)
    expect((await json(updated)).user).toMatchObject({ name: 'Renamed', timezone: 'Europe/Berlin' })
    expect((await send('PATCH', '/api/me', cookie, { timezone: 'Mars/Olympus' })).status).toBe(400)

    expect((await send('DELETE', '/api/me', cookie)).status).toBe(204)
    expect((await get('/api/me', cookie)).status).toBe(401)
  })
})
