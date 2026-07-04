'use client'

import { ChevronDown } from 'lucide-react'
import type { InnovationCategory } from '@/hooks/useInnovationOrg'

interface Props {
  categories: InnovationCategory[]
  value: string | null
  onChange: (id: string | null) => void
  placeholder?: string
  className?: string
}

// Même traitement que OrgUnitPicker : chevron custom (la flèche native se
// désaligne selon navigateur/OS) ; `className` ne dimensionne que le conteneur.
export function CategoryPicker({ categories, value, onChange, placeholder = 'Aucune catégorie', className = 'w-full' }: Props) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full appearance-none border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl pl-3 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        <option value="">{placeholder}</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
    </div>
  )
}
