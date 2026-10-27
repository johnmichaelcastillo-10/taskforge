import { describe, expect, it } from 'vitest'
import { cookiesFrom, get, postJson, send, useTestServer } from './server'

/* eslint-disable @typescript-eslint/no-explicit-any */
async function json(response: Response): Promise<any> {
  return response.json()
}

// Seconds since the epoch for an ISO time, for writing rows at exact moments.
const at = (iso: string) => Math.floor(Date.parse(iso) / 1000)

describe('analytics and the dashboard', async () => {
  // Registered accounts start empty (demos are seeded), so every figure here is known.
  const { db } = await useTestServer({ NUXT_PUBLIC_REGISTRATION_ENABLED: 'true', NUXT_TRUST_PROXY: 'true' })

  let accounts = 0
  async function account(timezone: string) {
    accounts += 1
    const response = await postJson('/api/auth/register', {
      name: 'Analyst',
      email: `analyst${accounts}@example.com`,
      password: 'long enough password',
      timezone,
    })
    expect(response.status).toBe(201)
    const { user } = await json(response)
    return { cookie: cookiesFrom(response), userId: user.id as number }
  }

  it('counts work by the user’s calendar day, not UTC', async () => {
    // Manila is UTC+8 all year.
    const { cookie, userId } = await account('Asia/Manila')
    const { project } = await json(await send('POST', '/api/projects', cookie, { name: 'Numbers' }))
    const create = async (title: string, estimateMinutes?: number) =>
      (await json(await send('POST', '/api/tasks', cookie, { projectId: project.id, title, estimateMinutes }))).task

    const early = await create('Done late on the 4th, UTC', 60)
    const late = await create('Done on the 6th', 30)
    await create('Still open')

    // 17:30 UTC on Mar 4 is 01:30 on Mar 5 in Manila.
    await db.execute({ sql: `update tasks set status = 'done', completed_at = ? where id = ?`, args: [at('2026-03-04T17:30:00Z'), early.id] })
    await db.execute({ sql: `update tasks set status = 'done', completed_at = ? where id = ?`, args: [at('2026-03-06T02:00:00Z'), late.id] })
    // 90 minutes on the first task (on Mar 3 local), 15 on the second (on Mar 5 local).
    await db.execute({
      sql: `insert into work_sessions (user_id, task_id, started_at, ended_at) values (?, ?, ?, ?), (?, ?, ?, ?)`,
      args: [userId, early.id, at('2026-03-03T01:00:00Z'), at('2026-03-03T02:30:00Z'), userId, late.id, at('2026-03-05T03:00:00Z'), at('2026-03-05T03:15:00Z')],
    })

    const data = await json(await get('/api/analytics?from=2026-03-03&to=2026-03-09', cookie))
    expect(data.days).toEqual(['2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09'])
    expect(data.completedPerDay).toEqual([0, 0, 1, 1, 0, 0, 0])
    expect(data.trackedPerDay).toEqual([5400, 0, 900, 0, 0, 0, 0])
    // Mar 3 2026 is a Tuesday: its week started on Monday the 2nd; the 9th starts the next.
    expect(data.trackedPerWeek).toEqual([{ weekStart: '2026-03-02', total: 6300 }, { weekStart: '2026-03-09', total: 0 }])
    expect(data.estimateVsActual).toEqual([
      { projectId: project.id, projectName: 'Numbers', taskCount: 2, estimatedSeconds: 5400, trackedSeconds: 6300 },
    ])
    expect(data.statusCounts).toEqual({ backlog: 1, todo: 0, in_progress: 0, done: 2 })
    expect(data.projectProgress).toEqual([{ projectId: project.id, name: 'Numbers', percents: [0, 0, 33, 67, 67, 67, 67] }])
    expect(data.totals).toEqual({ completed: 2, trackedSeconds: 6300 })

    // The same instant, seen from UTC, falls on the 4th.
    const utc = await account('UTC')
    const { project: utcProject } = await json(await send('POST', '/api/projects', utc.cookie, { name: 'UTC' }))
    const { task } = await json(await send('POST', '/api/tasks', utc.cookie, { projectId: utcProject.id, title: 'Same moment' }))
    await db.execute({ sql: `update tasks set status = 'done', completed_at = ? where id = ?`, args: [at('2026-03-04T17:30:00Z'), task.id] })
    const utcData = await json(await get('/api/analytics?from=2026-03-03&to=2026-03-05', utc.cookie))
    expect(utcData.completedPerDay).toEqual([0, 1, 0])
  })

  it('validates the date range', async () => {
    const { cookie } = await account('UTC')
    for (const query of ['from=2026-03-09&to=2026-03-01', 'from=2025-01-01&to=2026-03-01', 'from=yesterday&to=2026-03-01', '']) {
      expect((await get(`/api/analytics?${query}`, cookie)).status).toBe(400)
    }
    expect((await get('/api/analytics?from=2026-01-01&to=2026-03-01')).status).toBe(401)
  })

  it('builds the dashboard from the database', async () => {
    const { cookie } = await account('UTC')
    const empty = await json(await get('/api/dashboard', cookie))
    expect(empty).toMatchObject({ activeProjectCount: 0, completedCount: 0, trackedSeconds: 0, overdueCount: 0, upcoming: [], overdue: [] })
    expect(empty.weeklyCompleted).toHaveLength(8)

    const today = empty.today as string
    const shift = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
    const { project } = await json(await send('POST', '/api/projects', cookie, { name: 'Due soon', deadline: shift(5), status: 'in_progress' }))
    const create = (title: string, dueDate: string | null, status = 'todo') =>
      send('POST', '/api/tasks', cookie, { projectId: project.id, title, dueDate, status })
    await create('Late', shift(-2))
    await create('Late but done', shift(-2), 'done')
    await create('Soon', shift(3))
    await create('Far off', shift(40))

    const data = await json(await get('/api/dashboard?days=30', cookie))
    expect(data).toMatchObject({ activeProjectCount: 1, completedCount: 1, overdueCount: 1 })
    expect(data.overdue.map((t: any) => t.title)).toEqual(['Late'])
    expect(data.upcoming.map((item: any) => [item.kind, item.title])).toEqual([['task', 'Soon'], ['project', 'Due soon']])
    expect(data.weeklyCompleted.at(-1).total).toBe(1)
    expect((await get('/api/dashboard?days=12', cookie)).status).toBe(400)
  })

  it('renders the dashboard and analytics pages', async () => {
    const { cookie } = await account('UTC')
    const dashboard = await (await get('/dashboard', cookie)).text()
    expect(dashboard).toContain('Needs attention')
    expect(dashboard).toContain('Nothing overdue, and nothing due in the next two weeks.')
    expect(dashboard).toContain('No active projects')
    const analytics = await (await get('/analytics', cookie)).text()
    expect(analytics).toContain('Tasks completed per day')
    expect(analytics).toContain('No tasks were completed in this period.')
  })
})
