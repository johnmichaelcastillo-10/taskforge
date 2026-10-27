import { and, asc, eq } from 'drizzle-orm'
import { taskComments, users } from '../database/schema'
import type { Executor } from '../utils/db'
import { logActivity } from './activity'
import { assertEditable } from './projects'
import { getTask } from './tasks'

export async function listComments(db: Executor, ownerId: number, taskId: number) {
  await getTask(db, ownerId, taskId) // 404 unless the task is theirs
  return db
    .select({
      id: taskComments.id,
      taskId: taskComments.taskId,
      authorId: taskComments.authorId,
      authorName: users.name,
      body: taskComments.body,
      createdAt: taskComments.createdAt,
    })
    .from(taskComments)
    .innerJoin(users, eq(users.id, taskComments.authorId))
    .where(eq(taskComments.taskId, taskId))
    .orderBy(asc(taskComments.createdAt), asc(taskComments.id))
}

export async function addComment(db: Executor, ownerId: number, taskId: number, body: string) {
  return db.transaction(async (tx) => {
    const { task, project } = await getTask(tx, ownerId, taskId)
    assertEditable(project)
    const [comment] = await tx.insert(taskComments).values({ taskId, authorId: ownerId, body }).returning()
    await logActivity(tx, { userId: ownerId, projectId: task.projectId, taskId, action: 'comment.added', subject: task.title })
    return comment!
  })
}

/** Only the author can delete a comment, and not on an archived project. */
export async function deleteComment(db: Executor, userId: number, id: number) {
  await db.transaction(async (tx) => {
    const [comment] = await tx.select().from(taskComments).where(and(eq(taskComments.id, id), eq(taskComments.authorId, userId)))
    if (!comment) {
      throw createError({ statusCode: 404, message: 'Comment not found.' })
    }
    const { project } = await getTask(tx, userId, comment.taskId)
    assertEditable(project)
    await tx.delete(taskComments).where(eq(taskComments.id, id))
  })
}
