import { deleteSession } from '../../services/timer'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  await deleteSession(await useDb(), account.id, routeId(event))
  setResponseStatus(event, 204)
  return null
})
