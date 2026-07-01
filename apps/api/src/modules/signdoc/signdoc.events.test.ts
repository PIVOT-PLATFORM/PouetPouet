import { describe, it, expect } from 'vitest'
import { canonicalJSON } from './signdoc.events.js'

// Le JSON canonique est le cœur du déterminisme de la chaîne de hachage :
// deux objets équivalents (ordre de clés différent) doivent produire la même
// empreinte, sinon un aller-retour JSONB en base casserait la vérification.
describe('canonicalJSON', () => {
  it('produit la même sortie quel que soit l’ordre des clés', () => {
    expect(canonicalJSON({ a: 1, b: 2 })).toBe(canonicalJSON({ b: 2, a: 1 }))
  })

  it('trie récursivement les clés imbriquées', () => {
    const a = canonicalJSON({ outer: { z: 1, a: 2 }, list: [{ y: 1, x: 2 }] })
    const b = canonicalJSON({ list: [{ x: 2, y: 1 }], outer: { a: 2, z: 1 } })
    expect(a).toBe(b)
  })

  it('préserve l’ordre des tableaux (significatif)', () => {
    expect(canonicalJSON([1, 2, 3])).not.toBe(canonicalJSON([3, 2, 1]))
  })

  it('gère null et les scalaires', () => {
    expect(canonicalJSON(null)).toBe('null')
    expect(canonicalJSON('x')).toBe('"x"')
    expect(canonicalJSON(42)).toBe('42')
  })

  it('distingue des contenus différents', () => {
    expect(canonicalJSON({ a: 1 })).not.toBe(canonicalJSON({ a: 2 }))
  })
})
