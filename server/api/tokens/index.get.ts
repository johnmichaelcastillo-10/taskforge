import { listTokens } from '../../services/tokens'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  return { tokens: await listTokens(await useDb(), account.id) }
})
