// MeetOps — types partagés côté web + libellés d'affichage.
// Socle CRUD : événements → réunions → participants (liste à plat).

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
  eventId: string
  title: string
  label: string | null
  order: number
  startAt: string
  durationMin: number
  location: string | null
  agenda: string | null
  status: MeetingStatus
  externalId: string | null
  teamsUrl: string | null
  sendError: string | null
  participants: MeetingParticipant[]
  createdAt: string
  updatedAt: string
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
  meetings: Meeting[]
  _count?: { meetings: number }
  role?: 'OWNER' | 'EDITOR' | 'VIEWER'
  createdAt: string
  updatedAt: string
}

export interface MeetDistMember {
  id: string
  listId: string
  email: string
  name: string | null
  role: string | null
}

export interface MeetDistList {
  id: string
  ownerId: string
  eventId: string | null
  name: string
  members: MeetDistMember[]
  _count?: { members: number }
  createdAt: string
  updatedAt: string
}

export interface MeetHistory {
  id: string
  eventId: string
  meetingId: string | null
  meetingTitle: string | null
  userId: string | null
  action: string
  field: string | null
  oldValue: string | null
  newValue: string | null
  createdAt: string
}

export interface MeetTemplateLine {
  label: string | null
  title: string
  durationMin: number
  dayOffset: number
  time: string
}

export interface MeetTemplate {
  id: string
  ownerId: string
  name: string
  description: string | null
  type: MeetEventType
  color: string
  lines: MeetTemplateLine[]
  isShared: boolean
  _count?: { events: number }
  createdAt: string
  updatedAt: string
}

export interface MeetCalendarMeeting {
  id: string
  title: string
  label: string | null
  startAt: string
  durationMin: number
  status: MeetingStatus
}

export interface MeetCalendarEvent {
  id: string
  name: string
  color: string
  type: MeetEventType
  status: MeetEventStatus
  meetings: MeetCalendarMeeting[]
}

export interface MeetSearchResult {
  id: string
  name: string
  description: string | null
  color: string
  type: MeetEventType
  status: MeetEventStatus
  _count?: { meetings: number }
  matched: { id: string; title: string; label: string | null }[]
}

export const HISTORY_ACTION_LABELS: Record<string, string> = {
  created: 'Créée',
  updated: 'Modifiée',
  deleted: 'Supprimée',
  sent: 'Envoyée',
  reordered: 'Réorganisées',
  bulk: 'Action de masse',
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

/** Compte le total de réunions d'un événement. */
export function countMeetings(event: MeetEvent): number {
  return event.meetings.length
}

// Palette de couleurs pour les étiquettes de réunion (calendrier + tableau).
export const LABEL_PALETTE = [
  '#93C5FD', '#86EFAC', '#FDBA74', '#C4B5FD', '#F9A8D4', '#5EEAD4', '#FCA5A5', '#FCD34D',
]

// Couleur déterministe dérivée du texte de l'étiquette (stable entre les rendus).
// null/'' → gris neutre.
export function labelColor(label: string | null | undefined): string {
  if (!label) return '#CBD5E1'
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) | 0
  return LABEL_PALETTE[Math.abs(hash) % LABEL_PALETTE.length]
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
