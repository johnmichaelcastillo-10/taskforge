import { and, asc, eq, getTableColumns, ne, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { projects, taskTags, tasks } from '../database/schema'
import type { Executor } from '../utils/db'
import { logActivity } from './activity'
import { assertEditable, getProject, likePattern, type Project } from './projects'
import { assertOwnTags } from './tags'

type TaskRow = typeof tasks.$inferSelect
type CreateInput = z.output<typeof taskCreateSchema>
type UpdateInput = z.output<typeof taskUpdateSchema>
type MoveInput = z.output<typeof taskMoveSchema>
type Filters = z.output<typeof taskFiltersSchema>

/** A task with what the board shows on its card. */
export interface TaskDetails extends TaskRow {
  projectName: string
  tagIds: number[]
  commentCount: number
}

// Correlated subqueries rather than one query per task: the board loads in a single query.
// Plain SQL with explicit names, so the outer task is never confused with a subquery's rows.
const details = {
  projectName: projects.name,
  tagIds: sql<string | null>`(select group_concat(tt.tag_id) from task_tags as tt where tt.task_id = "tasks"."id")`,
  commentCount: sql<number>`(select count(*) from task_comments as c where c.task_id = "tasks"."id")`,
}

function withDetails(row: Omit<TaskDetails, 'tagIds'> & { tagIds: string | null }): TaskDetails {
  return { ...row, tagIds: row.tagIds ? row.tagIds.split(',').map(Number) : [] }
}

function selectTasks(db: Executor) {
  return db
    .select({ ...getTableColumns(tasks), ...details })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
}

export async function listTasks(db: Executor, ownerId: number, filters: Filters): Promise<TaskDetails[]> {
  const rows = await selectTasks(db)
    .where(and(
      eq(projects.ownerId, ownerId),
      filters.projectId ? eq(tasks.projectId, filters.projectId) : undefined,
      filters.status ? eq(tasks.status, filters.status) : undefined,
      filters.priority ? eq(tasks.priority, filters.priority) : undefined,
      filters.q ? sql`${tasks.title} like ${likePattern(filters.q)} escape '\\'` : undefined,
      filters.tagId
        ? sql`exists (select 1 from task_tags as tt where tt.task_id = "tasks"."id" and tt.tag_id = ${filters.tagId})`
        : undefined,
    ))
    .orderBy(asc(tasks.position), asc(tasks.id))
  return rows.map(withDetails)
}

/** The task and its project, if the project belongs to `ownerId`; 404 otherwise. */
export async function getTask(db: Executor, ownerId: number, id: number): Promise<{ task: TaskDetails, project: Project }> {
  const [row] = await selectTasks(db).where(and(eq(tasks.id, id), eq(projects.ownerId, ownerId)))
  if (!row) {
    throw createError({ statusCode: 404, message: 'Task not found.' })
  }
  return { task: withDetails(row), project: await getProject(db, ownerId, row.projectId) }
}

async function nextPosition(db: Executor, projectId: number, status: TaskRow['status']) {
  const [row] = await db
    .select({ next: sql<number>`coalesce(max(${tasks.position}) + 1, 0)` })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.status, status)))
  return row!.next
}

async function setTags(db: Executor, taskId: number, tagIds: number[]) {
  await db.delete(taskTags).where(eq(taskTags.taskId, taskId))
  const unique = [...new Set(tagIds)]
  if (unique.length > 0) {
    await db.insert(taskTags).values(unique.map(tagId => ({ taskId, tagId })))
  }
}

/** Logs a change of column: a move, and a completion or reopening when Done is involved. */
async function logStatusChange(db: Executor, ownerId: number, task: TaskRow, to: TaskRow['status']) {
  const base = { userId: ownerId, projectId: task.projectId, taskId: task.id, subject: task.title }
  await logActivity(db, { ...base, action: 'task.moved', detail: { from: task.status, to } })
  if (to === 'done') {
    await logActivity(db, { ...base, action: 'task.completed' })
  }
  else if (task.status === 'done') {
    await logActivity(db, { ...base, action: 'task.reopened' })
  }
}

