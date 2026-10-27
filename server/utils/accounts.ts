import { and, eq, lte } from 'drizzle-orm'
import type { User } from '#auth-utils'
import type { H3Event } from 'h3'
import { users } from '../database/schema'

type Account = typeof users.$inferSelect

/** The account, or null when it doesn't exist or is a demo past its expiry. */
export async function findActiveAccount(id: number): Promise<Account | null> {
  const db = await useDb()
  const account = await db.query.users.findFirst({ where: eq(users.id, id) })
  if (!account || (account.demoExpiresAt && account.demoExpiresAt <= new Date())) {
    return null
  }
  return account
}

/**
 * The signed-in account, loaded from the database. Throws 401 when there is no session, or when
 * its account has since been deleted or has expired: the cookie alone is never trusted.
 */
export async function requireAccount(event: H3Event): Promise<Account> {
  const session = await getUserSession(event)
  const account = session.user ? await findActiveAccount(session.user.id) : null
  if (!account) {
    if (session.user) {
      await clearUserSession(event)
    }
    throw createError({ statusCode: 401, message: 'Sign in to continue.' })
  }
  return account
}

/** What the session cookie and the API expose about an account. Never the password hash. */
export function toSessionUser(account: Account): User {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    isDemo: account.isDemo,
    demoExpiresAt: account.demoExpiresAt?.getTime() ?? null,
  }
}

/** Starts a new session for the account, replacing any previous one. */
export async function signIn(event: H3Event, account: Account) {
  // A demo's cookie expires with the demo; regular sessions use the configured maxAge.
  const config = account.demoExpiresAt
    ? { maxAge: Math.max(1, Math.floor((account.demoExpiresAt.getTime() - Date.now()) / 1000)) }
    : undefined
  await replaceUserSession(event, { user: toSessionUser(account), loggedInAt: Date.now() }, config)
}

/** Deletes demo accounts past their expiry, and with them (by cascade) all their data. */
export async function deleteExpiredDemos() {
  const db = await useDb()
  await db.delete(users).where(and(eq(users.isDemo, true), lte(users.demoExpiresAt, new Date())))
}
