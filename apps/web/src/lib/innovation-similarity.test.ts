import { describe, it, expect } from 'vitest'
import { findSimilarFiches } from './innovation-similarity'

const fiches = [
  { id: '1', title: 'Portail RH nouvelle génération', pitch: 'Simplifier les démarches RH internes.' },
  { id: '2', title: 'Portail RH nouvelle generation', pitch: 'Autre pitch pour tester le quasi-doublon.' },
  { id: '3', title: 'Refonte du parking à vélo', pitch: 'Installer des arceaux supplémentaires.' },
]

describe('findSimilarFiches', () => {
  it('renvoie vide pour une requête trop courte', () => {
    expect(findSimilarFiches(fiches, 'ab')).toEqual([])
  })

  it('renvoie vide si aucune fiche existante', () => {
    expect(findSimilarFiches([], 'Portail RH')).toEqual([])
  })

  it('trouve un titre quasi-identique (faute de frappe/accent)', () => {
    const results = findSimilarFiches(fiches, 'Portail RH nouvele generation')
    expect(results.map((f) => f.id)).toEqual(expect.arrayContaining(['1', '2']))
  })

  it('ne remonte pas de résultat pour un sujet sans rapport', () => {
    const results = findSimilarFiches(fiches, 'Portail RH nouvelle génération')
    expect(results.map((f) => f.id)).not.toContain('3')
  })

  it('respecte la limite de résultats', () => {
    const results = findSimilarFiches(fiches, 'Portail RH nouvelle génération', { limit: 1 })
    expect(results.length).toBeLessThanOrEqual(1)
  })
})
