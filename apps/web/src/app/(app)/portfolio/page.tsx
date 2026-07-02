'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FolderKanban, Plus } from 'lucide-react'
import { usePortfolios } from '@/hooks/usePortfolio'
import { useFlagGuard } from '@/hooks/useFlagGuard'

const inputCls = 'w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400'

export default function PortfolioListPage() {
  useFlagGuard('module.portfolio')
  const { portfolios, isLoading, createPortfolio, deletePortfolio } = usePortfolios()
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
      await createPortfolio({ name: name.trim(), description: description.trim() || undefined })
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
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2"><FolderKanban size={28} style={{ color: '#7c5cff' }} />Portefeuille</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{isLoading ? '…' : `${portfolios.length} portefeuille${portfolios.length !== 1 ? 's' : ''}`} — vue consolidée de plusieurs roadmaps</p>
        </div>
        <button onClick={() => { setCreating(true); setError(null) }} className="flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2.5 active:scale-95 transition-all shadow-sm">
          <Plus className="w-4 h-4" />
          Nouveau portefeuille
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : portfolios.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
          <FolderKanban className="w-10 h-10 opacity-30" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Aucun portefeuille pour l'instant</p>
          <p className="text-xs text-gray-400 max-w-sm text-center">Un portefeuille regroupe plusieurs roadmaps pour une vue consolidée — utile pour un suivi transverse (directeur de programme, portefeuille de projets).</p>
          <button onClick={() => setCreating(true)} className="text-sm font-medium text-primary-600 hover:text-primary-700">Créer mon premier portefeuille</button>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
          {portfolios.map((p) => (
            <div key={p.id} className="group relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 hover:shadow-md transition-all">
              <Link href={`/portfolio/${p.id}`} className="block">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">{p.name}</h2>
                  {p.role !== 'OWNER' && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 shrink-0">{p.role === 'EDITOR' ? 'Éditeur' : 'Lecteur'}</span>
                  )}
                </div>
                {p.description && <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{p.description}</p>}
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>{p.roadmapCount} roadmap{p.roadmapCount !== 1 ? 's' : ''}</span>
                </div>
              </Link>
              {p.role === 'OWNER' && (
                <button
                  onClick={() => { if (confirm(`Supprimer le portefeuille « ${p.name} » ? (les roadmaps rattachées ne seront pas supprimées)`)) deletePortfolio(p.id) }}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                  title="Supprimer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setCreating(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nouveau portefeuille</h2>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Nom *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Digital 2026…" className={inputCls} autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Description (optionnel)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputCls} resize-y`} />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex gap-3">
              <button onClick={() => setCreating(false)} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 rounded-xl bg-primary-600 text-white py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{saving ? '…' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