export async function createTask(db: Executor, ownerId: number, input: CreateInput): Promise<TaskDetails> {
  return db.transaction(async (tx) => {
    const project = await getProject(tx, ownerId, input.projectId)
    assertEditable(project)
    await assertOwnTags(tx, ownerId, input.tagIds)

    const { tagIds, ...fields } = input
    const [task] = await tx
      .insert(tasks)
      .values({
        ...fields,
        position: await nextPosition(tx, project.id, fields.status),
        completedAt: fields.status === 'done' ? new Date() : null,
      })
      .returning()
    await setTags(tx, task!.id, tagIds)
    await logActivity(tx, { userId: ownerId, projectId: project.id, taskId: task!.id, action: 'task.created', subject: task!.title })
    return (await getTask(tx, ownerId, task!.id)).task
  })
}

export async function updateTask(db: Executor, ownerId: number, id: number, input: UpdateInput): Promise<TaskDetails> {
  return db.transaction(async (tx) => {
    const { task, project } = await getTask(tx, ownerId, id)
    assertEditable(project)

    const { tagIds, status, ...fields } = input
    const changes = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Partial<typeof fields>
    const statusChanged = status !== undefined && status !== task.status

    if (tagIds !== undefined) {
      await assertOwnTags(tx, ownerId, tagIds)
      await setTags(tx, id, tagIds)
    }
    if (Object.keys(changes).length > 0 || statusChanged) {
      await tx
        .update(tasks)
        .set({
          ...changes,
          ...(statusChanged
            ? {
                status,
                position: await nextPosition(tx, task.projectId, status),
                completedAt: status === 'done' ? new Date() : null,
              }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, id))
    }

    const subject = changes.title ?? task.title
    if (Object.keys(changes).length > 0 || tagIds !== undefined) {
      await logActivity(tx, { userId: ownerId, projectId: task.projectId, taskId: id, action: 'task.updated', subject })
    }
    if (statusChanged) {
      await logStatusChange(tx, ownerId, { ...task, title: subject }, status)
    }
    return (await getTask(tx, ownerId, id)).task
  })
}

/**
 * Puts the task at `position` in the `status` column (0 = top; past the end means the bottom)
 * and renumbers that column. Moving into Done stamps the completion time, moving out clears it.
 */
export async function moveTask(db: Executor, ownerId: number, id: number, input: MoveInput): Promise<TaskDetails> {
  return db.transaction(async (tx) => {
    const { task, project } = await getTask(tx, ownerId, id)
    assertEditable(project)

    const column = await tx
      .select({ id: tasks.id, position: tasks.position })
      .from(tasks)
      .where(and(eq(tasks.projectId, task.projectId), eq(tasks.status, input.status), ne(tasks.id, id)))
      .orderBy(asc(tasks.position), asc(tasks.id))

    const order = column.map(row => row.id)
    order.splice(Math.min(input.position, order.length), 0, id)

    // Only rows whose number actually changes are written.
    for (const [position, taskId] of order.entries()) {
      if (taskId === id) {
        continue
      }
      if (column.find(row => row.id === taskId)!.position !== position) {
        await tx.update(tasks).set({ position }).where(eq(tasks.id, taskId))
      }
    }

    const statusChanged = input.status !== task.status
    await tx
      .update(tasks)
      .set({
        status: input.status,
        position: order.indexOf(id),
        ...(statusChanged ? { completedAt: input.status === 'done' ? new Date() : null, updatedAt: new Date() } : {}),
      })
      .where(eq(tasks.id, id))

    if (statusChanged) {
      await logStatusChange(tx, ownerId, task, input.status)
    }
    return (await getTask(tx, ownerId, id)).task
  })
}

export async function deleteTask(db: Executor, ownerId: number, id: number) {
  await db.transaction(async (tx) => {
    const { task, project } = await getTask(tx, ownerId, id)
    assertEditable(project)
    await tx.delete(tasks).where(eq(tasks.id, id))
    await logActivity(tx, { userId: ownerId, projectId: task.projectId, taskId: id, action: 'task.deleted', subject: task.title })
  })
}
