import { getProject } from '../../../../services/projects'
import { listTasks } from '../../../../services/tasks'

/** The project's tasks, in board order; also filtered by `?status=`, `?priority=`, `?tagId=`, `?q=`. */
export default defineEventHandler(async (event) => {
  const account = await requireApiAccount(event)
  const db = await useDb()
  const project = await getProject(db, account.id, routeId(event))
  const filters = readValidQuery(event, taskFiltersSchema)
  return { tasks: await listTasks(db, account.id, { ...filters, projectId: project.id }) }
})
