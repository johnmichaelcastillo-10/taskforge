import { users } from '../../database/schema'

/** Creates a regular account and signs it in. Off unless NUXT_PUBLIC_REGISTRATION_ENABLED=true. */
export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).public.registrationEnabled) {
    throw createError({ statusCode: 403, message: 'Registration is closed. Try the demo instead.' })
  }
  await enforceRateLimit(event, { action: 'register', limit: 5, windowSeconds: 60 * 60 })

  const { name, email, password } = await readValidBody(event, registerSchema)
  const db = await useDb()
  const [account] = await db
    .insert(users)
    .values({ name, email, passwordHash: await hashPassword(password) })
    .onConflictDoNothing({ target: users.email })
    .returning()

  if (!account) {
    throw createError({
      statusCode: 409,
      message: 'An account with this email already exists.',
      data: { fieldErrors: { email: ['An account with this email already exists.'] } },
    })
  }

  await signIn(event, account)
  setResponseStatus(event, 201)
  return { user: toSessionUser(account) }
})
