import { createToken } from '../../services/tokens'

/** Creates an API token. The response holds its secret, which is never shown again. */
export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const { name } = await readValidBody(event, tokenCreateSchema)
  setResponseStatus(event, 201)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return await createToken(await useDb(), account.id, name)
})
