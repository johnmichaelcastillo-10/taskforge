import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@libsql/client'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { afterAll } from 'vitest'
import { rootDir, testOutputDir } from './paths'

/**
 * Starts the built app for one test file, on a fresh SQLite file with migrations applied.
 * Returns a client on the same file, so tests can inspect rows or change them (expire a demo,
 * say) the way time would.
 *
 * Await it at the top of an async describe block, as with @nuxt/test-utils' setup().
 */
export async function useTestServer(env: Record<string, string> = {}) {
  const file = join(tmpdir(), `taskforge-test-${randomUUID()}.db`)
  const url = `file:${file}`
  execFileSync(process.execPath, ['scripts/migrate.mjs'], {
    cwd: rootDir,
    env: { ...process.env, NUXT_DATABASE_URL: url },
    stdio: 'ignore',
  })

  const db = createClient({ url })
  afterAll(() => {
    db.close()
    for (const suffix of ['', '-wal', '-shm']) {
      rmSync(file + suffix, { force: true })
    }
  })

  await setup({
    rootDir,
    build: false,
    nuxtConfig: { nitro: { output: { dir: testOutputDir } } },
    // The server inherits this process's environment (the dev container turns registration on),
    // so every setting a test depends on is set here explicitly.
    env: {
      NUXT_DATABASE_URL: url,
      NUXT_DATABASE_AUTH_TOKEN: '',
      NUXT_SESSION_PASSWORD: 'test-session-password-of-at-least-32-characters',
      NUXT_PUBLIC_REGISTRATION_ENABLED: 'false',
      NUXT_TRUST_PROXY: 'false',
      NUXT_DEMO_TTL_HOURS: '72',
      ...env,
    },
  })

  return { db }
}

/** The cookies a response set, ready to send back as a Cookie header. */
export function cookiesFrom(response: Response): string {
  return response.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ')
}

/** POST a JSON body (with an optional Cookie header) and return the raw response. */
export function postJson(path: string, body: unknown = {}, cookie?: string) {
  return fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })
}

/** GET with an optional Cookie header, without following redirects. */
export function get(path: string, cookie?: string) {
  return fetch(path, { headers: cookie ? { cookie } : {}, redirect: 'manual' })
}
