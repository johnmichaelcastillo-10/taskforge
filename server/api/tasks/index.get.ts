import { listTasks } from '../../services/tasks'

/** The signed-in user's tasks, filtered by `projectId`, `status`, `priority`, `tagId` or `q`. */
export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const filters = readValidQuery(event, taskFiltersSchema)
  return { tasks: await listTasks(await useDb(), account.id, filters) }
})
