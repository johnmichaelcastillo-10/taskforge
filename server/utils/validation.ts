import type { H3Event } from 'h3'
import { z } from 'zod'

/**
 * Reads the JSON body and validates it. Invalid input gets a 400 whose `data.fieldErrors` maps
 * each field to its messages, so forms can show them next to the right input.
 */
export async function readValidBody<T extends z.ZodType>(event: H3Event, schema: T): Promise<z.output<T>> {
  const result = schema.safeParse(await readBody(event))
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: 'Check the highlighted fields.',
      data: { fieldErrors: z.flattenError(result.error).fieldErrors },
    })
  }
  return result.data
}
