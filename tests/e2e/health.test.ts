import { fetch } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { useTestServer } from './server'

describe('health check', async () => {
  await useTestServer()

  it('reports the database as reachable', async () => {
    const response = await fetch('/api/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok', checks: { database: 'ok' } })
  })
})
