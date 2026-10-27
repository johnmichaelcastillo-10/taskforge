import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createClient, type Client } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import * as schema from '../database/schema'

export type Database = LibSQLDatabase<typeof schema>

/** The database, or a transaction on it: what services accept so they can be composed. */
export type Executor = Database | Parameters<Parameters<Database['transaction']>[0]>[0]

// The setup promise, not the client: two requests arriving together on a cold start share
// one connection instead of racing to open two.
let ready: Promise<Database> | undefined

/** The SQLite file path for a file: URL, or null for :memory: and remote (Turso) URLs. */
export function sqliteFilePath(url: string): string | null {
  if (!url.startsWith('file:')) {
    return null
  }
  const path = url.slice('file:'.length).split('?')[0] ?? ''
  return path === '' || path === ':memory:' ? null : path
}

/**
 * The shared Drizzle client. Local SQLite files get their folder created and WAL journaling,
 * so readers don't block the writer.
 *
 * Deletes rely on ON DELETE CASCADE. libSQL, unlike stock SQLite, enforces foreign keys on
 * every connection by default, including the extra ones the client's pool opens for
 * transactions; the PRAGMA below only makes that explicit. tests/e2e/projects.test.ts checks
 * the cascade.
 */
export function useDb(): Promise<Database> {
  ready ??= connect().catch((error) => {
    ready = undefined // Let the next request retry rather than reuse a failed setup.
    throw error
  })
  return ready
}

async function connect(): Promise<Database> {
  const config = useRuntimeConfig()
  const url = config.databaseUrl
  const file = sqliteFilePath(url)
  if (file && process.env.VERCEL) {
    // Serverless instances have no lasting disk: data written to a file would be lost.
    throw new Error('NUXT_DATABASE_URL must be a Turso URL (libsql://…) on Vercel. See docs/DEPLOY.md.')
  }
  if (file) {
    mkdirSync(dirname(file), { recursive: true })
  }
  const client: Client = createClient({ url, authToken: config.databaseAuthToken || undefined })
  await client.execute('PRAGMA foreign_keys = ON')
  if (file) {
    await client.execute('PRAGMA journal_mode = WAL')
  }
  return drizzle(client, { schema })
}
