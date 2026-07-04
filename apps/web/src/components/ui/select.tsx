'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  className?: string
  triggerClassName?: string
  placeholder?: string
}

const DEFAULT_TRIGGER = 'w-full flex items-center justify-between gap-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary-400 hover:border-gray-300 dark:hover:border-gray-600 transition-colors bg-white'

// Listbox custom générique (bouton + panneau positionné) : la liste déroulante d'un
// <select> natif reste rendue par l'OS/navigateur et ne peut pas être stylée en CSS.
// `triggerClassName` permet de reproduire les variantes visuelles existantes (compact,
// pastille colorée…) ; `className` ne dimensionne que le conteneur.
export function Select({ value, onChange, options, className = '', triggerClassName, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

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

  function select(v: string) {
    onChange(v)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={triggerClassName ?? DEFAULT_TRIGGER}
      >
        <span className={`truncate ${!selected ? 'text-gray-400' : ''}`}>{selected ? selected.label : (placeholder ?? '')}</span>
        <ChevronDown size={14} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="listbox" className="absolute z-20 mt-1 min-w-full w-max max-h-64 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1">
          {options.map((o) => {
            const isSelected = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => select(o.value)}
                className={`w-full text-left px-3 py-1.5 text-sm whitespace-nowrap ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
