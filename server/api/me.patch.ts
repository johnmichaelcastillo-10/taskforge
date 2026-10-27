import { eq } from 'drizzle-orm'
import { users } from '../database/schema'

/** Updates the signed-in user's name or time zone, and the session that shows them. */
export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const changes = await readValidBody(event, profileSchema)
  const db = await useDb()
  const [updated] = await db
    .update(users)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(users.id, account.id))
    .returning()
  await signIn(event, updated!)
  return { user: toSessionUser(updated!) }
})
