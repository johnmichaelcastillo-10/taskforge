/** The signed-in account, checked against the database. 401 for guests and expired demos. */
export default defineEventHandler(async (event) => {
  return { user: toSessionUser(await requireAccount(event)) }
})
