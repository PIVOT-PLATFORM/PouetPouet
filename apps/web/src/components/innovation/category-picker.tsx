'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { InnovationCategory } from '@/hooks/useInnovationOrg'

interface Props {
  categories: InnovationCategory[]
  value: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  className?: string
}

// Listbox custom multi-sélection (tags multi-valeurs, PR C du lot pré-release — une
// fiche peut porter plusieurs tags au lieu d'une catégorie unique). Cliquer une option
// bascule son appartenance à la sélection sans fermer le panneau (convention multi-
// select) ; le panneau se ferme au clic extérieur ou Echap. `className` ne dimensionne
// que le conteneur.
export function CategoryPicker({ categories, value, onChange, placeholder = 'Aucune catégorie', className = 'w-full' }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = categories.filter((c) => value.includes(c.id))

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

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl pl-3 pr-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-amber-400 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
      >
        <span className={`truncate ${selected.length ? '' : 'text-gray-400'}`}>{selected.length ? selected.map((c) => c.label).join(', ') : placeholder}</span>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="listbox" aria-multiselectable className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1">
          {categories.length === 0 ? (
            <p className="px-3 py-1.5 text-sm text-gray-400">Aucune catégorie disponible.</p>
          ) : categories.map((c) => {
            const isSelected = value.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => toggle(c.id)}
                className={`w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm truncate ${isSelected ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <Check size={13} className={`shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                <span className="truncate">{c.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
