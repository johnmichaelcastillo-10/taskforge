import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, sql } from 'drizzle-orm'
import { apiTokens } from '../database/schema'
import type { Executor } from '../utils/db'

const MAX_TOKENS = 10

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** What the settings page lists: never the hash. */
const visible = {
  id: apiTokens.id,
  name: apiTokens.name,
  prefix: apiTokens.prefix,
  lastUsedAt: apiTokens.lastUsedAt,
  createdAt: apiTokens.createdAt,
}

export async function listTokens(db: Executor, userId: number) {
  return db.select(visible).from(apiTokens).where(eq(apiTokens.userId, userId)).orderBy(desc(apiTokens.id))
}

/** Creates a token and returns it with its secret, the only time the secret is available. */
export async function createToken(db: Executor, userId: number, name: string) {
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
  if (count >= MAX_TOKENS) {
    throw createError({ statusCode: 409, message: `You can have up to ${MAX_TOKENS} tokens. Revoke one first.` })
  }

  // 32 random bytes: about 256 bits, far beyond guessing. "tf_" makes leaked tokens easy to spot.
  const secret = `tf_${randomBytes(32).toString('base64url')}`
  const [token] = await db
    .insert(apiTokens)
    .values({ userId, name, tokenHash: hashToken(secret), prefix: secret.slice(0, 10) })
    .returning(visible)
  return { token: token!, secret }
}

export async function revokeToken(db: Executor, userId: number, id: number) {
  const deleted = await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)))
    .returning({ id: apiTokens.id })
  if (deleted.length === 0) {
    throw createError({ statusCode: 404, message: 'Token not found.' })
  }
}

/** The token row for a secret, or null. Marks it used, at most once a minute. */
export async function useToken(db: Executor, secret: string) {
  const [token] = await db.select().from(apiTokens).where(eq(apiTokens.tokenHash, hashToken(secret)))
  if (!token) {
    return null
  }
  if (!token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > 60_000) {
    await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, token.id))
  }
  return token
}
