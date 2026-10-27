import { listComments } from '../../../services/comments'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  return { comments: await listComments(await useDb(), account.id, routeId(event)) }
})
