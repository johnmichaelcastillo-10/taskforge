import { byWeek, completedPerDay, estimateVsActual, projectProgress, statusCounts, trackedPerDay } from '../services/analytics'

/** Charts for `?from=YYYY-MM-DD&to=YYYY-MM-DD` (at most a year), in the user's time zone. */
export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const range = readValidQuery(event, dateRangeSchema)
  const db = await useDb()
  const zone = account.timezone

  const [completed, tracked, estimates, statuses, progress] = await Promise.all([
    completedPerDay(db, account.id, range, zone),
    trackedPerDay(db, account.id, range, zone),
    estimateVsActual(db, account.id, range, zone),
    statusCounts(db, account.id),
    projectProgress(db, account.id, range, zone),
  ])

  return {
    range,
    days: completed.days,
    completedPerDay: completed.counts,
    trackedPerDay: tracked.seconds,
    trackedPerWeek: byWeek(tracked.days, tracked.seconds),
    estimateVsActual: estimates,
    statusCounts: statuses,
    projectProgress: progress.projects,
    totals: {
      completed: completed.counts.reduce((sum, n) => sum + n, 0),
      trackedSeconds: tracked.seconds.reduce((sum, n) => sum + n, 0),
    },
  }
})
