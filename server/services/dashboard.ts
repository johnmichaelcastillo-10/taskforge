import { and, asc, desc, eq, gte, isNotNull, isNull, lt, lte, ne, sql } from 'drizzle-orm'
import { projects, tasks } from '../database/schema'
import type { Executor } from '../utils/db'
import { listActivity } from './activity'
import { byWeek, completedPerDay, trackedPerDay, weekStart } from './analytics'
import { listProjects } from './projects'

const UPCOMING_DAYS = 14

/**
 * Everything the dashboard shows, from the database: no figure is stored or made up. `days` is
 * the period for "completed" and "tracked" (the last 7, 30 or 90 days, today included).
 */
export async function getDashboard(db: Executor, userId: number, timeZone: string, days: number) {
  const today = dateIn(timeZone)
  const period = { from: addDays(today, -(days - 1)), to: today }
  // Eight whole weeks for the chart, the current one included.
  const chartRange = { from: addDays(weekStart(today), -7 * 7), to: today }

  const [projectList, completed, tracked, chart, overdue, upcomingTasks, activity] = await Promise.all([
    listProjects(db, userId, { archived: false }),
    completedPerDay(db, userId, period, timeZone),
    trackedPerDay(db, userId, period, timeZone),
    completedPerDay(db, userId, chartRange, timeZone),
    openTasksDue(db, userId, { before: today }),
    openTasksDue(db, userId, { from: today, to: addDays(today, UPCOMING_DAYS) }),
    listActivity(db, userId, { limit: 8 }),
  ])

  const activeProjects = projectList.filter(project => project.status !== 'completed')
  const upcomingDeadlines = activeProjects
    .filter(project => project.deadline && project.deadline >= today && project.deadline <= addDays(today, UPCOMING_DAYS * 2))
    .map(project => ({ kind: 'project' as const, id: project.id, title: project.name, projectId: project.id, projectName: project.name, date: project.deadline! }))

  return {
    today,
    period,
    activeProjectCount: activeProjects.length,
    completedCount: completed.counts.reduce((sum, count) => sum + count, 0),
    trackedSeconds: tracked.seconds.reduce((sum, seconds) => sum + seconds, 0),
    overdueCount: overdue.length,
    weeklyCompleted: byWeek(chart.days, chart.counts),
    overdue: overdue.slice(0, 5),
    upcoming: [
      ...upcomingTasks.map(task => ({ kind: 'task' as const, id: task.id, title: task.title, projectId: task.projectId, projectName: task.projectName, date: task.dueDate! })),
      ...upcomingDeadlines,
    ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8),
    projects: activeProjects.slice(0, 6),
    activity,
  }
}

/** Unfinished tasks in active projects due before a day, or within a span of days. */
async function openTasksDue(db: Executor, userId: number, when: { before: string } | { from: string, to: string }) {
  return db
    .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, status: tasks.status, projectId: tasks.projectId, projectName: projects.name })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(
      eq(projects.ownerId, userId),
      isNull(projects.archivedAt),
      ne(tasks.status, 'done'),
      isNotNull(tasks.dueDate),
      'before' in when ? lt(tasks.dueDate, when.before) : and(gte(tasks.dueDate, when.from), lte(tasks.dueDate, when.to)),
    ))
    // Soonest first; on the same day, high priority first.
    .orderBy(asc(tasks.dueDate), desc(sql`${tasks.priority} = 'high'`))
}
