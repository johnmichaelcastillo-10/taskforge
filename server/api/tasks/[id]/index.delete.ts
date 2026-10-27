import { deleteTask } from '../../../services/tasks'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  await deleteTask(await useDb(), account.id, routeId(event))
  setResponseStatus(event, 204)
  return null
})
