import { describe, expect, it } from 'vitest'
import { get, newDemo, send, useTestServer } from './server'

/* eslint-disable @typescript-eslint/no-explicit-any */
async function json(response: Response): Promise<any> {
  return response.json()
}

describe('tasks, tags and comments', async () => {
  const { db } = await useTestServer({ NUXT_TRUST_PROXY: 'true' })

  /** A demo user with one empty project of their own. */
  async function workspace() {
    const demo = await newDemo()
    const { project } = await json(await send('POST', '/api/projects', demo.cookie, { name: 'Board test' }))
    const create = async (body: Record<string, unknown>) =>
      (await json(await send('POST', '/api/tasks', demo.cookie, { projectId: project.id, ...body }))).task
    const column = async (status: string) => (await json(await get(`/api/tasks?projectId=${project.id}&status=${status}`, demo.cookie)))
      .tasks.map((task: { title: string }) => task.title)
    return { ...demo, project, create, column }
  }

  it('seeds the demo with tasks, tags and comments', async () => {
    const { cookie } = await newDemo()
    const { tasks } = await json(await get('/api/tasks', cookie))
    const { tags } = await json(await get('/api/tags', cookie))
    expect(tasks.length).toBeGreaterThan(20)
    expect(tags.map((tag: { name: string }) => tag.name)).toContain('frontend')
    expect(tasks.filter((t: any) => t.status === 'done').every((t: any) => t.completedAt)).toBe(true)
    expect(tasks.filter((t: any) => t.status !== 'done').every((t: any) => t.completedAt === null)).toBe(true)
    expect(tasks.some((t: any) => t.commentCount > 0 && t.tagIds.length > 0)).toBe(true)

    const { projects } = await json(await get('/api/projects', cookie))
    const portfolio = projects.find((p: any) => p.name === 'Portfolio site redesign')
    expect(portfolio).toMatchObject({ taskCount: 9, doneCount: 3 })
  })

  it('creates tasks at the bottom of their column, with defaults', async () => {
    const w = await workspace()
    const first = await w.create({ title: 'First' })
    const second = await w.create({ title: '  Second  ', priority: 'high', dueDate: '2026-12-01', estimateMinutes: 90 })
    expect(first).toMatchObject({ status: 'backlog', priority: 'medium', position: 0, completedAt: null, tagIds: [], commentCount: 0, projectName: 'Board test' })
    expect(second).toMatchObject({ title: 'Second', position: 1, dueDate: '2026-12-01', estimateMinutes: 90 })

    const done = await w.create({ title: 'Already done', status: 'done' })
    expect(done.completedAt).not.toBeNull()

    const bad = await send('POST', '/api/tasks', w.cookie, { projectId: w.project.id, title: '', estimateMinutes: 0, status: 'later' })
    expect(bad.status).toBe(400)
    expect(Object.keys((await json(bad)).data.fieldErrors).sort()).toEqual(['estimateMinutes', 'status', 'title'])
  })

  it('reorders within a column and moves between columns', async () => {
    const w = await workspace()
    const a = await w.create({ title: 'A' })
    await w.create({ title: 'B' })
    await w.create({ title: 'C' })

    await send('POST', `/api/tasks/${a.id}/move`, w.cookie, { status: 'backlog', position: 2 })
    expect(await w.column('backlog')).toEqual(['B', 'C', 'A'])

    // Past the end means the bottom.
    const moved = await json(await send('POST', `/api/tasks/${a.id}/move`, w.cookie, { status: 'todo', position: 99 }))
    expect(moved.task).toMatchObject({ status: 'todo', position: 0 })
    expect(await w.column('backlog')).toEqual(['B', 'C'])

    const done = await json(await send('POST', `/api/tasks/${a.id}/move`, w.cookie, { status: 'done', position: 0 }))
    expect(done.task.completedAt).not.toBeNull()
    const reopened = await json(await send('POST', `/api/tasks/${a.id}/move`, w.cookie, { status: 'in_progress', position: 0 }))
    expect(reopened.task.completedAt).toBeNull()

    const { activity } = await json(await get(`/api/activity?projectId=${w.project.id}`, w.cookie))
    expect(activity.slice(0, 5).map((e: any) => e.action)).toEqual(['task.reopened', 'task.moved', 'task.completed', 'task.moved', 'task.moved'])
    expect(activity[1].detail).toEqual({ from: 'done', to: 'in_progress' })
  })

  it('edits tasks, including column and tags', async () => {
    const w = await workspace()
    const { tag: tagA } = await json(await send('POST', '/api/tags', w.cookie, { name: 'alpha', color: 'red' }))
    const { tag: tagB } = await json(await send('POST', '/api/tags', w.cookie, { name: 'beta' }))
    await w.create({ title: 'Already in To do', status: 'todo' })
    const task = await w.create({ title: 'Edit me', tagIds: [tagA.id] })
    expect(task.tagIds).toEqual([tagA.id])

    const { task: edited } = await json(await send('PATCH', `/api/tasks/${task.id}`, w.cookie, {
      title: 'Edited',
      status: 'todo',
      tagIds: [tagB.id],
      estimateMinutes: null,
    }))
    expect(edited).toMatchObject({ title: 'Edited', status: 'todo', position: 1, tagIds: [tagB.id], estimateMinutes: null })

    const byTag = await json(await get(`/api/tasks?tagId=${tagB.id}`, w.cookie))
    expect(byTag.tasks.map((t: any) => t.id)).toEqual([task.id])
    const byText = await json(await get(`/api/tasks?projectId=${w.project.id}&q=edit`, w.cookie))
    expect(byText.tasks.map((t: any) => t.id)).toEqual([task.id])

    // Deleting a tag takes it off every task.
    expect((await send('DELETE', `/api/tags/${tagB.id}`, w.cookie)).status).toBe(204)
    expect((await json(await get(`/api/tasks/${task.id}`, w.cookie))).task.tagIds).toEqual([])
  })

  it('keeps tag names unique per user, ignoring case', async () => {
    const alice = await newDemo()
    const bob = await newDemo()
    expect((await send('POST', '/api/tags', alice.cookie, { name: 'Urgent' })).status).toBe(201)
    const duplicate = await send('POST', '/api/tags', alice.cookie, { name: 'urgent' })
    expect(duplicate.status).toBe(409)
    expect((await json(duplicate)).data.fieldErrors.name).toHaveLength(1)
    // Another user can use the same name.
    expect((await send('POST', '/api/tags', bob.cookie, { name: 'urgent' })).status).toBe(201)
  })

  it('adds and deletes comments', async () => {
    const w = await workspace()
    const task = await w.create({ title: 'Discuss' })
    const added = await send('POST', `/api/tasks/${task.id}/comments`, w.cookie, { body: '  First thought  ' })
    expect(added.status).toBe(201)
    const { comments } = await json(await get(`/api/tasks/${task.id}/comments`, w.cookie))
    expect(comments).toHaveLength(1)
    expect(comments[0]).toMatchObject({ body: 'First thought', authorName: 'Demo user' })
    expect((await json(await get(`/api/tasks/${task.id}`, w.cookie))).task.commentCount).toBe(1)

    expect((await send('POST', `/api/tasks/${task.id}/comments`, w.cookie, { body: '   ' })).status).toBe(400)
    expect((await send('DELETE', `/api/comments/${comments[0].id}`, w.cookie)).status).toBe(204)
    expect((await json(await get(`/api/tasks/${task.id}/comments`, w.cookie))).comments).toHaveLength(0)
  })

  it('makes an archived project’s tasks read-only', async () => {
    const w = await workspace()
    const task = await w.create({ title: 'Frozen' })
    await send('PATCH', `/api/projects/${w.project.id}`, w.cookie, { archived: true })

    for (const response of [
      await send('POST', '/api/tasks', w.cookie, { projectId: w.project.id, title: 'New' }),
      await send('PATCH', `/api/tasks/${task.id}`, w.cookie, { title: 'Changed' }),
      await send('POST', `/api/tasks/${task.id}/move`, w.cookie, { status: 'done', position: 0 }),
      await send('POST', `/api/tasks/${task.id}/comments`, w.cookie, { body: 'Hello' }),
      await send('DELETE', `/api/tasks/${task.id}`, w.cookie),
    ]) {
      expect(response.status).toBe(409)
    }
    expect((await get(`/api/tasks/${task.id}`, w.cookie)).status).toBe(200)
  })

  it('keeps tasks, tags and comments private', async () => {
    const alice = await workspace()
    const bob = await workspace()
    const task = await alice.create({ title: 'Alice’s task' })
    const { tag } = await json(await send('POST', '/api/tags', alice.cookie, { name: 'mine' }))
    await send('POST', `/api/tasks/${task.id}/comments`, alice.cookie, { body: 'Private' })
    const { comments } = await json(await get(`/api/tasks/${task.id}/comments`, alice.cookie))

    for (const response of [
      await get(`/api/tasks/${task.id}`, bob.cookie),
      await send('PATCH', `/api/tasks/${task.id}`, bob.cookie, { title: 'Mine now' }),
      await send('POST', `/api/tasks/${task.id}/move`, bob.cookie, { status: 'done', position: 0 }),
      await send('DELETE', `/api/tasks/${task.id}`, bob.cookie),
      await get(`/api/tasks/${task.id}/comments`, bob.cookie),
      await send('POST', `/api/tasks/${task.id}/comments`, bob.cookie, { body: 'Hi' }),
      await send('DELETE', `/api/comments/${comments[0].id}`, bob.cookie),
      await send('DELETE', `/api/tags/${tag.id}`, bob.cookie),
      // Creating a task in someone else's project.
      await send('POST', '/api/tasks', bob.cookie, { projectId: alice.project.id, title: 'Sneaky' }),
    ]) {
      expect(response.status).toBe(404)
    }

    // Someone else's tag on your own task.
    const foreignTag = await send('POST', '/api/tasks', bob.cookie, { projectId: bob.project.id, title: 'Tagged', tagIds: [tag.id] })
    expect(foreignTag.status).toBe(400)

    const bobsTasks = await json(await get('/api/tasks', bob.cookie))
    expect(bobsTasks.tasks.map((t: any) => t.id)).not.toContain(task.id)
    expect((await json(await get(`/api/tasks?projectId=${alice.project.id}`, bob.cookie))).tasks).toHaveLength(0)
  })

  it('deletes a task with its comments', async () => {
    const w = await workspace()
    const task = await w.create({ title: 'Short-lived' })
    await send('POST', `/api/tasks/${task.id}/comments`, w.cookie, { body: 'Bye' })
    expect((await send('DELETE', `/api/tasks/${task.id}`, w.cookie)).status).toBe(204)
    expect((await get(`/api/tasks/${task.id}`, w.cookie)).status).toBe(404)
    const left = await db.execute({ sql: 'select count(*) as n from task_comments where task_id = ?', args: [task.id] })
    expect(Number(left.rows[0]!.n)).toBe(0)
    const { activity } = await json(await get(`/api/activity?projectId=${w.project.id}`, w.cookie))
    expect(activity[0]).toMatchObject({ action: 'task.deleted', subject: 'Short-lived' })
  })

  it('enforces “done ⇔ completed” in the database itself', async () => {
    const w = await workspace()
    await expect(db.execute({
      sql: `insert into tasks (project_id, title, status, completed_at) values (?, 'Bad', 'done', null)`,
      args: [w.project.id],
    })).rejects.toThrow(/CHECK constraint failed/)
  })

  it('renders the board and the project’s open tasks', async () => {
    const { cookie } = await newDemo()
    const { projects } = await json(await get('/api/projects', cookie))
    const portfolio = projects.find((p: any) => p.name === 'Portfolio site redesign')

    const board = await (await get(`/board?project=${portfolio.id}`, cookie)).text()
    expect(board).toContain('Build the case study template')
    expect(board).toContain('In progress')

    const page = await (await get(`/projects/${portfolio.id}`, cookie)).text()
    expect(page).toContain('Fix layout shift on the mobile nav')
    expect(page).toContain('3 of 9 tasks done')
  })
})
