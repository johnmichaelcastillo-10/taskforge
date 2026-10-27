import { describe, expect, it } from 'vitest'
import { get, newDemo, send, useTestServer } from './server'

/* eslint-disable @typescript-eslint/no-explicit-any */
async function json(response: Response): Promise<any> {
  return response.json()
}

describe('work timer', async () => {
  const { db } = await useTestServer({ NUXT_TRUST_PROXY: 'true' })

  async function workspace() {
    const demo = await newDemo()
    const { project } = await json(await send('POST', '/api/projects', demo.cookie, { name: 'Timed' }))
    const task = async (title: string, status = 'todo') =>
      (await json(await send('POST', '/api/tasks', demo.cookie, { projectId: project.id, title, status }))).task
    const running = async () => (await json(await get('/api/timer', demo.cookie))).running
    const runningRows = async () => Number((await db.execute({
      sql: 'select count(*) as n from work_sessions where user_id = ? and ended_at is null',
      args: [demo.userId],
    })).rows[0]!.n)
    return { ...demo, project, task, running, runningRows }
  }

  it('starts, reports and stops a timer, measuring the time itself', async () => {
    const w = await workspace()
    const task = await w.task('Write tests')
    expect(await w.running()).toBeNull()

    const started = await json(await send('POST', '/api/timer/start', w.cookie, { taskId: task.id }))
    expect(started.session).toMatchObject({ taskId: task.id, taskTitle: 'Write tests', projectName: 'Timed', endedAt: null })
    expect((await w.running()).id).toBe(started.session.id)

    // Starting the same task again is harmless.
    const again = await json(await send('POST', '/api/timer/start', w.cookie, { taskId: task.id }))
    expect(again.session.id).toBe(started.session.id)

    // A duration sent by the browser is ignored: the server measures it.
    const stopped = await json(await send('POST', '/api/timer/stop', w.cookie, { durationSeconds: 99_999 }))
    expect(stopped.session.endedAt).not.toBeNull()
    expect(stopped.session.durationSeconds).toBeLessThan(10)
    expect(await w.running()).toBeNull()

    expect((await send('POST', '/api/timer/stop', w.cookie)).status).toBe(409)
  })

  it('refuses a second timer unless asked to switch', async () => {
    const w = await workspace()
    const first = await w.task('First')
    const second = await w.task('Second')
    await send('POST', '/api/timer/start', w.cookie, { taskId: first.id })

    const refused = await send('POST', '/api/timer/start', w.cookie, { taskId: second.id })
    expect(refused.status).toBe(409)
    expect((await json(refused)).data.running.taskId).toBe(first.id)

    const switched = await json(await send('POST', '/api/timer/start', w.cookie, { taskId: second.id, switch: true }))
    expect(switched.session.taskId).toBe(second.id)
    expect(switched.stopped).toMatchObject({ taskId: first.id })
    expect(switched.stopped.endedAt).toBe(switched.session.startedAt) // no gap, no overlap
    expect(await w.runningRows()).toBe(1)
  })

  it('keeps one running timer even when starts arrive together', async () => {
    const w = await workspace()
    const tasks = await Promise.all(['A', 'B', 'C', 'D', 'E'].map(title => w.task(title)))
    const responses = await Promise.all(tasks.map(task => send('POST', '/api/timer/start', w.cookie, { taskId: task.id })))
    const statuses = responses.map(response => response.status).sort()
    expect(statuses).toEqual([200, 409, 409, 409, 409])
    expect(await w.runningRows()).toBe(1)
  })

  it('doesn’t time finished tasks, and stops when a task is completed or its project archived', async () => {
    const w = await workspace()
    const done = await w.task('Done already', 'done')
    expect((await send('POST', '/api/timer/start', w.cookie, { taskId: done.id })).status).toBe(409)

    const task = await w.task('Finish me')
    await send('POST', '/api/timer/start', w.cookie, { taskId: task.id })
    await send('POST', `/api/tasks/${task.id}/move`, w.cookie, { status: 'done', position: 0 })
    expect(await w.running()).toBeNull()

    const other = await w.task('Archive me')
    await send('POST', '/api/timer/start', w.cookie, { taskId: other.id })
    await send('PATCH', `/api/projects/${w.project.id}`, w.cookie, { archived: true })
    expect(await w.running()).toBeNull()
    expect(await w.runningRows()).toBe(0)
  })

  it('totals sessions on the task, lists them and deletes one', async () => {
    const w = await workspace()
    const task = await w.task('Measured')
    // Two finished sessions: 30 and 45 minutes.
    await db.execute({
      sql: `insert into work_sessions (user_id, task_id, started_at, ended_at) values
        (?1, ?2, unixepoch() - 7200, unixepoch() - 5400), (?1, ?2, unixepoch() - 3600, unixepoch() - 900)`,
      args: [w.userId, task.id],
    })
    expect((await json(await get(`/api/tasks/${task.id}`, w.cookie))).task.trackedSeconds).toBe(4500)

    const { sessions } = await json(await get(`/api/sessions?taskId=${task.id}`, w.cookie))
    expect(sessions.map((s: any) => s.durationSeconds)).toEqual([2700, 1800])

    expect((await send('DELETE', `/api/sessions/${sessions[0].id}`, w.cookie)).status).toBe(204)
    expect((await json(await get(`/api/tasks/${task.id}`, w.cookie))).task.trackedSeconds).toBe(1800)
  })

  it('keeps timers and sessions private', async () => {
    const alice = await workspace()
    const bob = await workspace()
    const task = await alice.task('Alice works')
    const { session } = await json(await send('POST', '/api/timer/start', alice.cookie, { taskId: task.id }))

    expect((await send('POST', '/api/timer/start', bob.cookie, { taskId: task.id })).status).toBe(404)
    expect((await get(`/api/sessions?taskId=${task.id}`, bob.cookie)).status).toBe(404)
    expect((await send('DELETE', `/api/sessions/${session.id}`, bob.cookie)).status).toBe(404)
    expect(await bob.running()).toBeNull()
    expect((await send('POST', '/api/timer/stop', bob.cookie)).status).toBe(409)
    expect((await alice.running()).id).toBe(session.id)
  })

  it('seeds the demo with past sessions and no running timer', async () => {
    const { cookie } = await newDemo('America/New_York')
    const { sessions } = await json(await get('/api/sessions?limit=200', cookie))
    expect(sessions.length).toBeGreaterThan(10)
    expect(sessions.every((s: any) => s.endedAt && Date.parse(s.endedAt) <= Date.now())).toBe(true)
    expect((await json(await get('/api/timer', cookie))).running).toBeNull()
  })
})
