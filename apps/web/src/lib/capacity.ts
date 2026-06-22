// ──────────────────────────────────────────────────────────────────────────────
// Capacity planning — pure calculation helpers (no React, no I/O).
//
// Model of the maths used across the module:
//   • A "working day" is a calendar day whose weekday is in `workingDays`
//     (0 = Sunday … 6 = Saturday). Defaults to Mon–Fri.
//   • A member contributes `fte` of a full day (1 = full-time, 0.5 = half-time).
//   • An absence removes working days within its overlap with the period, weighted
//     by `fraction` (1 = full day off, 0.5 = half-day).
//   • net person-days = fte × (workingDays − Σ absenceWorkingDays × fraction)
//   • hours capacity   = net person-days × hoursPerDay × focusFactor
//   • points capacity  = net person-days × pointsPerPersonDay
//       (pointsPerPersonDay is the *empirical net velocity* — focus already baked
//        in — which is why the history feedback derives it from past actuals.)
// ──────────────────────────────────────────────────────────────────────────────

export type CapacityEventType = 'PI_PLANNING' | 'SPRINT' | 'RELEASE' | 'CUSTOM'
export type CapacityEventStatus = 'PLANNING' | 'ACTIVE' | 'DONE'

export interface CapacityAbsence {
  id: string
  eventMemberId: string
  startDate: string
  endDate: string
  fraction: number
  reason: string | null
  createdAt: string
}

export interface CapacityEventMember {
  id: string
  eventId: string
  name: string
  role: string | null
  fte: number
  focusFactor: number | null
  order: number
  absences: CapacityAbsence[]
}

export interface CapacityTeamMember {
  id: string
  teamId: string
  name: string
  role: string | null
  fte: number | null
  order: number
}

export interface CapacityTeam {
  id: string
  name: string
  ownerId: string
  color: string
  description: string | null
  members: CapacityTeamMember[]
  _count?: { capacityEvents: number }
  createdAt: string
  updatedAt: string
}

export interface CapacityEvent {
  id: string
  name: string
  ownerId: string
  teamId: string | null
  parentId: string | null
  type: CapacityEventType
  status: CapacityEventStatus
  startDate: string
  endDate: string
  workingDays: number[]
  hoursPerDay: number
  focusFactor: number
  pointsPerPersonDay: number | null
  committedPoints: number | null
  completedPoints: number | null
  notes: string | null
  team?: { id: string; name: string; color: string } | null
  parent?: { id: string; name: string; type?: CapacityEventType } | null
  children?: { id: string; name: string; type: CapacityEventType; status: CapacityEventStatus }[]
  members: CapacityEventMember[]
  _count?: { members: number; children: number }
  role?: 'OWNER' | 'EDITOR' | 'VIEWER'
  createdAt: string
  updatedAt: string
}

// ── Labels ──────────────────────────────────────────────────────────────────

export const EVENT_TYPE_LABELS: Record<CapacityEventType, string> = {
  PI_PLANNING: 'PI Planning',
  SPRINT: 'Sprint',
  RELEASE: 'Release',
  CUSTOM: 'Personnalisé',
}

export const EVENT_TYPE_EMOJI: Record<CapacityEventType, string> = {
  PI_PLANNING: '🗓️',
  SPRINT: '🏃',
  RELEASE: '🚀',
  CUSTOM: '📌',
}

export const EVENT_STATUS_LABELS: Record<CapacityEventStatus, { label: string; cls: string }> = {
  PLANNING: { label: 'Planification', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
  ACTIVE: { label: 'En cours', cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' },
  DONE: { label: 'Terminé', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
}

export const WEEKDAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

// ── Date helpers ──────────────────────────────────────────────────────────────

// Parse a date string to a UTC-noon Date so weekday arithmetic is DST-proof.
function dayKey(d: string | Date): Date {
  const date = typeof d === 'string' ? new Date(d) : d
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12))
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d)
  next.setUTCDate(next.getUTCDate() + n)
  return next
}

/** Count calendar days (inclusive) between two dates whose weekday is a working day. */
export function countWorkingDays(start: string | Date, end: string | Date, workingDays: number[]): number {
  const s = dayKey(start)
  const e = dayKey(end)
  if (e < s) return 0
  const set = new Set(workingDays)
  let count = 0
  for (let cur = s; cur <= e; cur = addDays(cur, 1)) {
    if (set.has(cur.getUTCDay())) count++
  }
  return count
}

/** Working days of an absence that fall inside the event period (before fraction). */
export function absenceWorkingDays(
  absence: Pick<CapacityAbsence, 'startDate' | 'endDate'>,
  event: Pick<CapacityEvent, 'startDate' | 'endDate' | 'workingDays'>,
): number {
  const s = dayKey(absence.startDate) < dayKey(event.startDate) ? event.startDate : absence.startDate
  const e = dayKey(absence.endDate) > dayKey(event.endDate) ? event.endDate : absence.endDate
  return countWorkingDays(s, e, event.workingDays)
}

// ── Per-member computation ────────────────────────────────────────────────────

