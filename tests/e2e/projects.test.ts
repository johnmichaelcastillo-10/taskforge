import { describe, expect, it } from 'vitest'
import { get, newDemo, send, useTestServer } from './server'

describe('projects', async () => {
  const { db } = await useTestServer({ NUXT_TRUST_PROXY: 'true' })

  async function json(response: Response) {
    return response.json() as Promise<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  it('seeds a new demo with sample projects', async () => {
    const { cookie } = await newDemo('Asia/Manila')
    const active = await json(await get('/api/projects', cookie))
    const archived = await json(await get('/api/projects?archived=true', cookie))
    expect(active.projects.map((p: { name: string }) => p.name)).toContain('Portfolio site redesign')
    expect(active.projects).toHaveLength(4)
    expect(archived.projects).toHaveLength(1)
    expect(archived.projects[0].archivedAt).not.toBeNull()
  })

  it('creates, reads, edits and filters projects', async () => {
    const { cookie } = await newDemo()
    const created = await send('POST', '/api/projects', cookie, {
      name: '  Search 100%_done  ',
      priority: 'high',
      startDate: '2026-01-10',
      deadline: '2026-02-01',
    })
    expect(created.status).toBe(201)
    const { project } = await json(created)
    expect(project).toMatchObject({ name: 'Search 100%_done', status: 'planning', priority: 'high', description: '', archivedAt: null })

    expect((await json(await get(`/api/projects/${project.id}`, cookie))).project.id).toBe(project.id)

    const edited = await json(await send('PATCH', `/api/projects/${project.id}`, cookie, { status: 'in_progress', description: 'Notes' }))
    expect(edited.project).toMatchObject({ status: 'in_progress', description: 'Notes', name: 'Search 100%_done' })

    // % and _ are matched literally, not as wildcards.
    const byName = await json(await get('/api/projects?q=100%25_', cookie))
    expect(byName.projects.map((p: { id: number }) => p.id)).toEqual([project.id])
    expect((await json(await get('/api/projects?q=1000', cookie))).projects).toHaveLength(0)

    const inProgress = await json(await get('/api/projects?status=in_progress', cookie))
    expect(inProgress.projects.every((p: { status: string }) => p.status === 'in_progress')).toBe(true)
    expect(inProgress.projects.map((p: { id: number }) => p.id)).toContain(project.id)
  })

  it('rejects invalid input with field messages', async () => {
    const { cookie } = await newDemo()
    const bad = await send('POST', '/api/projects', cookie, { name: '', status: 'done', startDate: '2026-02-01', deadline: '2026-01-01' })
    expect(bad.status).toBe(400)
    const { data } = await json(bad)
    expect(Object.keys(data.fieldErrors).sort()).toEqual(['name', 'status'])

    const reversed = await send('POST', '/api/projects', cookie, { name: 'Dates', startDate: '2026-02-01', deadline: '2026-01-01' })
    expect(reversed.status).toBe(400)
    expect((await json(reversed)).data.fieldErrors.deadline).toEqual(['The deadline can’t be before the start date.'])

    // A deadline sent alone is checked against the stored start date.
    const { project } = await json(await send('POST', '/api/projects', cookie, { name: 'Dates', startDate: '2026-02-01' }))
    const early = await send('PATCH', `/api/projects/${project.id}`, cookie, { deadline: '2026-01-15' })
    expect(early.status).toBe(400)
    expect((await json(early)).data.fieldErrors.deadline).toHaveLength(1)
  })

  it('makes archived projects read-only until restored', async () => {
    const { cookie } = await newDemo()
    const { project } = await json(await send('POST', '/api/projects', cookie, { name: 'Old work' }))

    const archived = await json(await send('PATCH', `/api/projects/${project.id}`, cookie, { archived: true }))
    expect(archived.project.archivedAt).not.toBeNull()
    expect((await json(await get('/api/projects', cookie))).projects.map((p: { id: number }) => p.id)).not.toContain(project.id)

    const edit = await send('PATCH', `/api/projects/${project.id}`, cookie, { name: 'Renamed' })
    expect(edit.status).toBe(409)

    const restored = await json(await send('PATCH', `/api/projects/${project.id}`, cookie, { archived: false }))
    expect(restored.project).toMatchObject({ archivedAt: null, name: 'Old work' })
    expect((await send('PATCH', `/api/projects/${project.id}`, cookie, { name: 'Renamed' })).status).toBe(200)
  })

  it('records activity for each change', async () => {
    const { cookie } = await newDemo()
    const { project } = await json(await send('POST', '/api/projects', cookie, { name: 'Tracked' }))
    await send('PATCH', `/api/projects/${project.id}`, cookie, { status: 'completed' })
    await send('PATCH', `/api/projects/${project.id}`, cookie, { archived: true })
    await send('PATCH', `/api/projects/${project.id}`, cookie, { archived: false })

    const { activity } = await json(await get(`/api/activity?projectId=${project.id}`, cookie))
    expect(activity.map((entry: { action: string }) => entry.action)).toEqual([
      'project.restored',
      'project.archived',
      'project.status',
      'project.created',
    ])
    expect(activity[2].detail).toEqual({ from: 'planning', to: 'completed' })

    expect((await send('DELETE', `/api/projects/${project.id}`, cookie)).status).toBe(204)
    const feed = await json(await get('/api/activity', cookie))
    expect(feed.activity[0]).toMatchObject({ action: 'project.deleted', subject: 'Tracked', projectId: null })
  })

  it('keeps each user’s projects private', async () => {
    const alice = await newDemo()
    const bob = await newDemo()
    const { project } = await json(await send('POST', '/api/projects', alice.cookie, { name: 'Alice only' }))

    // Someone else's project is indistinguishable from a missing one.
    for (const response of [
      await get(`/api/projects/${project.id}`, bob.cookie),
      await send('PATCH', `/api/projects/${project.id}`, bob.cookie, { name: 'Taken' }),
      await send('DELETE', `/api/projects/${project.id}`, bob.cookie),
      await get(`/api/activity?projectId=${project.id}`, bob.cookie),
      await get('/api/projects/999999', bob.cookie),
    ]) {
      expect(response.status).toBe(404)
    }
    const bobs = await json(await get('/api/projects', bob.cookie))
    expect(bobs.projects.map((p: { name: string }) => p.name)).not.toContain('Alice only')
    expect((await json(await get(`/api/projects/${project.id}`, alice.cookie))).project.name).toBe('Alice only')

    expect((await get('/api/projects')).status).toBe(401)
  })

  it('deletes a demo’s projects and activity with the account', async () => {
    const demo = await newDemo()
    await db.execute({ sql: 'update users set demo_expires_at = unixepoch() - 1 where id = ?', args: [demo.userId] })
    await newDemo() // starting a demo clears expired ones

    for (const table of ['projects where owner_id', 'activity_logs where user_id']) {
      const result = await db.execute({ sql: `select count(*) as n from ${table} = ?`, args: [demo.userId] })
      expect(Number(result.rows[0]!.n)).toBe(0)
    }
  })

  it('renders the project pages', async () => {
    const { cookie } = await newDemo()
    const list = await (await get('/projects', cookie)).text()
    expect(list).toContain('Portfolio site redesign')

    const { projects } = await json(await get('/api/projects', cookie))
    const page = await get(`/projects/${projects[0].id}`, cookie)
    expect(page.status).toBe(200)
    expect(await page.text()).toContain(projects[0].name)

    expect((await get('/projects/999999', cookie)).status).toBe(404)
  })
})
