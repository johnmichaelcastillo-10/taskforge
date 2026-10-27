import { deleteComment } from '../../services/comments'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  await deleteComment(await useDb(), account.id, routeId(event))
  setResponseStatus(event, 204)
  return null
})
