import { defineConfig } from 'drizzle-kit'

// `npm run db:generate` writes SQL migrations from server/database/schema.ts; they are applied
// by scripts/migrate.mjs, which needs no dev dependencies.
export default defineConfig({
  dialect: 'turso',
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dbCredentials: {
    url: process.env.NUXT_DATABASE_URL ?? 'file:./data/taskforge.db',
    authToken: process.env.NUXT_DATABASE_AUTH_TOKEN || undefined,
  },
})
