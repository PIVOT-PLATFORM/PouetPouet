'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Lightbulb, Plus, ThumbsUp, User } from 'lucide-react'
import { useInnovationFiches, type InnovationStatus, type FicheInput } from '@/hooks/useInnovation'
import { useOrgUnits, useInnovationCategories } from '@/hooks/useInnovationOrg'
import { OrgUnitPicker } from '@/components/innovation/org-unit-picker'
import { CategoryPicker } from '@/components/innovation/category-picker'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { useAuthStore } from '@/store/auth'

const STATUSES: { key: InnovationStatus; label: string; color: string }[] = [
  { key: 'IDEE', label: 'Idée', color: '#eab308' },
  { key: 'EXPLORATION', label: 'En exploration', color: '#2563eb' },
  { key: 'ADOPTEE', label: 'Adoptée', color: '#16a34a' },
  { key: 'ABANDONNEE', label: 'Abandonnée', color: '#6b7280' },
]

const inputCls = 'w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

function statusMeta(status: InnovationStatus) {
  return STATUSES.find((s) => s.key === status) ?? STATUSES[0]
}

function CreateModal({ onClose, onSave }: { onClose: () => void; onSave: (input: FicheInput) => Promise<unknown> }) {
  const [title, setTitle] = useState('')
  const [pitch, setPitch] = useState('')
  const [probleme, setProbleme] = useState('')
  const [solution, setSolution] = useState('')
  const [benefices, setBenefices] = useState('')
  const [orgUnitRef, setOrgUnitRef] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { units } = useOrgUnits()
  const { categories } = useInnovationCategories(orgUnitRef)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !pitch.trim()) { setError('Titre et pitch sont obligatoires.'); return }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        title: title.trim(),
        pitch: pitch.trim(),
        probleme: probleme.trim() || undefined,
        solution: solution.trim() || undefined,
        benefices: benefices.trim() || undefined,
        orgUnitRef: orgUnitRef ?? undefined,
        categoryId: categoryId ?? undefined,
      })
      onClose()
    } catch {
      setError('Erreur lors de la création.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nouvelle fiche innovation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Titre</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Résumé en une ligne" className={inputCls} maxLength={120} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Pitch</label>
            <textarea value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="En 2-3 phrases, de quoi s'agit-il ?" rows={3} className={`${inputCls} resize-none`} maxLength={300} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Problème (optionnel)</label>
            <textarea value={probleme} onChange={(e) => setProbleme(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Solution (optionnel)</label>
            <textarea value={solution} onChange={(e) => setSolution(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Bénéfices (optionnel)</label>
            <textarea value={benefices} onChange={(e) => setBenefices(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Périmètre (optionnel)</label>
              <OrgUnitPicker units={units} value={orgUnitRef} onChange={(v) => { setOrgUnitRef(v); setCategoryId(null) }} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Catégorie (optionnel)</label>
              <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} placeholder="Aucune" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1 shrink-0">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-60">
              {saving ? 'Envoi…' : 'Publier la fiche'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function InnovationListPage() {
  useFlagGuard('module.innovation')
  const user = useAuthStore((s) => s.user)
  const [status, setStatus] = useState<InnovationStatus | null>(null)
  const [mine, setMine] = useState(false)
  const [search, setSearch] = useState('')
  const [orgUnitRef, setOrgUnitRef] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const debouncedSearch = useDebouncedValue(search)
  const { units } = useOrgUnits()
  const { categories } = useInnovationCategories(orgUnitRef)
  const { fiches, isLoading, createFiche, toggleVote } = useInnovationFiches({
    status: status ?? undefined,
    mine,
    q: debouncedSearch || undefined,
    orgUnitRef: orgUnitRef ?? undefined,
    categoryId: categoryId ?? undefined,
  })
  const [creating, setCreating] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2"><Lightbulb size={28} style={{ color: '#eab308' }} />Innovation</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{isLoading ? '…' : `${fiches.length} fiche${fiches.length !== 1 ? 's' : ''}`} — visibles par toute l'équipe</p>
        </div>
        <div className="flex items-center gap-2">
          {user?.isAdmin && (
            <Link href="/innovation/organisation" className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Organisation</Link>
          )}
          <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 active:scale-95 transition-all shadow-sm">
            <Plus size={16} /> Nouvelle fiche
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 border-b border-gray-100 dark:border-gray-800 -mt-2">
        <span className="text-sm font-semibold text-gray-900 dark:text-white border-b-2 border-amber-500 pb-2">Fiches</span>
        <Link href="/innovation/challenges" className="text-sm font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 pb-2">Challenges</Link>
        <Link href="/innovation/dashboard" className="text-sm font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 pb-2">Dashboard</Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setStatus(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${status === null ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          Toutes
        </button>
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatus(status === s.key ? null : s.key)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={status === s.key ? { background: s.color, color: 'white' } : { background: s.color + '1a', color: s.color }}
          >
            {s.label}
          </button>
        ))}
        <button
          onClick={() => setMine((v) => !v)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${mine ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          Mes fiches
        </button>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className="ml-auto w-56 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <OrgUnitPicker
          units={units}
          value={orgUnitRef}
          onChange={(v) => { setOrgUnitRef(v); setCategoryId(null) }}
          placeholder="Tous les périmètres"
          className="w-56"
        />
        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} placeholder="Toutes les catégories" className="w-48" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : fiches.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
          <Lightbulb className="w-10 h-10 opacity-30" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Aucune fiche pour l'instant</p>
          <button onClick={() => setCreating(true)} className="text-sm font-medium text-amber-600 hover:text-amber-700">Publier la première idée</button>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
          {fiches.map((f) => {
            const meta = statusMeta(f.status)
            return (
              <Link key={f.id} href={`/innovation/${f.id}`} className="group flex flex-col gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white line-clamp-2">{f.title}</h2>
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0" style={{ background: meta.color + '1a', color: meta.color }}>{meta.label}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3">{f.pitch}</p>
                {f.category && <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 w-fit">{f.category.label}</span>}
                <div className="flex items-center justify-between gap-2 pt-2 mt-auto border-t border-gray-50 dark:border-gray-800">
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 truncate"><User size={12} />{f.author.name}</span>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleVote(f.id) }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all shrink-0 ${f.hasVoted ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}
                  >
                    <ThumbsUp size={11} /> {f.votes}
                  </button>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} onSave={createFiche} />}
    </div>
  )
}
