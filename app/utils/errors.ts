import type { FormError } from '@nuxt/ui'

// The body of an error response from a server route: createError's message, plus field errors
// from readValidBody() (server/utils/validation.ts).
interface ErrorBody {
  message?: string
  data?: { fieldErrors?: Record<string, string[] | undefined> }
}

function errorBody(error: unknown): ErrorBody | undefined {
  return (error as { data?: ErrorBody } | null)?.data
}

/** A message to show for a failed request. */
export function errorMessage(error: unknown): string {
  return errorBody(error)?.message ?? 'Something went wrong. Try again.'
}

/** Field errors from a failed request, in the shape forms take (UForm's setErrors). */
export function fieldErrors(error: unknown): FormError[] {
  const fields = errorBody(error)?.data?.fieldErrors ?? {}
  return Object.entries(fields).flatMap(([name, messages]) =>
    (messages ?? []).map(message => ({ name, message })))
}

/**
 * A redirect target from the query string, only if it's a path on this site. Anything else
 * (another origin, `//host`) falls back, so links can't send people off-site after sign-in.
 */
export function safeRedirect(value: unknown, fallback = '/dashboard'): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : fallback
}
