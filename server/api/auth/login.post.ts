import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

// Checked when no account matches, so a wrong email takes as long as a wrong password and the
// response time doesn't reveal which emails have accounts.
let dummyHash: Promise<string> | undefined

/** Signs in a regular account with email and password. Works even while registration is off. */
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, { action: 'login', limit: 10, windowSeconds: 15 * 60 })

  const { email, password } = await readValidBody(event, loginSchema)
  const db = await useDb()
  const account = await db.query.users.findFirst({ where: eq(users.email, email) })

  const incorrect = () => createError({ statusCode: 401, message: 'Email or password is incorrect.' })

  if (!account?.passwordHash) {
    await verifyPassword(await (dummyHash ??= hashPassword('no account')), password)
    throw incorrect()
  }
  if (!await verifyPassword(account.passwordHash, password)) {
    throw incorrect()
  }

  await signIn(event, account)
  return { user: toSessionUser(account) }
})
