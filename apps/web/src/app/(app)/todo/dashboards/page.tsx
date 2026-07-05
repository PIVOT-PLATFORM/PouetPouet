'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, LayoutDashboard, Plus, Trash2 } from 'lucide-react'
import { useTodoDashboards } from '@/hooks/useTodoDashboards'
import { useFlagGuard } from '@/hooks/useFlagGuard'

const inputCls = 'w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

export default function TodoDashboardsListPage() {
  useFlagGuard('module.todo')
  const { dashboards, isLoading, createDashboard, deleteDashboard } = useTodoDashboards()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    setError(null)
    if (!name.trim()) { setError('Le nom est obligatoire.'); return }
    setSaving(true)
    try {
      await createDashboard({ name: name.trim(), description: description.trim() || null })
      setCreating(false)
      setName(''); setDescription('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/todo" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"><ChevronLeft size={16} />To-Do</Link>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2"><LayoutDashboard size={28} style={{ color: '#f97316' }} />Tableaux de bord</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{isLoading ? '…' : `${dashboards.length} tableau${dashboards.length !== 1 ? 'x' : ''} de bord`} — combinez plusieurs listes avec rapports et statistiques</p>
        </div>
        <button onClick={() => { setCreating(true); setError(null) }} className="flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2.5 active:scale-95 transition-all shadow-sm">
          <Plus size={16} /> Nouveau tableau de bord
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : dashboards.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
          <LayoutDashboard className="w-10 h-10 opacity-30" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Aucun tableau de bord pour l&apos;instant</p>
          <p className="text-xs text-gray-400 max-w-sm text-center">Un tableau de bord regroupe plusieurs listes de tâches pour une vue consolidée — utile pour un bilan transverse.</p>
          <button onClick={() => setCreating(true)} className="text-sm font-medium text-orange-600 hover:text-orange-700">Créer mon premier tableau de bord</button>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
          {dashboards.map((d) => (
            <div key={d.id} className="group relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 hover:shadow-md transition-all">
              <Link href={`/todo/dashboards/${d.id}`} className="block">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">{d.name}</h2>
                  {d.role !== 'OWNER' && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 shrink-0">{d.role === 'EDITOR' ? 'Éditeur' : 'Lecteur'}</span>
                  )}
                </div>
                {d.description && <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{d.description}</p>}
                <span className="text-xs text-gray-500 dark:text-gray-400">{d.listCount} liste{d.listCount !== 1 ? 's' : ''}</span>
              </Link>
              {d.role === 'OWNER' && (
                <button
                  onClick={() => { if (confirm(`Supprimer le tableau de bord « ${d.name} » ? (les listes rattachées ne seront pas supprimées)`)) deleteDashboard(d.id) }}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setCreating(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nouveau tableau de bord</h2>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Nom *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bilan trimestriel…" className={inputCls} autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Description (optionnel)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputCls} resize-y`} />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex gap-3">
              <button onClick={() => setCreating(false)} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 rounded-xl bg-orange-500 text-white py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50">{saving ? '…' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
