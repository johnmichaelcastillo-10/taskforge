import { sql } from 'drizzle-orm'
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
// A relative import: drizzle-kit reads this file outside Nuxt, without its auto-imports.
import { PRIORITIES, PROJECT_STATUSES, TAG_COLORS, TASK_STATUSES } from '../../shared/utils/constants'

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
 * A task on a project's board. `position` orders it within its column (0 at the top).
 * `completed_at` is set exactly when the task is done: moving it to Done stamps it, reopening
 * clears it, and the CHECK keeps the two in step.
 */
export const tasks = sqliteTable(
  'tasks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status', { enum: TASK_STATUSES }).notNull().default('backlog'),
    priority: text('priority', { enum: PRIORITIES }).notNull().default('medium'),
    dueDate: text('due_date'),
    estimateMinutes: integer('estimate_minutes'),
    position: integer('position').notNull().default(0),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  table => [
    index('tasks_board_idx').on(table.projectId, table.status, table.position),
    index('tasks_due_idx').on(table.projectId, table.dueDate),
    index('tasks_completed_idx').on(table.completedAt),
    check('tasks_status', sql`${table.status} in ('backlog', 'todo', 'in_progress', 'done')`),
    check('tasks_priority', sql`${table.priority} in ('low', 'medium', 'high')`),
    check('tasks_estimate', sql`${table.estimateMinutes} is null or ${table.estimateMinutes} between 1 and 99999`),
    check('tasks_completed', sql`(${table.status} = 'done') = (${table.completedAt} is not null)`),
  ],
)

/** A user's labels for tasks. Names are unique per user, ignoring case. */
export const tags = sqliteTable(
  'tags',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ownerId: integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color', { enum: TAG_COLORS }).notNull().default('gray'),
    createdAt: createdAt(),
  },
  table => [
    uniqueIndex('tags_owner_name_idx').on(table.ownerId, sql`${table.name} collate nocase`),
    check('tags_color', sql.raw(`color in (${TAG_COLORS.map(color => `'${color}'`).join(', ')})`)),
  ],
)

export const taskTags = sqliteTable(
  'task_tags',
  {
    taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  },
  table => [
    primaryKey({ columns: [table.taskId, table.tagId] }),
    index('task_tags_tag_idx').on(table.tagId),
  ],
)

export const taskComments = sqliteTable(
  'task_comments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    authorId: integer('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: createdAt(),
  },
  table => [
    index('task_comments_task_idx').on(table.taskId, table.createdAt),
  ],
)

/**
 * Time spent on a task. A session with no `ended_at` is the running timer; the partial unique
 * index allows at most one per user, whatever the application code does. Durations are always
 * worked out from the two timestamps, both set by the server.
 */
export const workSessions = sqliteTable(
  'work_sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
    endedAt: integer('ended_at', { mode: 'timestamp' }),
  },
  table => [
    uniqueIndex('work_sessions_running_idx').on(table.userId).where(sql`${table.endedAt} is null`),
    index('work_sessions_user_idx').on(table.userId, table.startedAt),
    index('work_sessions_task_idx').on(table.taskId),
    check('work_sessions_order', sql`${table.endedAt} is null or ${table.endedAt} >= ${table.startedAt}`),
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
 * Personal access tokens for the REST API. Only a SHA-256 hash of each token is stored, so a
 * copy of the database can't be used to call the API; `prefix` (the start of the token) lets
 * people tell their tokens apart. A token is random and long, so a fast hash is enough here,
 * unlike a password.
 */
export const apiTokens = sqliteTable(
  'api_tokens',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    prefix: text('prefix').notNull(),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
    createdAt: createdAt(),
  },
  table => [
    index('api_tokens_user_idx').on(table.userId),
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
