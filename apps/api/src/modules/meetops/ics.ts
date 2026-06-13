// MeetOps — génération iCalendar (RFC 5545) pour l'export .ics.
// Fonction pure : prend des réunions normalisées et produit le texte du calendrier.
// Aucun accès base / réseau ici (testable isolément).

export interface IcsParticipant {
  email: string
  name?: string | null
  role?: string | null
}

export interface IcsMeeting {
  id: string
  title: string
  startAt: Date
  durationMin: number
  location?: string | null
  agenda?: string | null
  cancelled?: boolean
  participants?: IcsParticipant[]
}

export interface IcsOptions {
  calendarName?: string
  organizerEmail?: string | null
  organizerName?: string | null
}

// Échappe les caractères spéciaux d'une valeur texte iCalendar.
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// Format date UTC : 20260615T070000Z
function formatUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// Repli des lignes à 75 octets (RFC 5545 §3.1) : continuation préfixée d'un espace.
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 74) {
    parts.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  if (rest.length) parts.push(' ' + rest)
  return parts.join('\r\n')
}

function buildEvent(m: IcsMeeting, opts: IcsOptions, stamp: string): string[] {
  const end = new Date(m.startAt.getTime() + m.durationMin * 60_000)
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${m.id}@pivot`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${formatUtc(m.startAt)}`,
    `DTEND:${formatUtc(end)}`,
    `SUMMARY:${escapeText(m.title)}`,
    `STATUS:${m.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
  ]
  if (m.location) lines.push(`LOCATION:${escapeText(m.location)}`)
  if (m.agenda) lines.push(`DESCRIPTION:${escapeText(m.agenda)}`)
  if (opts.organizerEmail) {
    const cn = opts.organizerName ? `;CN=${escapeText(opts.organizerName)}` : ''
    lines.push(`ORGANIZER${cn}:mailto:${opts.organizerEmail}`)
  }
  for (const p of m.participants ?? []) {
    const cn = p.name ? `;CN=${escapeText(p.name)}` : ''
    lines.push(`ATTENDEE${cn};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION:mailto:${p.email}`)
  }
  lines.push('END:VEVENT')
  return lines
}

/** Construit le texte d'un calendrier .ics (CRLF, lignes repliées). */
export function buildIcsCalendar(meetings: IcsMeeting[], opts: IcsOptions = {}): string {
  const stamp = formatUtc(new Date())
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pivot//MeetOps//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  if (opts.calendarName) lines.push(`X-WR-CALNAME:${escapeText(opts.calendarName)}`)
  for (const m of meetings) lines.push(...buildEvent(m, opts, stamp))
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/** Nom de fichier sûr dérivé d'un libellé (accents retirés). */
export function icsFilename(label: string): string {
  const slug = label.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'meetops'
  return `${slug}.ics`
}
