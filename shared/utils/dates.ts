// Calendar dates are 'YYYY-MM-DD' strings with no time zone. "Today" depends on where the user
// is, so it's always computed in their time zone, the same way on the server and in the browser.

const DAY_MS = 86_400_000

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  }
  catch {
    return false
  }
}

/** The calendar date of an instant in a time zone. */
export function dateIn(timeZone: string, at: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

/** `date` moved by a number of days. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** "Mar 4, 2026": a calendar date for display. */
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(`${date}T00:00:00Z`))
}

/** "today", "tomorrow", "in 5 days", "3 days ago". */
export function relativeDay(date: string, today: string): string {
  const days = daysBetween(today, date)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  return days > 0 ? `in ${days} days` : `${-days} days ago`
}

/**
 * The time zone's offset from UTC, in seconds, at an instant. Used to group timestamps into
 * the user's calendar days in SQL; see server/services/analytics.ts.
 */
export function timeZoneOffsetSeconds(timeZone: string, at: Date = new Date()): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(at).map(part => [part.type, part.value]),
  )
  const asUtc = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!)
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 1000)
}
