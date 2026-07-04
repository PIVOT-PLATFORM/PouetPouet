'use client'

import { useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
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
// `appearance-none` + chevron positionné à la main : la flèche native du <select>
// rend mal/se désaligne selon navigateur/OS, on la remplace entièrement.
// `className` ne dimensionne que le conteneur (ex. "w-56") — le style du champ
// lui-même est fixe pour garder le chevron toujours bien placé.
export function OrgUnitPicker({ units, value, onChange, placeholder = 'Aucun périmètre', className = 'w-full' }: Props) {
  const flat = useMemo(() => flattenTree(units), [units])

  return (
    <div className={`relative ${className}`}>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full appearance-none border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl pl-3 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        <option value="">{placeholder}</option>
        {flat.map(({ unit, depth }) => (
          <option key={unit.ref} value={unit.ref}>
            {'  '.repeat(depth)}{unit.nom} · {unit.source === 'ldap' ? 'LDAP' : 'Interne'}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
    </div>
  )
}
