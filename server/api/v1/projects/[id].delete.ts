import { deleteProject } from '../../../services/projects'

export default defineEventHandler(async (event) => {
  const account = await requireApiAccount(event)
  await deleteProject(await useDb(), account.id, routeId(event))
  setResponseStatus(event, 204)
  return null
})
