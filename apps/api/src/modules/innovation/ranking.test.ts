import { describe, it, expect } from 'vitest'
import { computeRanking } from './ranking.js'

const entries = [
  { id: 'e1', ficheId: 'f1' },
  { id: 'e2', ficheId: 'f2' },
]
const criteria = [
  { id: 'c-impact', poids: 3 },
  { id: 'c-faisabilite', poids: 1 },
]

describe('computeRanking', () => {
  it('calcule une moyenne pondérée sur plusieurs jurés et critères', () => {
    const scores = [
      { entryId: 'e1', criterionId: 'c-impact', note: 8 },
      { entryId: 'e1', criterionId: 'c-impact', note: 6 }, // 2 jurés → moyenne 7
      { entryId: 'e1', criterionId: 'c-faisabilite', note: 4 },
    ]
    const ranking = computeRanking(entries, criteria, scores)
    const e1 = ranking.find((r) => r.entryId === 'e1')!
    // (7*3 + 4*1) / (3+1) = 25/4 = 6.25
    expect(e1.weightedAverage).toBe(6.25)
  })

  it('trie du meilleur au moins bon', () => {
    const scores = [
      { entryId: 'e1', criterionId: 'c-impact', note: 5 },
      { entryId: 'e2', criterionId: 'c-impact', note: 9 },
    ]
    const ranking = computeRanking(entries, criteria, scores)
    expect(ranking[0].entryId).toBe('e2')
    expect(ranking[1].entryId).toBe('e1')
  })

  it('exclut un critère non noté du calcul (pas de pénalité à 0)', () => {
    const scores = [{ entryId: 'e1', criterionId: 'c-impact', note: 10 }]
    const ranking = computeRanking(entries, criteria, scores)
    const e1 = ranking.find((r) => r.entryId === 'e1')!
    // seul c-impact est noté → moyenne pondérée = 10, pas (10*3+0*1)/4
    expect(e1.weightedAverage).toBe(10)
    expect(e1.criteriaAverages.find((c) => c.criterionId === 'c-faisabilite')!.average).toBeNull()
  })

  it('renvoie weightedAverage null pour une fiche sans aucune note', () => {
    const ranking = computeRanking(entries, criteria, [])
    expect(ranking.every((r) => r.weightedAverage === null)).toBe(true)
  })

  it('les fiches non notées passent en dernier (tri stable, pas d\'exception)', () => {
    const scores = [{ entryId: 'e2', criterionId: 'c-impact', note: 1 }]
    const ranking = computeRanking(entries, criteria, scores)
    expect(ranking[0].entryId).toBe('e2')
    expect(ranking[1].entryId).toBe('e1')
    expect(ranking[1].weightedAverage).toBeNull()
  })
})
