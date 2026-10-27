import { z } from 'zod'
import { PRIORITIES, PROJECT_STATUSES, TAG_COLORS, TASK_STATUSES } from './constants'
import { daysBetween, isValidTimeZone } from './dates'

// Shared by the forms (instant feedback) and the server routes (the check that counts).

const email = z.string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address.' }))

export const timeZoneSchema = z.string()
  .max(64)
  .refine(isValidTimeZone, 'Unknown time zone.')

// The browser's time zone, sent when an account is created. Not something the visitor typed,
// so an unknown value is dropped (the account stays on UTC) rather than rejected.
const browserTimeZone = timeZoneSchema.optional().catch(undefined)

// The upper bound keeps password hashing (deliberately slow) from being abused with huge inputs.
const PASSWORD_MAX = 128

export const loginSchema = z.object({
  email,
  password: z.string()
    .min(1, 'Enter your password.')
    .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`),
})

export const registerSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Enter your name.')
    .max(80, 'Use at most 80 characters.'),
  email,
  password: z.string()
    .min(8, 'Use at least 8 characters.')
    .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`),
  timezone: browserTimeZone,
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>

export const demoSchema = z.object({
  timezone: browserTimeZone,
}).default({})

// A calendar date. Forms send '' for an empty date input, which means "no date".
const optionalDate = z.preprocess(
  value => (value === '' ? null : value),
  z.iso.date({ error: 'Use a date like 2026-03-04.' }).nullable(),
)

const projectFields = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(100, 'Use at most 100 characters.'),
  description: z.string().trim().max(2000, 'Use at most 2000 characters.'),
  status: z.enum(PROJECT_STATUSES, { error: 'Choose a status.' }),
  priority: z.enum(PRIORITIES, { error: 'Choose a priority.' }),
  startDate: optionalDate,
  deadline: optionalDate,
})

function deadlineAfterStart(value: { startDate?: string | null, deadline?: string | null }) {
  return !value.startDate || !value.deadline || value.deadline >= value.startDate
}
const deadlineMessage = { message: 'The deadline can’t be before the start date.', path: ['deadline'] }

export const projectCreateSchema = projectFields
  .extend({
    description: projectFields.shape.description.default(''),
    status: projectFields.shape.status.default('planning'),
    priority: projectFields.shape.priority.default('medium'),
    startDate: optionalDate.default(null),
    deadline: optionalDate.default(null),
  })
  .refine(deadlineAfterStart, deadlineMessage)

/** Any subset of fields; `archived` archives or restores the project. */
export const projectUpdateSchema = projectFields
  .partial()
  .extend({ archived: z.boolean().optional() })
  .refine(deadlineAfterStart, deadlineMessage)

export const projectFiltersSchema = z.object({
  archived: z.stringbool().default(false),
  status: z.enum(PROJECT_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
})

export type ProjectCreateData = z.output<typeof projectCreateSchema>

const id = z.coerce.number().int().positive()

const taskFields = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(200, 'Use at most 200 characters.'),
  description: z.string().trim().max(5000, 'Use at most 5000 characters.'),
  status: z.enum(TASK_STATUSES, { error: 'Choose a column.' }),
  priority: z.enum(PRIORITIES, { error: 'Choose a priority.' }),
  dueDate: optionalDate,
  // Minutes, entered as hours in the form. Up to 99,999 minutes (about 1,666 hours).
  estimateMinutes: z.number({ error: 'Enter a number of minutes.' })
    .int()
    .min(1, 'Use at least 1 minute.')
    .max(99_999, 'That’s more than 1,600 hours.')
    .nullable(),
  tagIds: z.array(id).max(10, 'Use at most 10 tags.'),
})

export const taskCreateSchema = taskFields.extend({
  projectId: id,
  description: taskFields.shape.description.default(''),
  status: taskFields.shape.status.default('backlog'),
  priority: taskFields.shape.priority.default('medium'),
  dueDate: optionalDate.default(null),
  estimateMinutes: taskFields.shape.estimateMinutes.default(null),
  tagIds: taskFields.shape.tagIds.default([]),
})

/** Any subset of fields. A new `status` puts the task at the bottom of that column. */
export const taskUpdateSchema = taskFields.partial()

/** Drag and drop, or "Move to…": the column, and the place in it (0 = top). */
export const taskMoveSchema = z.object({
  status: z.enum(TASK_STATUSES, { error: 'Choose a column.' }),
  position: z.number().int().min(0),
})

export const taskFiltersSchema = z.object({
  projectId: id.optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  tagId: id.optional(),
  q: z.string().trim().max(100).optional(),
})

export const tagSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(30, 'Use at most 30 characters.'),
  color: z.enum(TAG_COLORS).default('gray'),
})

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Write something first.').max(2000, 'Use at most 2000 characters.'),
})

export type TaskCreateData = z.output<typeof taskCreateSchema>

/** Start timing a task. `switch` stops a timer running on another task first. */
export const timerStartSchema = z.object({
  taskId: id,
  switch: z.boolean().default(false),
})

export const sessionFiltersSchema = z.object({
  taskId: id.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

/** A span of calendar days, both ends included, at most a year. */
export const dateRangeSchema = z.object({
  from: z.iso.date({ error: 'Use a date like 2026-03-04.' }),
  to: z.iso.date({ error: 'Use a date like 2026-03-04.' }),
})
  .refine(range => range.from <= range.to, { message: 'The start must be before the end.', path: ['to'] })
  .refine(range => daysBetween(range.from, range.to) < 366, { message: 'Choose at most a year.', path: ['to'] })

export const tokenCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name the token, such as “CI script”.').max(60, 'Use at most 60 characters.'),
})

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80, 'Use at most 80 characters.'),
  timezone: timeZoneSchema,
}).partial()

export const dashboardQuerySchema = z.object({
  days: z.coerce.number().pipe(z.union([z.literal(7), z.literal(30), z.literal(90)])).default(7),
})
