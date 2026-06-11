import { describe, it, expect } from 'vitest'
import {
  countWorkingDays,
  absenceWorkingDays,
  computeMemberCapacity,
  computeEventCapacity,
  summarizeHistory,
} from './capacity.js'
import type { CapacityEvent, CapacityEventMember, CapacityAbsence } from './capacity.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MON_FRI = [1, 2, 3, 4, 5]

function makeEvent(overrides: Partial<CapacityEvent> = {}): CapacityEvent {
  return {
    id: 'ev-1',
    name: 'Sprint 1',
    ownerId: 'u1',
    teamId: null,
    parentId: null,
    type: 'SPRINT',
    status: 'PLANNING',
    startDate: '2026-06-01',
    endDate: '2026-06-12', // 2 weeks Mon-Fri = 10 working days
    workingDays: MON_FRI,
    hoursPerDay: 8,
    focusFactor: 0.8,
    pointsPerPersonDay: null,
    committedPoints: null,
    completedPoints: null,
    notes: null,
    members: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeMember(overrides: Partial<CapacityEventMember> = {}): CapacityEventMember {
  return {
    id: 'm-1',
    eventId: 'ev-1',
    name: 'Alice',
    role: 'Dev',
    fte: 1,
    focusFactor: null,
    order: 0,
    absences: [],
    ...overrides,
  }
}

function makeAbsence(overrides: Partial<CapacityAbsence> = {}): CapacityAbsence {
  return {
    id: 'abs-1',
    eventMemberId: 'm-1',
    startDate: '2026-06-02',
    endDate: '2026-06-02',
    fraction: 1,
    reason: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── countWorkingDays ───────────────────────────────────────────────────────────

describe('countWorkingDays', () => {
  it('counts Mon–Fri over a standard 2-week sprint', () => {
    // 2026-06-01 (Mon) → 2026-06-12 (Fri) = 10 working days
    expect(countWorkingDays('2026-06-01', '2026-06-12', MON_FRI)).toBe(10)
  })

  it('counts a single Monday as 1', () => {
    expect(countWorkingDays('2026-06-01', '2026-06-01', MON_FRI)).toBe(1)
  })

  it('counts 0 for a single Saturday (Mon-Fri schedule)', () => {
    expect(countWorkingDays('2026-06-06', '2026-06-06', MON_FRI)).toBe(0)
  })

  it('returns 0 when end is before start', () => {
    expect(countWorkingDays('2026-06-12', '2026-06-01', MON_FRI)).toBe(0)
  })

  it('returns 0 for the same day when not a working day', () => {
    expect(countWorkingDays('2026-06-07', '2026-06-07', MON_FRI)).toBe(0) // Sunday
  })

  it('counts weekends too when workingDays includes them', () => {
    expect(countWorkingDays('2026-06-01', '2026-06-07', [0, 1, 2, 3, 4, 5, 6])).toBe(7)
  })

  it('counts only Saturday when workingDays = [6]', () => {
    // 2026-06-01 (Mon) → 2026-06-07 (Sun) has one Saturday (2026-06-06)
    expect(countWorkingDays('2026-06-01', '2026-06-07', [6])).toBe(1)
  })
})

// ── absenceWorkingDays ────────────────────────────────────────────────────────

describe('absenceWorkingDays', () => {
  const event = makeEvent()

  it('counts the working days of an absence fully within the event', () => {
    const result = absenceWorkingDays({ startDate: '2026-06-02', endDate: '2026-06-02' }, event)
    expect(result).toBe(1)
  })

  it('clips an absence that starts before the event', () => {
    const result = absenceWorkingDays({ startDate: '2026-05-25', endDate: '2026-06-05' }, event)
    // Event starts 2026-06-01 (Mon). Mon→Fri = 5 working days
    expect(result).toBe(5)
  })

  it('clips an absence that extends beyond the event end', () => {
    const result = absenceWorkingDays({ startDate: '2026-06-10', endDate: '2026-06-30' }, event)
    // Event ends 2026-06-12. Wed+Thu+Fri = 3 days
    expect(result).toBe(3)
  })

  it('returns 0 when absence is outside the event entirely', () => {
    const result = absenceWorkingDays({ startDate: '2026-06-15', endDate: '2026-06-20' }, event)
    expect(result).toBe(0)
  })
})

// ── computeMemberCapacity ─────────────────────────────────────────────────────

describe('computeMemberCapacity', () => {
  const event = makeEvent()

  it('computes full-time capacity with no absences', () => {
    const member = makeMember()
    const cap = computeMemberCapacity(member, event)
    expect(cap.absentDays).toBe(0)
    expect(cap.netPersonDays).toBe(10)
    expect(cap.effectiveFocus).toBe(0.8)
    expect(cap.hours).toBe(64) // 10 × 8 × 0.8
    expect(cap.points).toBeNull()
  })

  it('computes points when pointsPerPersonDay is set', () => {
    const eventWithPpd = makeEvent({ pointsPerPersonDay: 2 })
    const member = makeMember()
    const cap = computeMemberCapacity(member, eventWithPpd)
    expect(cap.points).toBe(20) // 10 × 2
  })

  it('deducts absence working days, weighted by fraction', () => {
    const member = makeMember({
      absences: [makeAbsence({ startDate: '2026-06-01', endDate: '2026-06-05', fraction: 1 })],
    })
    const cap = computeMemberCapacity(member, event)
    expect(cap.absentDays).toBe(5)
    expect(cap.netPersonDays).toBe(5)
    expect(cap.hours).toBe(32) // 5 × 8 × 0.8
  })

  it('handles half-day absences (fraction = 0.5)', () => {
    const member = makeMember({
      absences: [makeAbsence({ startDate: '2026-06-01', endDate: '2026-06-02', fraction: 0.5 })],
    })
    const cap = computeMemberCapacity(member, event)
    expect(cap.absentDays).toBe(1) // 2 days × 0.5
    expect(cap.netPersonDays).toBe(9)
  })

  it('uses member focusFactor over event focusFactor when set', () => {
    const member = makeMember({ focusFactor: 0.5 })
    const cap = computeMemberCapacity(member, event)
    expect(cap.effectiveFocus).toBe(0.5)
    expect(cap.hours).toBe(40) // 10 × 8 × 0.5
  })

  it('handles 0.5 fte (part-time member)', () => {
    const member = makeMember({ fte: 0.5 })
    const cap = computeMemberCapacity(member, event)
    expect(cap.netPersonDays).toBe(5) // 10 × 0.5
    expect(cap.hours).toBe(32) // 5 × 8 × 0.8
  })

  it('netPersonDays cannot go below 0', () => {
    const member = makeMember({
      absences: [makeAbsence({ startDate: '2026-05-01', endDate: '2026-06-30', fraction: 1 })],
    })
    const cap = computeMemberCapacity(member, event)
    expect(cap.netPersonDays).toBe(0)
    expect(cap.hours).toBe(0)
  })
})

// ── computeEventCapacity ──────────────────────────────────────────────────────

describe('computeEventCapacity', () => {
  it('aggregates two members totals correctly', () => {
    const event = makeEvent({
      pointsPerPersonDay: 2,
      members: [makeMember({ id: 'm1', order: 0 }), makeMember({ id: 'm2', order: 1 })],
    })
    const cap = computeEventCapacity(event)
    expect(cap.totalWorkingDays).toBe(10)
    expect(cap.totalNetPersonDays).toBe(20)
    expect(cap.totalHours).toBe(128)
    expect(cap.totalPoints).toBe(40)
  })

  it('computes loadRatio = committedPoints / capacityPoints', () => {
    const event = makeEvent({
      pointsPerPersonDay: 2,
      committedPoints: 50,
      members: [makeMember()],
    })
    const cap = computeEventCapacity(event)
    expect(cap.loadRatio).toBe(2.5) // 50 / 20
  })

  it('loadRatio is null when no pointsPerPersonDay', () => {
    const event = makeEvent({ committedPoints: 30, members: [makeMember()] })
    const cap = computeEventCapacity(event)
    expect(cap.loadRatio).toBeNull()
  })

  it('computes predictability = completedPoints / committedPoints', () => {
    const event = makeEvent({ committedPoints: 20, completedPoints: 18, members: [] })
    const cap = computeEventCapacity(event)
    expect(cap.predictability).toBe(0.9)
  })

  it('predictability is null when committedPoints is zero', () => {
    const event = makeEvent({ committedPoints: 0, completedPoints: 5, members: [] })
    const cap = computeEventCapacity(event)
    expect(cap.predictability).toBeNull()
  })

  it('sorts members by order before aggregating', () => {
    const event = makeEvent({
      members: [
        makeMember({ id: 'm2', order: 1, name: 'Bob' }),
        makeMember({ id: 'm1', order: 0, name: 'Alice' }),
      ],
    })
    const cap = computeEventCapacity(event)
    expect(cap.members[0].member.name).toBe('Alice')
    expect(cap.members[1].member.name).toBe('Bob')
  })
})

// ── summarizeHistory ──────────────────────────────────────────────────────────

describe('summarizeHistory', () => {
  function makeHistoricEvent(completedPoints: number, committedPoints: number): CapacityEvent {
    return makeEvent({
      id: `hist-${completedPoints}`,
      completedPoints,
      committedPoints,
      pointsPerPersonDay: null,
      members: [makeMember()], // 10 net person-days
    })
  }

  it('returns null stats for empty history', () => {
    const { avgVelocity, avgPredictability, forecastPoints } = summarizeHistory([], makeEvent())
    expect(avgVelocity).toBeNull()
    expect(avgPredictability).toBeNull()
    expect(forecastPoints).toBeNull()
  })

  it('computes average realized velocity across past events', () => {
    // Sprint A: 20 pts, 10 person-days → velocity = 2
    // Sprint B: 30 pts, 10 person-days → velocity = 3
    // Weighted average by person-days (equal weight here) = 2.5
    const history = [makeHistoricEvent(20, 25), makeHistoricEvent(30, 35)]
    const { avgVelocity } = summarizeHistory(history, makeEvent())
    expect(avgVelocity).toBe(2.5)
  })

  it('computes average predictability across past events', () => {
    // 20/25 = 0.8; 18/20 = 0.9; avg = 0.85
    const history = [makeHistoricEvent(20, 25), makeHistoricEvent(18, 20)]
    const { avgPredictability } = summarizeHistory(history, makeEvent())
    expect(avgPredictability).toBe(0.85)
  })

  it('forecasts points for the current event using historical velocity', () => {
    // history velocity = 2 pt/person-day; current has 10 net person-days → 20
    const history = [makeHistoricEvent(20, 25)]
    const current = makeEvent({ members: [makeMember()] })
    const { forecastPoints } = summarizeHistory(history, current)
    expect(forecastPoints).toBe(20)
  })

  it('ignores past events without completedPoints for velocity', () => {
    const history = [
      makeHistoricEvent(20, 25),
      makeEvent({ id: 'no-completed', members: [makeMember()] }),
    ]
    const { avgVelocity } = summarizeHistory(history, makeEvent())
    expect(avgVelocity).toBe(2)
  })
})
