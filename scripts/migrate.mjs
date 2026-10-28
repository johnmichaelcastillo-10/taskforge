// Applies pending SQL migrations to NUXT_DATABASE_URL (a local SQLite file by default, or
// Turso). One script for every environment: the Docker container runs it before starting the
// server, CI before the tests, and the production build before deploying. Already-applied
// migrations are skipped, so running it again is safe.
//
//   npm run db:migrate
//
// MIGRATIONS_DIR overrides where the SQL files are read from (the Docker image keeps them
// outside the source tree).
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'

const url = process.env.NUXT_DATABASE_URL || 'file:./data/taskforge.db'
const authToken = process.env.NUXT_DATABASE_AUTH_TOKEN || undefined
const migrationsFolder = process.env.MIGRATIONS_DIR
  || resolve(dirname(fileURLToPath(import.meta.url)), '../server/database/migrations')

// On Vercel (the build sets VERCEL=1) a local file would vanish with the build: the database
// has to be Turso. Fail the deployment rather than ship an app with nowhere to keep its data.
if (process.env.VERCEL && !/^(libsql|https?|wss?):\/\//.test(url)) {
  // The URL isn't a secret (the token is), so say what arrived: that pins down a variable that
  // wasn't set for this environment, or one with stray characters.
  const received = process.env.NUXT_DATABASE_URL === undefined
    ? 'it isn’t set for this deployment'
    : `it starts with ${JSON.stringify(process.env.NUXT_DATABASE_URL.slice(0, 12))}`
  console.error(`NUXT_DATABASE_URL must be a Turso URL (libsql://…) on Vercel, but ${received}. See docs/DEPLOY.md.`)
  process.exit(1)
}

// Same rule as sqliteFilePath() in server/utils/db.ts: only real files need a folder.
if (url.startsWith('file:')) {
  const path = url.slice('file:'.length).split('?')[0]
  if (path && path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }
}

const client = createClient({ url, authToken })
try {
  await client.execute('PRAGMA foreign_keys = ON')
  await migrate(drizzle(client), { migrationsFolder })
  console.log(`Migrations applied (${url.startsWith('file:') ? url : 'remote database'}).`)
}
catch (error) {
  console.error('Migration failed:', error)
  process.exitCode = 1
}
finally {
  client.close()
}
