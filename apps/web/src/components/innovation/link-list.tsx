'use client'

import { useState } from 'react'
import { ExternalLink, Trash2 } from 'lucide-react'
import type { InnovationLink } from '@/hooks/useInnovationLinks'

interface Props {
  links: InnovationLink[]
  canEdit: boolean
  onAdd: (label: string, url: string) => Promise<unknown>
  onDelete: (linkId: string) => Promise<unknown>
}

// Liens externes (documents partagés, prototypes, articles…) — distincts des pièces
// jointes : pas de fichier, juste un intitulé + une URL.
export function LinkList({ links, canEdit, onAdd, onDelete }: Props) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim() || !url.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onAdd(label.trim(), url.trim())
      setLabel('')
      setUrl('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {links.length === 0 ? (
        <p className="text-xs text-gray-400">Aucun lien pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2">
              <a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 hover:underline truncate">
                <ExternalLink size={13} className="shrink-0" />
                <span className="truncate">{l.label}</span>
              </a>
              {canEdit && (
                <button onClick={() => onDelete(l.id)} className="shrink-0 p-1 rounded text-gray-300 hover:text-red-500" title="Supprimer"><Trash2 size={12} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form onSubmit={handleAdd} className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Intitulé" className="w-32 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="flex-1 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          <button type="submit" disabled={saving || !label.trim() || !url.trim()} className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
            {saving ? '…' : 'Ajouter'}
          </button>
        </form>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
