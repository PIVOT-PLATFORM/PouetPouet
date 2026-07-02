import { describe, it, expect } from 'vitest'
import { serializeTicket, type FeedbackTicketRow } from './feedback-serialize.js'

const base: FeedbackTicketRow = {
  id: 't1',
  title: 'Bug X',
  body: 'détails',
  type: 'BUG',
  column: 'ANALYSE',
  authorName: 'Alice',
  authorId: 'u-alice',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
}

describe('serializeTicket — votes', () => {
  it('votes = _count.votes (0 si absent)', () => {
    expect(serializeTicket(base, null).votes).toBe(0)
    expect(serializeTicket({ ...base, _count: { votes: 5 } }, null).votes).toBe(5)
  })

  it('hasVoted vrai quand l\'appelant a un vote dans la relation', () => {
    const t = { ...base, _count: { votes: 3 }, votes: [{ id: 'v1' }] }
    expect(serializeTicket(t, 'u-alice').hasVoted).toBe(true)
  })

  it('hasVoted faux quand l\'appelant n\'a pas de vote (relation vide)', () => {
    const t = { ...base, _count: { votes: 3 }, votes: [] }
    expect(serializeTicket(t, 'u-bob').hasVoted).toBe(false)
  })

  it('hasVoted faux pour un appelant anonyme (userId null)', () => {
    // Régression (code review) : hasVoted ne doit jamais dépendre d'un état global —
    // sans userId il est toujours false, même si des votes existent.
    const t = { ...base, _count: { votes: 3 }, votes: [{ id: 'v1' }] }
    expect(serializeTicket(t, null).hasVoted).toBe(false)
  })

  it('hasVoted faux quand la relation votes n\'est pas chargée (broadcast/patch)', () => {
    // Le payload d'un PATCH n'inclut pas la relation votes filtrée par user :
    // hasVoted retombe à false et c'est au client de préserver son état local.
    const t = { ...base, _count: { votes: 3 } }
    expect(serializeTicket(t, 'u-alice').hasVoted).toBe(false)
  })
})
