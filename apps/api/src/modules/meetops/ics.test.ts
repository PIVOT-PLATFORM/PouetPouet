import { describe, it, expect } from 'vitest'
import { buildIcsCalendar, icsFilename, type IcsMeeting } from './ics.js'

const meeting: IcsMeeting = {
  id: 'mtg1',
  title: 'Go/No-Go #1',
  startAt: new Date('2026-06-15T07:00:00.000Z'),
  durationMin: 30,
  location: 'Salle B12',
  agenda: 'Point 1; point 2',
  participants: [{ email: 'alice@exemple.fr', name: 'Alice' }],
}

// Les consommateurs .ics « déplient » les lignes (CRLF + espace) avant lecture.
const unfold = (ics: string) => ics.replace(/\r\n /g, '')

describe('buildIcsCalendar', () => {
  it('wraps events in a VCALENDAR with CRLF line endings', () => {
    const ics = buildIcsCalendar([meeting])
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('\r\n')
  })

  it('emits DTSTART/DTEND in UTC basic format with the duration applied', () => {
    const ics = unfold(buildIcsCalendar([meeting]))
    expect(ics).toContain('DTSTART:20260615T070000Z')
    expect(ics).toContain('DTEND:20260615T073000Z') // +30 min
  })

  it('escapes special characters in text fields', () => {
    const ics = unfold(buildIcsCalendar([meeting]))
    expect(ics).toContain('DESCRIPTION:Point 1\\; point 2')
  })

  it('includes attendees with CN and mailto', () => {
    const ics = unfold(buildIcsCalendar([meeting]))
    expect(ics).toContain('ATTENDEE;CN=Alice;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION:mailto:alice@exemple.fr')
  })

  it('marks cancelled meetings as STATUS:CANCELLED', () => {
    const ics = buildIcsCalendar([{ ...meeting, cancelled: true }])
    expect(ics).toContain('STATUS:CANCELLED')
  })

  it('adds an organizer when provided', () => {
    const ics = unfold(buildIcsCalendar([meeting], { organizerEmail: 'rte@exemple.fr', organizerName: 'RTE' }))
    expect(ics).toContain('ORGANIZER;CN=RTE:mailto:rte@exemple.fr')
  })

  it('emits one VEVENT per meeting', () => {
    const ics = buildIcsCalendar([meeting, { ...meeting, id: 'mtg2' }])
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
  })
})

describe('icsFilename', () => {
  it('slugifies and strips accents', () => {
    expect(icsFilename('Réunion Équipe Alpha')).toBe('reunion-equipe-alpha.ics')
  })
  it('falls back to meetops for empty labels', () => {
    expect(icsFilename('!!!')).toBe('meetops.ics')
  })
})
