import { listTasks } from '../../../services/tasks'

/** Your tasks, filtered by `?projectId=`, `?status=`, `?priority=`, `?tagId=` or `?q=`. */
export default defineEventHandler(async (event) => {
  const account = await requireApiAccount(event)
  const filters = readValidQuery(event, taskFiltersSchema)
  return { tasks: await listTasks(await useDb(), account.id, filters) }
})
