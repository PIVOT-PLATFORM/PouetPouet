'use client'

import { useMemo } from 'react'
import type { ResolvedOrgUnit } from '@/hooks/useInnovationOrg'

interface Props {
  units: ResolvedOrgUnit[]
  value: string | null
  onChange: (ref: string | null) => void
  placeholder?: string
  className?: string
}

interface FlatEntry {
  unit: ResolvedOrgUnit
  depth: number
}

// Aplatit l'arbre fusionné (LDAP + interne) en liste indentée, parents avant enfants,
// triée par nom à chaque niveau. Garde-fou anti-cycle en cas de données corrompues.
function flattenTree(units: ResolvedOrgUnit[]): FlatEntry[] {
  const byParent = new Map<string | null, ResolvedOrgUnit[]>()
  for (const u of units) {
    const key = u.parentRef
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(u)
  }
  const result: FlatEntry[] = []
  const seen = new Set<string>()
  function visit(parentRef: string | null, depth: number) {
    const children = (byParent.get(parentRef) ?? []).slice().sort((a, b) => a.nom.localeCompare(b.nom))
    for (const child of children) {
      if (seen.has(child.ref)) continue
      seen.add(child.ref)
      result.push({ unit: child, depth })
      visit(child.ref, depth + 1)
    }
  }
  visit(null, 0)
  return result
}

// Sélecteur arborescent pour le référentiel organisationnel hybride (ADR-0012) :
// indentation par profondeur + badge d'origine (LDAP externe / unité interne).
export function OrgUnitPicker({ units, value, onChange, placeholder = 'Aucun périmètre', className }: Props) {
  const flat = useMemo(() => flattenTree(units), [units])
  const defaultCls = 'w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={className ?? defaultCls}>
      <option value="">{placeholder}</option>
      {flat.map(({ unit, depth }) => (
        <option key={unit.ref} value={unit.ref}>
          {'  '.repeat(depth)}{unit.nom} · {unit.source === 'ldap' ? 'LDAP' : 'Interne'}
        </option>
      ))}
    </select>
  )
}
