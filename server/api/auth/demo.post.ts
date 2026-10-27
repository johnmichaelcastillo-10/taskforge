import { users } from '../../database/schema'

/**
 * "Try the demo": creates a private demo account with no password, signs it in, and returns it.
 * A visitor who already has a live demo keeps it instead of getting another.
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const current = session.user ? await findActiveAccount(session.user.id) : null
  if (current?.isDemo) {
    return { user: toSessionUser(current) }
  }

  await enforceRateLimit(event, { action: 'demo', limit: 10, windowSeconds: 60 * 60 })

  // There's no scheduler on the free hosting plan, so expired data is cleared here instead, as
  // new demos arrive. Both deletes use indexes and are cheap.
  await deleteExpiredDemos()
  await deleteExpiredRateLimits()

  const { demoTtlHours } = useRuntimeConfig(event)
  const db = await useDb()
  const [account] = await db
    .insert(users)
    .values({
      name: 'Demo user',
      isDemo: true,
      demoExpiresAt: new Date(Date.now() + demoTtlHours * 60 * 60 * 1000),
    })
    .returning()

  await signIn(event, account!)
  setResponseStatus(event, 201)
  return { user: toSessionUser(account!) }
})
