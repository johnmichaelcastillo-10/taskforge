/** The account the token belongs to. */
export default defineEventHandler(async (event) => {
  const account = await requireApiAccount(event)
  return { user: toSessionUser(account) }
})
