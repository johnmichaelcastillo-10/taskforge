import { sql } from 'drizzle-orm'

/**
 * Liveness and database check for Docker, CI and the host's health checks. 200 when the
 * database answers a query, 503 when it doesn't (the error itself is logged, not returned).
 */
export default defineEventHandler(async (event) => {
  try {
    const db = await useDb()
    await db.run(sql`select 1`)
    return { status: 'ok', checks: { database: 'ok' } }
  }
  catch (error) {
    console.error('Health check: database unavailable', error)
    setResponseStatus(event, 503)
    return { status: 'error', checks: { database: 'unavailable' } }
  }
})
