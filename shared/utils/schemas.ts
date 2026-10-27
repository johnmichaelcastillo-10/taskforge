import { z } from 'zod'

// Shared by the forms (instant feedback) and the server routes (the check that counts).

const email = z.string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address.' }))

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
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
