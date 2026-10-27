import { listTags } from '../../services/tags'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  return { tags: await listTags(await useDb(), account.id) }
})
