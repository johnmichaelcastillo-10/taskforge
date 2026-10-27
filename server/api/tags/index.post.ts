import { createTag } from '../../services/tags'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const input = await readValidBody(event, tagSchema)
  setResponseStatus(event, 201)
  return { tag: await createTag(await useDb(), account.id, input) }
})
