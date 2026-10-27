import { fileURLToPath } from 'node:url'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

// Builds the app and boots the production server against an in-memory SQLite database.
process.env.NUXT_DATABASE_URL = ':memory:'

describe('health check', async () => {
  // setupTimeout, not Vitest's hookTimeout, bounds the build: its default (120 s) is too short
  // for a cold build on a Windows folder mounted into Docker.
  await setup({ rootDir: fileURLToPath(new URL('../..', import.meta.url)), setupTimeout: 300_000 })

  it('reports the database as reachable', async () => {
    const response = await fetch('/api/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok', checks: { database: 'ok' } })
  })

  it('renders the home page with the database status', async () => {
    const html = await $fetch<string>('/')
    expect(html).toContain('Taskforge')
    expect(html).toContain('connected')
  })
})
