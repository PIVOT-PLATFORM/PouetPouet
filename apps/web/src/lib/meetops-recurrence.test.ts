import { describe, it, expect } from 'vitest'
import { expandRecurrence, MAX_OCCURRENCES } from '@pouetpouet/shared'

// Helper : "YYYY-MM-DD HH:mm" local pour des assertions lisibles.
function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

describe('expandRecurrence', () => {
  it('daily by count, every day', () => {
    const dates = expandRecurrence({ freq: 'DAILY', interval: 1, startDate: '2026-06-15T09:00:00', count: 3 })
    expect(dates.map(fmt)).toEqual(['2026-06-15 09:00', '2026-06-16 09:00', '2026-06-17 09:00'])
  })

  it('daily with interval 2', () => {
    const dates = expandRecurrence({ freq: 'DAILY', interval: 2, startDate: '2026-06-15T08:30:00', count: 3 })
    expect(dates.map(fmt)).toEqual(['2026-06-15 08:30', '2026-06-17 08:30', '2026-06-19 08:30'])
  })

  it('daily stops at until (inclusive)', () => {
    const dates = expandRecurrence({ freq: 'DAILY', interval: 1, startDate: '2026-06-15T09:00:00', until: '2026-06-17' })
    expect(dates).toHaveLength(3)
    expect(fmt(dates[2])).toBe('2026-06-17 09:00')
  })

  it('weekly on selected weekdays (Mon/Wed/Fri)', () => {
    // 2026-06-15 is a Monday. Mon=1, Wed=3, Fri=5.
    const dates = expandRecurrence({
      freq: 'WEEKLY', interval: 1, startDate: '2026-06-15T10:00:00', daysOfWeek: [1, 3, 5], count: 4,
    })
    expect(dates.map(fmt)).toEqual([
      '2026-06-15 10:00', // Mon
      '2026-06-17 10:00', // Wed
      '2026-06-19 10:00', // Fri
      '2026-06-22 10:00', // next Mon
    ])
  })

  it('weekly never emits dates before the anchor', () => {
    // Anchor is Wednesday 2026-06-17, but Monday is requested too — the Monday
    // of the anchor week (06-15) precedes the anchor and must be skipped.
    const dates = expandRecurrence({
      freq: 'WEEKLY', interval: 1, startDate: '2026-06-17T10:00:00', daysOfWeek: [1, 3], count: 3,
    })
    expect(fmt(dates[0])).toBe('2026-06-17 10:00')
    expect(dates.every((d) => d >= new Date('2026-06-17T10:00:00'))).toBe(true)
  })

  it('weekly with interval 2 skips a week', () => {
    const dates = expandRecurrence({
      freq: 'WEEKLY', interval: 2, startDate: '2026-06-15T09:00:00', daysOfWeek: [1], count: 3,
    })
    expect(dates.map(fmt)).toEqual(['2026-06-15 09:00', '2026-06-29 09:00', '2026-07-13 09:00'])
  })

  it('monthly keeps the day of month', () => {
    const dates = expandRecurrence({ freq: 'MONTHLY', interval: 1, startDate: '2026-01-15T14:00:00', count: 3 })
    expect(dates.map(fmt)).toEqual(['2026-01-15 14:00', '2026-02-15 14:00', '2026-03-15 14:00'])
  })

  it('monthly clamps to last day for short months', () => {
    // Jan 31 → Feb has no 31st → clamp to Feb 28 (2026 not leap).
    const dates = expandRecurrence({ freq: 'MONTHLY', interval: 1, startDate: '2026-01-31T09:00:00', count: 2 })
    expect(fmt(dates[1])).toBe('2026-02-28 09:00')
  })

  it('caps at MAX_OCCURRENCES even without an end condition', () => {
    const dates = expandRecurrence({ freq: 'DAILY', interval: 1, startDate: '2026-06-15T09:00:00' })
    expect(dates).toHaveLength(MAX_OCCURRENCES)
  })

  it('returns empty on invalid start date', () => {
    expect(expandRecurrence({ freq: 'DAILY', interval: 1, startDate: 'not-a-date', count: 5 })).toEqual([])
  })
})
