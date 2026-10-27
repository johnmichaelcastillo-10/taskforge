/** An estimate: "45m", "2h", "1.5h". */
export function formatMinutes(minutes: number): string {
  return minutes < 60 ? `${minutes}m` : `${+(minutes / 60).toFixed(1)}h`
}

/** Tracked time: "0m", "45m", "3h 05m", "26h 10m". */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours === 0 ? `${minutes}m` : `${hours}h ${String(minutes).padStart(2, '0')}m`
}

/** A running timer: "4:07", "1:02:09". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const rest = String(s % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}
