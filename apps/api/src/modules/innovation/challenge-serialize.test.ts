import { describe, it, expect } from 'vitest'
import { serializeChallenge, type ChallengeRow } from './challenge-serialize.js'

const base: ChallengeRow = {
  id: 'c1',
  nom: 'Hackathon 2026',
  description: 'Un challenge trimestriel.',
  theme: null,
  status: 'DRAFT',
  opensAt: null,
  closesAt: null,
  ownerId: 'u-alice',
  orgUnitRef: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  _count: { entries: 0 },
}

describe('serializeChallenge', () => {
  it('entryCount = _count.entries', () => {
    expect(serializeChallenge(base).entryCount).toBe(0)
    expect(serializeChallenge({ ...base, _count: { entries: 4 } }).entryCount).toBe(4)
  })

  it('conserve le statut et les dates', () => {
    const opensAt = new Date('2026-02-01')
    const closesAt = new Date('2026-03-01')
    const s = serializeChallenge({ ...base, status: 'OPEN', opensAt, closesAt })
    expect(s.status).toBe('OPEN')
    expect(s.opensAt).toBe(opensAt)
    expect(s.closesAt).toBe(closesAt)
  })
})
