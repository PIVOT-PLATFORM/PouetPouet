import { describe, it, expect } from 'vitest'
import { isInSubtree, type ResolvedOrgUnit } from './innovation-org.js'

// Petit arbre mixte LDAP + interne pour tester isInSubtree sans DB ni pod externe :
//
//   ldap:comex
//     └─ ldap:direction-si
//          └─ int:equipe-innovation   (unité interne rattachée sous une racine LDAP)
//   int:comite-transverse             (racine interne indépendante)
const units: ResolvedOrgUnit[] = [
  { ref: 'ldap:comex', nom: 'COMEX', niveau: 'COMEX', parentRef: null, source: 'ldap' },
  { ref: 'ldap:direction-si', nom: 'Direction SI', niveau: 'DIRECTION', parentRef: 'ldap:comex', source: 'ldap' },
  { ref: 'int:equipe-innovation', nom: 'Équipe Innovation', niveau: 'EQUIPE', parentRef: 'ldap:direction-si', source: 'interne' },
  { ref: 'int:comite-transverse', nom: 'Comité transverse', niveau: 'DIVISION', parentRef: null, source: 'interne' },
]

describe('isInSubtree', () => {
  it('un ref est dans son propre sous-arbre (inclusif)', () => {
    expect(isInSubtree('ldap:direction-si', 'ldap:direction-si', units)).toBe(true)
  })

  it('un descendant direct est dans le sous-arbre de son parent', () => {
    expect(isInSubtree('int:equipe-innovation', 'ldap:direction-si', units)).toBe(true)
  })

  it('un descendant indirect (petit-enfant) est dans le sous-arbre de la racine', () => {
    expect(isInSubtree('int:equipe-innovation', 'ldap:comex', units)).toBe(true)
  })

  it('une unité interne peut être rattachée sous une racine LDAP (arbres reliés par filiation, pas fusionnés)', () => {
    // int:equipe-innovation a pour parent ldap:direction-si — la traversée fonctionne
    // même si les deux refs ont des préfixes différents (parentRef pointe simplement
    // vers l'autre référentiel), tant qu'on ne demande pas une remontée dans l'autre sens.
    expect(isInSubtree('int:equipe-innovation', 'ldap:comex', units)).toBe(true)
  })

  it('un ref hors du sous-arbre renvoie faux', () => {
    expect(isInSubtree('int:comite-transverse', 'ldap:comex', units)).toBe(false)
    expect(isInSubtree('ldap:comex', 'ldap:direction-si', units)).toBe(false)
  })

  it('un ref inconnu renvoie faux (pas d\'exception)', () => {
    expect(isInSubtree('ldap:inconnu', 'ldap:comex', units)).toBe(false)
  })

  it('ne boucle pas indéfiniment sur un cycle corrompu', () => {
    const cyclic: ResolvedOrgUnit[] = [
      { ref: 'int:a', nom: 'A', niveau: 'EQUIPE', parentRef: 'int:b', source: 'interne' },
      { ref: 'int:b', nom: 'B', niveau: 'EQUIPE', parentRef: 'int:a', source: 'interne' },
    ]
    expect(isInSubtree('int:a', 'int:zzz', cyclic)).toBe(false)
  })
})
