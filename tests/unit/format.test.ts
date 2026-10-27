import { describe, expect, it } from 'vitest'
import { addDays, dateIn, daysBetween, formatDate, relativeDay, timeZoneOffsetSeconds } from '../../shared/utils/dates'
import { formatClock, formatDuration, formatMinutes } from '../../shared/utils/format'

describe('durations', () => {
  it('formats tracked time', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(42.9)).toBe('42s')
    expect(formatDuration(60)).toBe('1m')
    expect(formatDuration(3 * 3600 + 5 * 60 + 59)).toBe('3h 05m')
    expect(formatDuration(26 * 3600 + 600)).toBe('26h 10m')
  })

  it('formats estimates and the running clock', () => {
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(90)).toBe('1.5h')
    expect(formatMinutes(120)).toBe('2h')
    expect(formatClock(247)).toBe('4:07')
    expect(formatClock(3729)).toBe('1:02:09')
  })
})

describe('calendar dates', () => {
  it('does day arithmetic across months and years', () => {
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(daysBetween('2026-03-01', '2026-03-31')).toBe(30)
    expect(daysBetween('2026-03-31', '2026-03-01')).toBe(-30)
  })

  it('says how far away a day is', () => {
    expect(relativeDay('2026-03-04', '2026-03-04')).toBe('today')
    expect(relativeDay('2026-03-05', '2026-03-04')).toBe('tomorrow')
    expect(relativeDay('2026-03-03', '2026-03-04')).toBe('yesterday')
    expect(relativeDay('2026-03-09', '2026-03-04')).toBe('in 5 days')
    expect(relativeDay('2026-02-25', '2026-03-04')).toBe('7 days ago')
    expect(formatDate('2026-03-04')).toBe('Mar 4, 2026')
  })

  it('finds the date and UTC offset in a time zone', () => {
    const instant = new Date('2026-03-04T17:30:00Z')
    expect(dateIn('Asia/Manila', instant)).toBe('2026-03-05')
    expect(dateIn('America/Los_Angeles', instant)).toBe('2026-03-04')
    expect(timeZoneOffsetSeconds('Asia/Manila', instant)).toBe(8 * 3600)
    expect(timeZoneOffsetSeconds('UTC', instant)).toBe(0)
    // New York switches to daylight time on 8 March 2026.
    expect(timeZoneOffsetSeconds('America/New_York', new Date('2026-03-07T12:00:00Z'))).toBe(-5 * 3600)
    expect(timeZoneOffsetSeconds('America/New_York', new Date('2026-03-09T12:00:00Z'))).toBe(-4 * 3600)
  })
})
