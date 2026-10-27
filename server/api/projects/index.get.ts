import { listProjects } from '../../services/projects'

/** The signed-in user's projects: active by default, or `?archived=true`, `?status=`, `?q=`. */
export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const filters = readValidQuery(event, projectFiltersSchema)
  return { projects: await listProjects(await useDb(), account.id, filters) }
})
