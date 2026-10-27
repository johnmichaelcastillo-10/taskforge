import type { H3Event } from 'h3'
import { useToken } from '../services/tokens'

/**
 * The account behind the request's API token (`Authorization: Bearer tf_…`), for /api/v1. The
 * session cookie is not accepted there, and tokens are not accepted by the app's own routes.
 * Each token may make 120 requests a minute.
 */
export async function requireApiAccount(event: H3Event) {
  const header = getRequestHeader(event, 'authorization') ?? ''
  const secret = /^Bearer\s+(tf_[\w-]+)$/i.exec(header.trim())?.[1]

  const token = secret ? await useToken(await useDb(), secret) : null
  const account = token ? await findActiveAccount(token.userId) : null
  if (!token || !account) {
    setResponseHeader(event, 'WWW-Authenticate', 'Bearer realm="taskforge"')
    throw createError({
      statusCode: 401,
      message: secret ? 'This token is not valid. It may have been revoked.' : 'Send an API token: Authorization: Bearer <token>.',
    })
  }

  await enforceRateLimit(event, { action: 'api', key: `token:${token.id}`, limit: 120, windowSeconds: 60 })
  return account
}
