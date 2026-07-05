'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ListChecks, Plus, Star, User } from 'lucide-react'
import { useTodoLists, type TodoListInput } from '@/hooks/useTodo'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { useAuthStore } from '@/store/auth'

const inputCls = 'w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

function CreateModal({ onClose, onSave }: { onClose: () => void; onSave: (input: TodoListInput) => Promise<unknown> }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom est obligatoire.'); return }
    setSaving(true)
    setError(null)
    try {
      await onSave({ name: name.trim(), description: description.trim() || null })
      onClose()
    } catch {
      setError('Erreur lors de la création.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nouvelle liste</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Courses, Sprint 12…" className={inputCls} maxLength={120} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description (optionnel)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-60">
              {saving ? 'Création…' : 'Créer la liste'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TodoListsPage() {
  useFlagGuard('module.todo')
  const user = useAuthStore((s) => s.user)
  const [mine, setMine] = useState(false)
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const { lists, isLoading, createList, toggleFavorite } = useTodoLists({ mine, favorite: favoriteOnly })
  const [creating, setCreating] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2"><ListChecks size={28} style={{ color: '#f97316' }} />To-Do</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{isLoading ? '…' : `${lists.length} liste${lists.length !== 1 ? 's' : ''}`}</p>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <Link href="/todo/dashboards" className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Tableaux de bord</Link>
          )}
          <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 active:scale-95 transition-all shadow-sm">
            <Plus size={16} /> Nouvelle liste
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setMine((v) => !v)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${mine ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          Mes listes
        </button>
        <button
          onClick={() => setFavoriteOnly((v) => !v)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${favoriteOnly ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          <Star size={11} /> Mes favoris
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
          <ListChecks className="w-10 h-10 opacity-30" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Aucune liste pour l&apos;instant</p>
          <button onClick={() => setCreating(true)} className="text-sm font-medium text-orange-600 hover:text-orange-700">Créer votre première liste</button>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
          {lists.map((l) => {
            const pct = l.itemCount > 0 ? Math.round((l.doneCount / l.itemCount) * 100) : 0
            return (
              <Link key={l.id} href={`/todo/${l.id}`} className="group flex flex-col gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white line-clamp-2">{l.name}</h2>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(l.id) }}
                    title="Favori"
                    className={`shrink-0 p-1 rounded-full transition-all ${l.isFavorite ? 'text-orange-500' : 'text-gray-300 dark:text-gray-600 hover:text-orange-400'}`}
                  >
                    <Star size={14} fill={l.isFavorite ? 'currentColor' : 'none'} />
                  </button>
                </div>
                {l.description && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{l.description}</p>}
                <div className="flex items-center gap-2 mt-auto">
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-1.5 rounded-full bg-orange-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">{l.doneCount}/{l.itemCount}</span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-50 dark:border-gray-800">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{l.role === 'OWNER' ? 'Propriétaire' : l.role === 'EDITOR' ? 'Éditeur' : 'Lecteur'}</span>
                  {l.role !== 'OWNER' && <span className="flex items-center gap-1 text-xs text-gray-400"><User size={11} /></span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} onSave={createList} />}
    </div>
  )
}
