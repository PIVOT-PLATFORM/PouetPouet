import { describe, it, expect } from 'vitest'
import { serializeFiche, type InnovationFicheRow } from './innovation-serialize.js'

const base: InnovationFicheRow = {
  id: 'f1',
  title: 'Assistant IA interne',
  pitch: 'Un assistant pour répondre aux questions récurrentes.',
  probleme: null,
  solution: null,
  benefices: null,
  status: 'IDEE',
  abandonReason: null,
  authorId: 'u-alice',
  orgUnitRef: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  author: { id: 'u-alice', name: 'Alice' },
  category: null,
  contributors: [],
  _count: { votes: 0 },
  votes: [],
}

describe('serializeFiche', () => {
  it('votes = _count.votes', () => {
    expect(serializeFiche(base).votes).toBe(0)
    expect(serializeFiche({ ...base, _count: { votes: 7 } }).votes).toBe(7)
  })

  it('hasVoted vrai quand la relation votes (filtrée par appelant) contient une entrée', () => {
    const f = { ...base, votes: [{ id: 'v1' }] }
    expect(serializeFiche(f).hasVoted).toBe(true)
  })

  it('hasVoted faux quand la relation votes est vide', () => {
    expect(serializeFiche(base).hasVoted).toBe(false)
  })

  it('contributors mappe la relation vers les utilisateurs', () => {
    const f = {
      ...base,
      contributors: [
        { user: { id: 'u-bob', name: 'Bob' } },
        { user: { id: 'u-carol', name: 'Carol' } },
      ],
    }
    expect(serializeFiche(f).contributors).toEqual([
      { id: 'u-bob', name: 'Bob' },
      { id: 'u-carol', name: 'Carol' },
    ])
  })

  it('conserve le motif d\'abandon', () => {
    const f = { ...base, status: 'ABANDONNEE', abandonReason: 'Redondant avec un autre projet' }
    expect(serializeFiche(f).abandonReason).toBe('Redondant avec un autre projet')
  })

  it('conserve orgUnitRef et category', () => {
    const f = { ...base, orgUnitRef: 'ldap:org1', category: { id: 'cat1', label: 'Process' } }
    const s = serializeFiche(f)
    expect(s.orgUnitRef).toBe('ldap:org1')
    expect(s.category).toEqual({ id: 'cat1', label: 'Process' })
  })
})
