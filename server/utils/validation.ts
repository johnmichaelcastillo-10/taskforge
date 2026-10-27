import type { H3Event } from 'h3'
import { z } from 'zod'

/**
 * Reads the JSON body and validates it. Invalid input gets a 400 whose `data.fieldErrors` maps
 * each field to its messages, so forms can show them next to the right input.
 */
export async function readValidBody<T extends z.ZodType>(event: H3Event, schema: T): Promise<z.output<T>> {
  return parseOrThrow(schema, await readBody(event))
}

/** The same for the query string, such as list filters. */
export function readValidQuery<T extends z.ZodType>(event: H3Event, schema: T): z.output<T> {
  return parseOrThrow(schema, getQuery(event))
}

/** A numeric id from the route (`/api/projects/:id`). Anything else is a 404, like a missing row. */
export function routeId(event: H3Event, name = 'id'): number {
  const id = Number(getRouterParam(event, name))
  if (!Number.isSafeInteger(id) || id < 1) {
    throw createError({ statusCode: 404, message: 'Not found.' })
  }
  return id
}

function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: 'Check the highlighted fields.',
      data: { fieldErrors: z.flattenError(result.error).fieldErrors },
    })
  }
  return result.data
}
