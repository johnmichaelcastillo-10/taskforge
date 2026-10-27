import { z } from 'zod'
import { listActivity } from '../services/activity'
import { getProject } from '../services/projects'

const querySchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

/** Recent activity for the signed-in user, or for one of their projects. */
export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const { projectId, limit } = readValidQuery(event, querySchema)
  const db = await useDb()
  if (projectId) {
    await getProject(db, account.id, projectId) // 404 unless it's theirs
  }
  return { activity: await listActivity(db, account.id, { projectId, limit }) }
})
