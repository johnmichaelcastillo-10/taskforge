import { getProject } from '../../../services/projects'

export default defineEventHandler(async (event) => {
  const account = await requireApiAccount(event)
  return { project: await getProject(await useDb(), account.id, routeId(event)) }
})
