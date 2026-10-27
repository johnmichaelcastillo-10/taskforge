import { z } from 'zod'
import { PRIORITIES, PROJECT_STATUSES } from './constants'
import { isValidTimeZone } from './dates'

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
