import { eq } from 'drizzle-orm'
import { users } from '../database/schema'

/** Deletes the signed-in account and everything in it, then signs out. Ends a demo early. */
export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const db = await useDb()
  await db.delete(users).where(eq(users.id, account.id))
  await clearUserSession(event)
  setResponseStatus(event, 204)
  return null
})