export interface MemberCapacity {
  member: CapacityEventMember
  effectiveFocus: number
  absentDays: number // weighted working days lost to absences (before fte)
  netPersonDays: number
  hours: number
  points: number | null
}

export function computeMemberCapacity(member: CapacityEventMember, event: CapacityEvent): MemberCapacity {
  const totalWorkingDays = countWorkingDays(event.startDate, event.endDate, event.workingDays)
  const absentDays = member.absences.reduce(
    (sum, a) => sum + absenceWorkingDays(a, event) * a.fraction,
    0,
  )
  const availableDays = Math.max(0, totalWorkingDays - absentDays)
  const netPersonDays = round2(availableDays * member.fte)
  const effectiveFocus = member.focusFactor ?? event.focusFactor
  const hours = round2(netPersonDays * event.hoursPerDay * effectiveFocus)
  const points = event.pointsPerPersonDay != null ? round2(netPersonDays * event.pointsPerPersonDay) : null
  return { member, effectiveFocus, absentDays: round2(absentDays), netPersonDays, hours, points }
}

export interface EventCapacity {
  totalWorkingDays: number
  members: MemberCapacity[]
  totalNetPersonDays: number
  totalHours: number
  totalPoints: number | null
  // Planning deltas vs committed/completed (only when those are filled in).
  committed: number | null
  completed: number | null
  loadRatio: number | null // committedPoints / capacityPoints
  predictability: number | null // completedPoints / committedPoints
}

export function computeEventCapacity(event: CapacityEvent): EventCapacity {
  const totalWorkingDays = countWorkingDays(event.startDate, event.endDate, event.workingDays)
  // Défensif : un événement issu d'une réponse allégée peut arriver sans membres
  const members = [...(event.members ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((m) => computeMemberCapacity(m, event))
  const totalNetPersonDays = round2(members.reduce((s, m) => s + m.netPersonDays, 0))
  const totalHours = round2(members.reduce((s, m) => s + m.hours, 0))
  const totalPoints = event.pointsPerPersonDay != null
    ? round2(members.reduce((s, m) => s + (m.points ?? 0), 0))
    : null
  const loadRatio = totalPoints && event.committedPoints != null && totalPoints > 0
    ? round2(event.committedPoints / totalPoints)
    : null
  const predictability = event.committedPoints != null && event.completedPoints != null && event.committedPoints > 0
    ? round2(event.completedPoints / event.committedPoints)
    : null
  return {
    totalWorkingDays,
    members,
    totalNetPersonDays,
    totalHours,
    totalPoints,
    committed: event.committedPoints,
    completed: event.completedPoints,
    loadRatio,
    predictability,
  }
}

// ── Historical realization feedback ───────────────────────────────────────────

export interface HistoryStat {
  event: CapacityEvent
  netPersonDays: number
  realizedVelocity: number | null // completedPoints / netPersonDays
  predictability: number | null // completedPoints / committedPoints
}

export interface HistorySummary {
  stats: HistoryStat[]
  avgVelocity: number | null // person-day-weighted average realized velocity
  avgPredictability: number | null
  // Forecast for the *current* event using the historical average velocity.
  forecastPoints: number | null
}

export function summarizeHistory(history: CapacityEvent[], current: CapacityEvent): HistorySummary {
  const stats: HistoryStat[] = history.map((ev) => {
    const cap = computeEventCapacity(ev)
    const realizedVelocity = ev.completedPoints != null && cap.totalNetPersonDays > 0
      ? round2(ev.completedPoints / cap.totalNetPersonDays)
      : null
    const predictability = ev.completedPoints != null && ev.committedPoints != null && ev.committedPoints > 0
      ? round2(ev.completedPoints / ev.committedPoints)
      : null
    return { event: ev, netPersonDays: cap.totalNetPersonDays, realizedVelocity, predictability }
  })

  // Velocity weighted by the size (net person-days) of each past event.
  const velStats = stats.filter((s) => s.realizedVelocity != null && s.netPersonDays > 0)
  const totalDays = velStats.reduce((s, x) => s + x.netPersonDays, 0)
  const avgVelocity = totalDays > 0
    ? round2(velStats.reduce((s, x) => s + (x.realizedVelocity as number) * x.netPersonDays, 0) / totalDays)
    : null

  const predStats = stats.filter((s) => s.predictability != null)
  const avgPredictability = predStats.length > 0
    ? round2(predStats.reduce((s, x) => s + (x.predictability as number), 0) / predStats.length)
    : null

  const currentCap = computeEventCapacity(current)
  const forecastPoints = avgVelocity != null
    ? round2(currentCap.totalNetPersonDays * avgVelocity)
    : null

  return { stats, avgVelocity, avgPredictability, forecastPoints }
}

// ── Misc ──────────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function formatDateRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const s = new Date(start).toLocaleDateString('fr-FR', opts)
  const e = new Date(end).toLocaleDateString('fr-FR', { ...opts, year: 'numeric' })
  return `${s} → ${e}`
}

export function toDateInput(iso: string): string {
  // yyyy-mm-dd for <input type="date">
  const d = new Date(iso)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}
