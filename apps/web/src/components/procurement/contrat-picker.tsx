'use client'

import { useEffect, useRef, useState } from 'react'
import { searchContrats } from '@/hooks/useProcurement'
import type { ContratRecherche } from '@/lib/procurement'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

// Combobox de recherche serveur — la liste des contrats peut compter plusieurs milliers
// d'entrées (rustine PGI), donc pas de select chargeant tout : on tape, on cherche, on choisit.
export function ContratPicker({
  value, onSelect, placeholder = 'Rechercher un contrat (numéro, objet)…', allowClear = true,
}: {
  value: ContratRecherche | null
  onSelect: (contrat: ContratRecherche | null) => void
  placeholder?: string
  allowClear?: boolean
}) {
  const [query, setQuery] = useState(value ? `${value.numero} — ${value.objet}` : '')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<ContratRecherche[]>([])
  const [loading, setLoading] = useState(false)
  const debouncedQuery = useDebouncedValue(query, 250)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setQuery(value ? `${value.numero} — ${value.objet}` : '')
  }, [value])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    searchContrats(debouncedQuery)
      .then(setResults)
      .finally(() => setLoading(false))
  }, [debouncedQuery, open])

  function handleSelect(c: ContratRecherche) {
    onSelect(c)
    setQuery(`${c.numero} — ${c.objet}`)
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        value={query}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150) }}
        className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
      />
      {value && allowClear && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onSelect(null); setQuery('') }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-xs"
        >
          ✕
        </button>
      )}
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-sm text-gray-400">Recherche…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">Aucun contrat trouvé.</p>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(c) }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex flex-col"
              >
                <span className="font-semibold text-gray-900 dark:text-white">{c.numero}</span>
                <span className="text-gray-500 dark:text-gray-400 text-xs truncate">{c.objet}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
