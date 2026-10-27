import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { projects, tasks, workSessions } from '../database/schema'
import type { Executor } from '../utils/db'
import { assertEditable } from './projects'
import { isSecondTimerError } from './running-timers'
import { getTask } from './tasks'

/** A session as the app shows it, with its length worked out on the server. */
export interface WorkSession {
  id: number
  taskId: number
  taskTitle: string
  projectId: number
  projectName: string
  startedAt: Date
  endedAt: Date | null
  /** Up to now for the running timer. */
  durationSeconds: number
}

function selectSessions(db: Executor) {
  return db
    .select({
      id: workSessions.id,
      taskId: workSessions.taskId,
      taskTitle: tasks.title,
      projectId: tasks.projectId,
      projectName: projects.name,
      startedAt: workSessions.startedAt,
      endedAt: workSessions.endedAt,
      durationSeconds: sql<number>`coalesce("work_sessions"."ended_at", unixepoch()) - "work_sessions"."started_at"`,
    })
    .from(workSessions)
    .innerJoin(tasks, eq(tasks.id, workSessions.taskId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
}

/** The user's running timer, or null. */
export async function getRunningTimer(db: Executor, userId: number): Promise<WorkSession | null> {
  const [running] = await selectSessions(db).where(and(eq(workSessions.userId, userId), isNull(workSessions.endedAt)))
  return running ?? null
}

export async function startTimer(db: Executor, userId: number, taskId: number, options: { switch: boolean }) {
  return db.transaction(async (tx) => {
    const { task, project } = await getTask(tx, userId, taskId)
    assertEditable(project)
    if (task.status === 'done') {
      throw createError({ statusCode: 409, message: 'This task is done. Reopen it to track more time.' })
    }

    const running = await getRunningTimer(tx, userId)
    if (running?.taskId === taskId) {
      return { session: running, stopped: null }
    }
    if (running && !options.switch) {
      throw createError({
        statusCode: 409,
        message: `A timer is already running on “${running.taskTitle}”.`,
        data: { running },
      })
    }

    // Both stamps come from one clock reading, so the switch leaves no gap and no overlap.
    // Whole seconds, as stored, so the session returned here matches the row exactly.
    const now = new Date(Math.floor(Date.now() / 1000) * 1000)
    if (running) {
      await tx.update(workSessions).set({ endedAt: now }).where(eq(workSessions.id, running.id))
    }
    // Two starts at the same moment can both find nothing running; the unique index lets only
    // one of them in, and the other gets the same answer as above.
    const [session] = await tx.insert(workSessions).values({ userId, taskId, startedAt: now }).returning().catch((error) => {
      throw isSecondTimerError(error)
        ? createError({ statusCode: 409, message: 'A timer is already running.' })
        : error
    })
    return {
      session: (await selectSessions(tx).where(eq(workSessions.id, session!.id)))[0]!,
      stopped: running ? { ...running, endedAt: now, durationSeconds: Math.floor((now.getTime() - running.startedAt.getTime()) / 1000) } : null,
    }
  })
}

/** Stops the running timer and returns the finished session; 409 when nothing is running. */
export async function stopTimer(db: Executor, userId: number): Promise<WorkSession> {
  return db.transaction(async (tx) => {
    const running = await getRunningTimer(tx, userId)
    if (!running) {
      throw createError({ statusCode: 409, message: 'No timer is running.' })
    }
    await tx.update(workSessions).set({ endedAt: new Date() }).where(eq(workSessions.id, running.id))
    return (await selectSessions(tx).where(eq(workSessions.id, running.id)))[0]!
  })
}

export async function listSessions(db: Executor, userId: number, filters: { taskId?: number, limit: number }) {
  if (filters.taskId) {
    await getTask(db, userId, filters.taskId) // 404 unless it's theirs
  }
  return selectSessions(db)
    .where(and(
      eq(workSessions.userId, userId),
      filters.taskId ? eq(workSessions.taskId, filters.taskId) : undefined,
    ))
    .orderBy(desc(workSessions.startedAt), desc(workSessions.id))
    .limit(filters.limit)
}

/** Removes a session recorded by mistake. Not on an archived project. */
export async function deleteSession(db: Executor, userId: number, id: number) {
  await db.transaction(async (tx) => {
    const [session] = await tx
      .select({ taskId: workSessions.taskId })
      .from(workSessions)
      .where(and(eq(workSessions.id, id), eq(workSessions.userId, userId)))
    if (!session) {
      throw createError({ statusCode: 404, message: 'Session not found.' })
    }
    const { project } = await getTask(tx, userId, session.taskId)
    assertEditable(project)
    await tx.delete(workSessions).where(eq(workSessions.id, id))
  })
}
