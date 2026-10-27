import { deleteTag } from '../../services/tags'

/** Deletes the tag and removes it from every task. */
export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  await deleteTag(await useDb(), account.id, routeId(event))
  setResponseStatus(event, 204)
  return null
})
