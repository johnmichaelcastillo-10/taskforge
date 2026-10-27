import { and, eq, gte, isNotNull, isNull, lt, sql } from 'drizzle-orm'
import { projects, tasks, workSessions } from '../database/schema'
import type { Executor } from '../utils/db'

/*
 * Timestamps are stored in UTC. To count them per calendar day as the user sees it, each one is
 * shifted by the user's UTC offset before SQLite's date() takes the day. The offset is read once
 * per request, for the end of the range: across a daylight-saving change, entries within an hour
 * of midnight on the far side of it can land on the neighbouring day. Grouping happens in SQL;
 * the application only lines the results up against the list of days.
 */

export interface DayRange {
  from: string
  to: string
}

interface Window {
  days: string[]
  offset: number
  start: Date
  end: Date
}

function windowFor(range: DayRange, timeZone: string): Window {
  const days: string[] = []
  for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
    days.push(day)
  }
  const endOfRange = new Date(Date.parse(`${addDays(range.to, 1)}T00:00:00Z`))
  const offset = timeZoneOffsetSeconds(timeZone, endOfRange)
  return {
    days,
    offset,
    start: new Date(Date.parse(`${range.from}T00:00:00Z`) - offset * 1000),
    end: new Date(endOfRange.getTime() - offset * 1000),
  }
}

/** The Monday on or before a date. */
export function weekStart(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7))
}

function localDay(column: string, offset: number) {
  return sql<string>`date(${sql.raw(column)} + ${offset}, 'unixepoch')`
}

function alignToDays(days: string[], rows: { day: string, value: number }[]): number[] {
  const byDay = new Map(rows.map(row => [row.day, Number(row.value)]))
  return days.map(day => byDay.get(day) ?? 0)
}

/** Tasks completed per day, for the user's projects (archived ones included: the work happened). */
export async function completedPerDay(db: Executor, userId: number, range: DayRange, timeZone: string) {
  const w = windowFor(range, timeZone)
  const day = localDay('"tasks"."completed_at"', w.offset)
  const rows = await db
    .select({ day, value: sql<number>`count(*)` })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(eq(projects.ownerId, userId), gte(tasks.completedAt, w.start), lt(tasks.completedAt, w.end)))
    .groupBy(day)
  return { days: w.days, counts: alignToDays(w.days, rows) }
}

/** Seconds tracked per day, by the day each session started (the running one up to now). */
export async function trackedPerDay(db: Executor, userId: number, range: DayRange, timeZone: string) {
  const w = windowFor(range, timeZone)
  const day = localDay('"work_sessions"."started_at"', w.offset)
  const rows = await db
    .select({ day, value: sql<number>`sum(coalesce("work_sessions"."ended_at", unixepoch()) - "work_sessions"."started_at")` })
    .from(workSessions)
    .where(and(eq(workSessions.userId, userId), gte(workSessions.startedAt, w.start), lt(workSessions.startedAt, w.end)))
    .groupBy(day)
  return { days: w.days, seconds: alignToDays(w.days, rows) }
}

/** Daily values added up into Monday-to-Sunday weeks. */
export function byWeek(days: string[], values: number[]) {
  const weeks = new Map<string, number>()
  days.forEach((day, index) => {
    const week = weekStart(day)
    weeks.set(week, (weeks.get(week) ?? 0) + values[index]!)
  })
  return [...weeks].map(([start, total]) => ({ weekStart: start, total }))
}

/**
 * For tasks finished in the range that had an estimate: estimated against tracked time, per
 * project.
 */
export async function estimateVsActual(db: Executor, userId: number, range: DayRange, timeZone: string) {
  const w = windowFor(range, timeZone)
  const rows = await db
    .select({
      projectId: projects.id,
      projectName: projects.name,
      taskCount: sql<number>`count(*)`,
      estimatedSeconds: sql<number>`sum("tasks"."estimate_minutes") * 60`,
      trackedSeconds: sql<number>`sum((select coalesce(sum(coalesce(ws.ended_at, unixepoch()) - ws.started_at), 0)
        from work_sessions as ws where ws.task_id = "tasks"."id"))`,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(
      eq(projects.ownerId, userId),
      isNotNull(tasks.estimateMinutes),
      gte(tasks.completedAt, w.start),
      lt(tasks.completedAt, w.end),
    ))
    .groupBy(projects.id)
    .orderBy(projects.name)
  return rows.map(row => ({
    ...row,
    taskCount: Number(row.taskCount),
    estimatedSeconds: Number(row.estimatedSeconds),
    trackedSeconds: Number(row.trackedSeconds),
  }))
}

/** How many tasks sit in each column right now, across active projects. */
export async function statusCounts(db: Executor, userId: number) {
  const rows = await db
    .select({ status: tasks.status, count: sql<number>`count(*)` })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(eq(projects.ownerId, userId), isNull(projects.archivedAt)))
    .groupBy(tasks.status)
  return Object.fromEntries(TASK_STATUSES.map(status =>
    [status, Number(rows.find(row => row.status === status)?.count ?? 0)])) as Record<TaskStatus, number>
}

/**
 * Each active project's share of done tasks at the end of every day in the range, from the
 * tasks' completion times. A reopened task loses its completion time, so the history reflects
 * the tasks as they are now.
 */
export async function projectProgress(db: Executor, userId: number, range: DayRange, timeZone: string) {
  const w = windowFor(range, timeZone)
  const active = await db
    .select({
      id: projects.id,
      name: projects.name,
      total: sql<number>`(select count(*) from tasks as t where t.project_id = "projects"."id")`,
      doneBefore: sql<number>`(select count(*) from tasks as t where t.project_id = "projects"."id"
        and t.completed_at < ${Math.floor(w.start.getTime() / 1000)})`,
    })
    .from(projects)
    .where(and(eq(projects.ownerId, userId), isNull(projects.archivedAt)))
    .orderBy(projects.name)

  const day = localDay('"tasks"."completed_at"', w.offset)
  const daily = await db
    .select({ projectId: tasks.projectId, day, count: sql<number>`count(*)` })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(
      eq(projects.ownerId, userId),
      isNull(projects.archivedAt),
      gte(tasks.completedAt, w.start),
      lt(tasks.completedAt, w.end),
    ))
    .groupBy(tasks.projectId, day)

  return {
    days: w.days,
    projects: active
      .filter(project => Number(project.total) > 0)
      .map((project) => {
        let done = Number(project.doneBefore)
        const percents = w.days.map((d) => {
          done += Number(daily.find(row => row.projectId === project.id && row.day === d)?.count ?? 0)
          return Math.round((done / Number(project.total)) * 100)
        })
        return { projectId: project.id, name: project.name, percents }
      }),
  }
}
