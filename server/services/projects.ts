import { and, desc, eq, getTableColumns, isNotNull, isNull, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { projects } from '../database/schema'
import type { Executor } from '../utils/db'
import { logActivity } from './activity'

/** A project with its task counts, from which progress is worked out. */
export type Project = typeof projects.$inferSelect & { taskCount: number, doneCount: number }

// Written out in SQL: in a single-table select Drizzle leaves column names unqualified, and an
// unqualified "id" inside the subquery would mean the task's id, not the project's.
const withCounts = {
  ...getTableColumns(projects),
  taskCount: sql<number>`(select count(*) from tasks as t where t.project_id = "projects"."id")`,
  doneCount: sql<number>`(select count(*) from tasks as t where t.project_id = "projects"."id" and t.status = 'done')`,
}

type Filters = z.output<typeof projectFiltersSchema>
type CreateInput = z.output<typeof projectCreateSchema>
type UpdateInput = z.output<typeof projectUpdateSchema>

/** `%` and `_` typed into a search box are literal characters, not wildcards. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, char => `\\${char}`)}%`
}

export async function listProjects(db: Executor, ownerId: number, filters: Filters): Promise<Project[]> {
  return db
    .select(withCounts)
    .from(projects)
    .where(and(
      eq(projects.ownerId, ownerId),
      filters.archived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt),
      filters.status ? eq(projects.status, filters.status) : undefined,
      filters.q ? sql`${projects.name} like ${likePattern(filters.q)} escape '\\'` : undefined,
    ))
    // Work under way first, then planned, then finished; within each, the nearest deadline
    // first and projects without one last.
    .orderBy(
      sql`case ${projects.status} when 'in_progress' then 0 when 'planning' then 1 else 2 end`,
      sql`${projects.deadline} is null`,
      projects.deadline,
      desc(projects.id),
    )
}

/**
 * The project if it belongs to `ownerId`. Someone else's project gets the same 404 as a
 * missing one, so ids can't be probed.
 */
export async function getProject(db: Executor, ownerId: number, id: number): Promise<Project> {
  const [project] = await db
    .select(withCounts)
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
  if (!project) {
    throw createError({ statusCode: 404, message: 'Project not found.' })
  }
  return project
}

/** Archived projects are read-only: throws 409 for any change other than restoring. */
export function assertEditable(project: Project) {
  if (project.archivedAt) {
    throw createError({ statusCode: 409, message: 'This project is archived. Restore it to make changes.' })
  }
}

export async function createProject(db: Executor, ownerId: number, input: CreateInput): Promise<Project> {
  return db.transaction(async (tx) => {
    const [project] = await tx.insert(projects).values({ ...input, ownerId }).returning()
    await logActivity(tx, { userId: ownerId, projectId: project!.id, action: 'project.created', subject: project!.name })
    return { ...project!, taskCount: 0, doneCount: 0 }
  })
}

export async function updateProject(db: Executor, ownerId: number, id: number, input: UpdateInput): Promise<Project> {
  const { archived, ...fields } = input
  const changes = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Partial<typeof fields>

  return db.transaction(async (tx) => {
    const project = await getProject(tx, ownerId, id)
    const restoring = archived === false && project.archivedAt !== null
    const archiving = archived === true && project.archivedAt === null
    if (Object.keys(changes).length > 0 && !restoring) {
      assertEditable(project)
    }

    // The schema checks dates sent together; a change to one is checked against the other.
    const startDate = changes.startDate !== undefined ? changes.startDate : project.startDate
    const deadline = changes.deadline !== undefined ? changes.deadline : project.deadline
    if (startDate && deadline && deadline < startDate) {
      throw createError({
        statusCode: 400,
        message: 'Check the highlighted fields.',
        data: { fieldErrors: { deadline: ['The deadline can’t be before the start date.'] } },
      })
    }

    if (Object.keys(changes).length === 0 && !archiving && !restoring) {
      return project
    }

    const [updated] = await tx
      .update(projects)
      .set({
        ...changes,
        ...(archiving ? { archivedAt: new Date() } : {}),
        ...(restoring ? { archivedAt: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning()

    const base = { userId: ownerId, projectId: id, subject: updated!.name }
    if (changes.status && changes.status !== project.status) {
      await logActivity(tx, { ...base, action: 'project.status', detail: { from: project.status, to: changes.status } })
    }
    const otherChanges = Object.keys(changes).filter(key => key !== 'status')
    if (otherChanges.length > 0) {
      await logActivity(tx, { ...base, action: 'project.updated' })
    }
    if (archiving) {
      await logActivity(tx, { ...base, action: 'project.archived' })
    }
    if (restoring) {
      await logActivity(tx, { ...base, action: 'project.restored' })
    }
    return { ...updated!, taskCount: project.taskCount, doneCount: project.doneCount }
  })
}

/** Deletes the project with everything in it (by cascade). Allowed while archived. */
export async function deleteProject(db: Executor, ownerId: number, id: number) {
  await db.transaction(async (tx) => {
    const project = await getProject(tx, ownerId, id)
    await tx.delete(projects).where(eq(projects.id, id))
    // No projectId: the project's own entries go with it, this one stays in the user's feed.
    await logActivity(tx, { userId: ownerId, action: 'project.deleted', subject: project.name })
  })
}
