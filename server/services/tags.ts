import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { tags } from '../database/schema'
import type { Executor } from '../utils/db'

export async function listTags(db: Executor, ownerId: number) {
  return db.select().from(tags).where(eq(tags.ownerId, ownerId)).orderBy(asc(sql`${tags.name} collate nocase`))
}

export async function createTag(db: Executor, ownerId: number, input: z.output<typeof tagSchema>) {
  const [tag] = await db.insert(tags).values({ ...input, ownerId }).onConflictDoNothing().returning()
  if (!tag) {
    throw createError({
      statusCode: 409,
      message: 'You already have a tag with this name.',
      data: { fieldErrors: { name: ['You already have a tag with this name.'] } },
    })
  }
  return tag
}

export async function deleteTag(db: Executor, ownerId: number, id: number) {
  const deleted = await db.delete(tags).where(and(eq(tags.id, id), eq(tags.ownerId, ownerId))).returning({ id: tags.id })
  if (deleted.length === 0) {
    throw createError({ statusCode: 404, message: 'Tag not found.' })
  }
}

/** Throws 400 unless every id is one of the user's own tags. */
export async function assertOwnTags(db: Executor, ownerId: number, tagIds: number[]) {
  const unique = [...new Set(tagIds)]
  if (unique.length === 0) {
    return
  }
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tags)
    .where(and(eq(tags.ownerId, ownerId), inArray(tags.id, unique)))
  if (row!.count !== unique.length) {
    throw createError({
      statusCode: 400,
      message: 'Check the highlighted fields.',
      data: { fieldErrors: { tagIds: ['One of these tags doesn’t exist.'] } },
    })
  }
}
