import { and, eq, inArray, isNull } from 'drizzle-orm'
import { tasks, workSessions } from '../database/schema'
import type { Executor } from '../utils/db'

/**
 * Stops timers that may no longer run: on a task that was just completed, or on any task of a
 * project that was just archived. Kept apart from timer.ts so tasks.ts and projects.ts can use
 * it without importing each other.
 */
export async function stopTimersOn(db: Executor, target: { taskId: number } | { projectId: number }) {
  const taskIds = 'taskId' in target
    ? [target.taskId]
    : (await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.projectId, target.projectId))).map(row => row.id)
  if (taskIds.length === 0) {
    return
  }
  await db
    .update(workSessions)
    .set({ endedAt: new Date() })
    .where(and(isNull(workSessions.endedAt), inArray(workSessions.taskId, taskIds)))
}

/** True for the error SQLite raises when a second timer would start for the same user. */
export function isSecondTimerError(error: unknown): boolean {
  const text = String((error as { cause?: unknown })?.cause ?? error)
  return text.includes('UNIQUE constraint failed: work_sessions.user_id')
}
