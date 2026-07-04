'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
// Listbox custom (bouton + panneau positionné) plutôt qu'un <select> natif : la liste
// déroulante d'un <select> reste rendue par l'OS/navigateur et ne peut pas être stylée
// en CSS, quel que soit le traitement appliqué au champ fermé.
// `className` ne dimensionne que le conteneur (ex. "w-56").
export function OrgUnitPicker({ units, value, onChange, placeholder = 'Aucun périmètre', className = 'w-full' }: Props) {
  const flat = useMemo(() => flattenTree(units), [units])
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = flat.find((e) => e.unit.ref === value)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  function select(ref: string | null) {
    onChange(ref)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl pl-3 pr-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-amber-400 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
      >
        <span className={`truncate ${selected ? '' : 'text-gray-400'}`}>
          {selected ? `${selected.unit.nom} · ${selected.unit.source === 'ldap' ? 'LDAP' : 'Interne'}` : placeholder}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="listbox" className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1">
          <button
            type="button"
            role="option"
            aria-selected={!value}
            onClick={() => select(null)}
            className={`w-full text-left px-3 py-1.5 text-sm truncate ${!value ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-medium' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            {placeholder}
          </button>
          {flat.map(({ unit, depth }) => {
            const isSelected = unit.ref === value
            return (
              <button
                key={unit.ref}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => select(unit.ref)}
                style={{ paddingLeft: `${12 + depth * 14}px` }}
                className={`w-full text-left pr-3 py-1.5 text-sm truncate ${isSelected ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                {unit.nom} · {unit.source === 'ldap' ? 'LDAP' : 'Interne'}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
