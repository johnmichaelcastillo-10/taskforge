import { and, desc, eq } from 'drizzle-orm'
import { activityLogs } from '../database/schema'
import type { Executor } from '../utils/db'

/**
 * What the activity feed records. Each entry keeps the project or task name at the time
 * (`subject`), so it still reads correctly after a rename or delete.
 */
export type ActivityAction
  = | 'project.created'
    | 'project.updated'
    | 'project.status'
    | 'project.archived'
    | 'project.restored'
    | 'project.deleted'
    | 'task.created'
    | 'task.updated'
    | 'task.moved'
    | 'task.completed'
    | 'task.reopened'
    | 'task.deleted'
    | 'comment.added'

export interface ActivityInput {
  userId: number
  action: ActivityAction
  subject: string
  projectId?: number | null
  taskId?: number | null
  detail?: Record<string, string>
  createdAt?: Date
}

export async function logActivity(db: Executor, entry: ActivityInput) {
  await db.insert(activityLogs).values(entry)
}

/** The latest entries for a user, optionally for one project only. */
export async function listActivity(db: Executor, userId: number, options: { projectId?: number, limit?: number } = {}) {
  return db
    .select()
    .from(activityLogs)
    .where(and(
      eq(activityLogs.userId, userId),
      options.projectId ? eq(activityLogs.projectId, options.projectId) : undefined,
    ))
    .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
    .limit(options.limit ?? 20)
}
