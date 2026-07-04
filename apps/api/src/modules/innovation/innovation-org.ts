// Référentiel organisationnel hybride du module Innovation — cf. ADR-0012.
// Fusionne le LDAP externe (réutilisé de Commande publique, jamais dupliqué en base)
// et la hiérarchie interne (InnovationOrgUnit, administrée dans l'app) en une forme
// commune, sous des refs opaques préfixées "ldap:<id>" / "int:<id>". Les deux arbres
// ne se croisent jamais : un ref ne peut être ancêtre/descendant que d'un ref du même
// préfixe.

import { prisma } from '../../lib/prisma.js'
import { ldapClient } from '../../lib/ldap-client.js'
import { ExternalUnavailableError } from '../../lib/external-client.js'

export type OrgSource = 'ldap' | 'interne'

export interface ResolvedOrgUnit {
  ref: string
  nom: string
  niveau: string
  parentRef: string | null
  source: OrgSource
}

export interface OrgUnitsResult {
  units: ResolvedOrgUnit[]
  // LDAP indisponible : les unités internes restent servies plutôt que de faire
  // échouer tout le module — exception assumée à la convention Commande publique
  // (ExternalUnavailableError → 503 bloquant global), cf. ADR-0012.
  ldapDegraded: boolean
}

export async function resolveOrgUnits(): Promise<OrgUnitsResult> {
  const internal = await prisma.innovationOrgUnit.findMany({ orderBy: { nom: 'asc' } })
  const internalUnits: ResolvedOrgUnit[] = internal.map((u) => ({
    ref: `int:${u.id}`,
    nom: u.nom,
    niveau: u.niveau,
    parentRef: u.parentId ? `int:${u.parentId}` : null,
    source: 'interne',
  }))

  try {
    const ldapUnits = await ldapClient.listOrgUnits()
    const ldapMapped: ResolvedOrgUnit[] = ldapUnits.map((u) => ({
      ref: `ldap:${u.id}`,
      nom: u.nom,
      niveau: u.niveau,
      parentRef: u.parentId ? `ldap:${u.parentId}` : null,
      source: 'ldap',
    }))
    return { units: [...ldapMapped, ...internalUnits], ldapDegraded: false }
  } catch (err) {
    if (err instanceof ExternalUnavailableError) {
      return { units: internalUnits, ldapDegraded: true }
    }
    throw err
  }
}

// `ref` est-il dans le sous-arbre de `rootRef` (inclusif) ? Remonte les parentRef ;
// un garde-fou anti-cycle évite une boucle infinie en cas de données corrompues.
export function isInSubtree(ref: string, rootRef: string, units: ResolvedOrgUnit[]): boolean {
  if (ref === rootRef) return true
  const byRef = new Map(units.map((u) => [u.ref, u]))
  const seen = new Set<string>()
  let current = byRef.get(ref)
  while (current?.parentRef) {
    if (seen.has(current.ref)) return false
    seen.add(current.ref)
    if (current.parentRef === rootRef) return true
    current = byRef.get(current.parentRef)
  }
  return false
}
