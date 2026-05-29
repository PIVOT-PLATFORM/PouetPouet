// Speaker time as M:SS, with a leading "-" for negative (over-time) values.
export function formatTime(seconds: number): string {
  const m = Math.floor(Math.abs(seconds) / 60)
  const s = Math.abs(seconds) % 60
  const sign = seconds < 0 ? '-' : ''
  return `${sign}${m}:${s.toString().padStart(2, '0')}`
}

// Total session length: "1h 05min" past the hour, otherwise "MM:SS".
export function formatSessionTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}min`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// Compact duration: "45s", "3min", or "3min 20s".
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}min ${s}s` : `${m}min`
}
