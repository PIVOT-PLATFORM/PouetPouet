'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { InnovationCategory } from '@/hooks/useInnovationOrg'

interface Props {
  categories: InnovationCategory[]
  value: string | null
  onChange: (id: string | null) => void
  placeholder?: string
  className?: string
}

// Même traitement que OrgUnitPicker : listbox custom (bouton + panneau positionné) —
// la liste déroulante d'un <select> natif reste rendue par l'OS/navigateur et ne peut
// pas être stylée en CSS. `className` ne dimensionne que le conteneur.
export function CategoryPicker({ categories, value, onChange, placeholder = 'Aucune catégorie', className = 'w-full' }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = categories.find((c) => c.id === value)

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

  function select(id: string | null) {
    onChange(id)
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
        <span className={`truncate ${selected ? '' : 'text-gray-400'}`}>{selected ? selected.label : placeholder}</span>
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
          {categories.map((c) => {
            const isSelected = c.id === value
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => select(c.id)}
                className={`w-full text-left px-3 py-1.5 text-sm truncate ${isSelected ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
