import { revokeToken } from '../../services/tokens'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  await revokeToken(await useDb(), account.id, routeId(event))
  setResponseStatus(event, 204)
  return null
})
