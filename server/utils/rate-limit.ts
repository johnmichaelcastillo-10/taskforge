import { lte, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { rateLimits } from '../database/schema'

interface RateLimit {
  /** The action being limited, such as 'login'. Counted separately per client address. */
  action: string
  limit: number
  windowSeconds: number
  /** Count per something other than the client address, such as an API token. */
  key?: string
}

/**
 * A fixed-window limit per client address (or `key`). Throws 429 with Retry-After once `limit`
 * requests have been made within the window.
 */
export async function enforceRateLimit(event: H3Event, { action, limit, windowSeconds, key }: RateLimit) {
  const db = await useDb()
  const now = new Date()
  const nextReset = new Date(now.getTime() + windowSeconds * 1000)

  // One upsert, so concurrent requests can't both read the same count. SQLite evaluates every
  // SET expression against the row as it was, so both CASEs see the old reset_at.
  const [row] = await db
    .insert(rateLimits)
    .values({ key: `${action}:${key ?? clientAddress(event)}`, count: 1, resetAt: nextReset })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} <= ${toSeconds(now)} then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} <= ${toSeconds(now)} then ${toSeconds(nextReset)} else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt })

  if (row && row.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000))
    setResponseHeader(event, 'Retry-After', retryAfter)
    throw createError({ statusCode: 429, message: 'Too many attempts. Try again in a few minutes.' })
  }
}

/** Removes counters whose window has ended. */
export async function deleteExpiredRateLimits() {
  const db = await useDb()
  await db.delete(rateLimits).where(lte(rateLimits.resetAt, new Date()))
}

/**
 * X-Forwarded-For can be set by anyone, so it's only used when NUXT_TRUST_PROXY says a proxy
 * (Vercel) sets it. Otherwise the connection's own address is used.
 */
function clientAddress(event: H3Event): string {
  const { trustProxy } = useRuntimeConfig(event)
  return getRequestIP(event, { xForwardedFor: trustProxy }) ?? 'unknown'
}

function toSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}
