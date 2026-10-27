import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Timestamps are Unix seconds (integer), so SQLite's own date functions can group and filter
// them in analytics queries.
const createdAt = () => integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
const updatedAt = () => integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)

/**
 * Two kinds of account: a demo account (no email or password, removed at demo_expires_at)
 * and a regular one (email and password hash, no expiry). The CHECK makes any other mix
 * impossible to store.
 */
export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    email: text('email').unique(),
    passwordHash: text('password_hash'),
    timezone: text('timezone').notNull().default('UTC'),
    isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
    demoExpiresAt: integer('demo_expires_at', { mode: 'timestamp' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  table => [
    check(
      'users_account_kind',
      sql`(${table.isDemo} = 1 and ${table.demoExpiresAt} is not null and ${table.email} is null and ${table.passwordHash} is null)
        or (${table.isDemo} = 0 and ${table.demoExpiresAt} is null and ${table.email} is not null and ${table.passwordHash} is not null)`,
    ),
  ],
)
