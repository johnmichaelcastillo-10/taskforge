import { addComment } from '../../../services/comments'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const id = routeId(event)
  const { body } = await readValidBody(event, commentSchema)
  setResponseStatus(event, 201)
  return { comment: await addComment(await useDb(), account.id, id, body) }
})
