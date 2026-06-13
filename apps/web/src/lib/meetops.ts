// MeetOps — types partagés côté web + libellés d'affichage.
// Socle CRUD : événements → séries → réunions → participants.

export type MeetEventType = 'VERSION' | 'SPRINT' | 'COPIL' | 'COMOP' | 'RELEASE' | 'ONBOARDING' | 'CUSTOM'
export type MeetEventStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED'
export type MeetingStatus = 'DRAFT' | 'SENT' | 'UPDATED' | 'CANCELLED'
export type MeetingRsvp = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE'

export interface MeetingParticipant {
  id: string
  meetingId: string
  email: string
  name: string | null
  role: string | null
  rsvp: MeetingRsvp
}

export interface Meeting {
  id: string
  seriesId: string
  title: string
  startAt: string
  durationMin: number
  location: string | null
  agenda: string | null
  status: MeetingStatus
  participants: MeetingParticipant[]
  createdAt: string
  updatedAt: string
}

export interface MeetSeries {
  id: string
  eventId: string
  title: string
  recurrence: unknown | null
  defaultDurationMin: number
  defaultAgenda: string | null
  order: number
  meetings: Meeting[]
  createdAt: string
}

export interface MeetEvent {
  id: string
  ownerId: string
  name: string
  description: string | null
  type: MeetEventType
  status: MeetEventStatus
  startDate: string | null
  endDate: string | null
  color: string
  tags: string[]
  series: MeetSeries[]
  _count?: { series: number }
  createdAt: string
  updatedAt: string
}

export const EVENT_TYPE_LABELS: Record<MeetEventType, string> = {
  VERSION: 'Version',
  SPRINT: 'Sprint',
  COPIL: 'COPIL',
  COMOP: 'COMOP',
  RELEASE: 'Release',
  ONBOARDING: 'Onboarding',
  CUSTOM: 'Personnalisé',
}

export const EVENT_TYPE_EMOJI: Record<MeetEventType, string> = {
  VERSION: '🏷️',
  SPRINT: '🏃',
  COPIL: '🧭',
  COMOP: '⚙️',
  RELEASE: '🚀',
  ONBOARDING: '👋',
  CUSTOM: '🗓️',
}

export const EVENT_STATUS_LABELS: Record<MeetEventStatus, string> = {
  DRAFT: 'Brouillon',
  ACTIVE: 'Actif',
  CLOSED: 'Clôturé',
  ARCHIVED: 'Archivé',
}

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyée',
  UPDATED: 'Modifiée',
  CANCELLED: 'Annulée',
}

/** Compte le total de réunions de toutes les séries d'un événement. */
export function countMeetings(event: MeetEvent): number {
  return event.series.reduce((sum, s) => sum + s.meetings.length, 0)
}

// Les séries n'ont pas de couleur en base : on en dérive une depuis cette palette
// par ordre d'apparition dans l'événement (déterministe, sans migration).
export const SERIES_PALETTE = [
  '#93C5FD', '#86EFAC', '#FDBA74', '#C4B5FD', '#F9A8D4', '#5EEAD4', '#FCA5A5', '#FCD34D',
]

export function seriesColor(index: number): string {
  return SERIES_PALETTE[index % SERIES_PALETTE.length]
}

/** Formate "12 juin 2026 · 14:30". */
export function formatMeetingDate(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

/**
 * Télécharge un .ics depuis une route MeetOps. Le client api parse du JSON, or
 * ici la réponse est du text/calendar — on fetch en brut puis on déclenche un
 * download via Blob. Le token est lu comme dans lib/api.ts.
 */
export async function downloadIcs(path: string): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('Export impossible')
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const filename = /filename="?([^"]+)"?/.exec(disposition)?.[1] ?? 'meetops.ics'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
