import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
// A relative import: drizzle-kit reads this file outside Nuxt, without its auto-imports.
import { PRIORITIES, PROJECT_STATUSES } from '../../shared/utils/constants'

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
    // For deleting expired demos.
    index('users_demo_expires_at_idx').on(table.demoExpiresAt),
  ],
)

/**
 * A project belongs to one user. Archiving is separate from the status, so unarchiving restores
 * whatever the status was; an archived project is read-only. Dates are calendar days
 * ('YYYY-MM-DD'), which have no time zone.
 */
export const projects = sqliteTable(
  'projects',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ownerId: integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    status: text('status', { enum: PROJECT_STATUSES }).notNull().default('planning'),
    priority: text('priority', { enum: PRIORITIES }).notNull().default('medium'),
    startDate: text('start_date'),
    deadline: text('deadline'),
    archivedAt: integer('archived_at', { mode: 'timestamp' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  table => [
    index('projects_owner_idx').on(table.ownerId, table.archivedAt),
    check('projects_status', sql`${table.status} in ('planning', 'in_progress', 'completed')`),
    check('projects_priority', sql`${table.priority} in ('low', 'medium', 'high')`),
    check('projects_dates', sql`${table.startDate} is null or ${table.deadline} is null or ${table.deadline} >= ${table.startDate}`),
  ],
)

/**
 * What happened, for the dashboard and project pages. `subject` keeps the name of the project or
 * task at the time, so entries still read correctly after a rename or delete; `detail` holds
 * extra facts such as the columns a task moved between.
 */
export const activityLogs = sqliteTable(
  'activity_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    // No foreign key: an entry about a task outlives the task ("deleted task X").
    taskId: integer('task_id'),
    action: text('action').notNull(),
    subject: text('subject').notNull(),
    detail: text('detail', { mode: 'json' }).$type<Record<string, string>>(),
    createdAt: createdAt(),
  },
  table => [
    index('activity_user_idx').on(table.userId, table.createdAt),
    index('activity_project_idx').on(table.projectId, table.createdAt),
  ],
)

/**
 * Request counts for rate limiting, one row per action and client address ("login:203.0.113.7").
 * Kept in the database because serverless instances don't share memory.
 */
export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  resetAt: integer('reset_at', { mode: 'timestamp' }).notNull(),
})
