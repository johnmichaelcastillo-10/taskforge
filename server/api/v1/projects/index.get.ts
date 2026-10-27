import { listProjects } from '../../../services/projects'

/** Your projects: active by default, or `?archived=true`, `?status=`, `?q=`. */
export default defineEventHandler(async (event) => {
  const account = await requireApiAccount(event)
  const filters = readValidQuery(event, projectFiltersSchema)
  return { projects: await listProjects(await useDb(), account.id, filters) }
})
