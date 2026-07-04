import { describe, it, expect } from 'vitest'
import { INNOVATION_BADGES, computePoints } from './innovation-badges.js'

describe('computePoints', () => {
  it('pondère fiches ×1, votes reçus ×2, challenges gagnés ×5', () => {
    expect(computePoints({ ficheCount: 3, votesReceived: 2, challengesWon: 1 })).toBe(3 + 4 + 5)
  })

  it('zéro contribution → zéro point', () => {
    expect(computePoints({ ficheCount: 0, votesReceived: 0, challengesWon: 0 })).toBe(0)
  })
})

describe('INNOVATION_BADGES thresholds', () => {
  const badge = (id: string) => INNOVATION_BADGES.find((b) => b.id === id)!

  it('first-fiche : 0 fiche → non obtenu, 1 fiche → obtenu', () => {
    expect(badge('first-fiche').check({ ficheCount: 0, votesReceived: 0, challengesWon: 0 })).toBe(false)
    expect(badge('first-fiche').check({ ficheCount: 1, votesReceived: 0, challengesWon: 0 })).toBe(true)
  })

  it('five-fiches : 4 fiches → non obtenu, 5 → obtenu', () => {
    expect(badge('five-fiches').check({ ficheCount: 4, votesReceived: 0, challengesWon: 0 })).toBe(false)
    expect(badge('five-fiches').check({ ficheCount: 5, votesReceived: 0, challengesWon: 0 })).toBe(true)
  })

  it('ten-votes : 9 votes → non obtenu, 10 → obtenu', () => {
    expect(badge('ten-votes').check({ ficheCount: 0, votesReceived: 9, challengesWon: 0 })).toBe(false)
    expect(badge('ten-votes').check({ ficheCount: 0, votesReceived: 10, challengesWon: 0 })).toBe(true)
  })

  it('first-win : 0 challenge gagné → non obtenu, 1 → obtenu', () => {
    expect(badge('first-win').check({ ficheCount: 0, votesReceived: 0, challengesWon: 0 })).toBe(false)
    expect(badge('first-win').check({ ficheCount: 0, votesReceived: 0, challengesWon: 1 })).toBe(true)
  })
})
