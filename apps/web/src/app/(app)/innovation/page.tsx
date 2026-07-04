'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Download, Lightbulb, Lock, Plus, Star, ThumbsUp, User, Info } from 'lucide-react'
import { useInnovationFiches, type InnovationStatus, type InnovationVisibility, type FicheInput, type InnovationFiche } from '@/hooks/useInnovation'
import { useOrgUnits, useInnovationCategories } from '@/hooks/useInnovationOrg'
import { OrgUnitPicker } from '@/components/innovation/org-unit-picker'
import { CategoryPicker } from '@/components/innovation/category-picker'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { useAuthStore } from '@/store/auth'
import { findSimilarFiches } from '@/lib/innovation-similarity'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

async function authedDownload(url: string, filename: string) {
  const token = localStorage.getItem('token')
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) return
  const blob = await res.blob()
  const objUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(objUrl)
}

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

function CreateModal({ onClose, onSave, existingFiches }: { onClose: () => void; onSave: (input: FicheInput) => Promise<unknown>; existingFiches: InnovationFiche[] }) {
  const [title, setTitle] = useState('')
  const [pitch, setPitch] = useState('')
  const [probleme, setProbleme] = useState('')
  const [solution, setSolution] = useState('')
  const [benefices, setBenefices] = useState('')
  const [orgUnitRef, setOrgUnitRef] = useState<string | null>(null)
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [visibility, setVisibility] = useState<InnovationVisibility>('PUBLIC')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { units } = useOrgUnits()
  const { categories } = useInnovationCategories(orgUnitRef)
  const debouncedTitle = useDebouncedValue(title, 300)
  const similarFiches = findSimilarFiches(existingFiches, debouncedTitle)

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
        categoryIds: categoryIds.length ? categoryIds : undefined,
        visibility,
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
          {similarFiches.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300"><Info size={13} />Idées similaires existantes</p>
              <ul className="flex flex-col gap-1">
                {similarFiches.map((f) => (
                  <li key={f.id}>
                    <a href={`/innovation/${f.id}`} target="_blank" rel="noreferrer" className="text-xs text-amber-700 dark:text-amber-400 hover:underline">{f.title}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
              <OrgUnitPicker units={units} value={orgUnitRef} onChange={(v) => { setOrgUnitRef(v); setCategoryIds([]) }} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Catégories (optionnel)</label>
              <CategoryPicker categories={categories} value={categoryIds} onChange={setCategoryIds} placeholder="Aucune" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Visibilité</label>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
              <button type="button" onClick={() => setVisibility('PUBLIC')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${visibility === 'PUBLIC' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}>Publique</button>
              <button type="button" onClick={() => setVisibility('PRIVATE')} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${visibility === 'PRIVATE' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}><Lock size={11} />Privée</button>
            </div>
            <p className="text-xs text-gray-400 mt-1">{visibility === 'PRIVATE' ? "Visible seulement de vous et des contributeurs que vous ajoutez." : 'Visible par toute l\'équipe.'}</p>
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
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const debouncedSearch = useDebouncedValue(search)
  const { units } = useOrgUnits()
  const { categories } = useInnovationCategories(orgUnitRef)
  const { fiches, isLoading, createFiche, toggleVote, toggleFavorite } = useInnovationFiches({
    status: status ?? undefined,
    mine,
    q: debouncedSearch || undefined,
    orgUnitRef: orgUnitRef ?? undefined,
    categoryIds: categoryIds.length ? categoryIds : undefined,
    favorite: favoriteOnly,
  })
  const [creating, setCreating] = useState(false)

  async function handleExportCsv() {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (mine) params.set('mine', 'true')
    if (debouncedSearch) params.set('q', debouncedSearch)
    if (orgUnitRef) params.set('orgUnitRef', orgUnitRef)
    if (categoryIds.length) params.set('categoryIds', categoryIds.join(','))
    if (favoriteOnly) params.set('favorite', 'true')
    const qs = params.toString()
    await authedDownload(`${API_URL}/api/innovation/fiches.csv${qs ? `?${qs}` : ''}`, 'fiches-innovation.csv')
  }

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
          <button onClick={handleExportCsv} title="Exporter en CSV" className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
            <Download size={16} /> Export CSV
          </button>
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
        <button
          onClick={() => setFavoriteOnly((v) => !v)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${favoriteOnly ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          <Star size={11} /> Mes favoris
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
          onChange={(v) => { setOrgUnitRef(v); setCategoryIds([]) }}
          placeholder="Tous les périmètres"
          className="w-56"
        />
        <CategoryPicker categories={categories} value={categoryIds} onChange={setCategoryIds} placeholder="Toutes les catégories" className="w-48" />
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
                  <div className="flex items-center gap-2.5 min-w-0">
                    {f.coverImage && <img src={f.coverImage} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />}
                    <h2 className="text-base font-bold text-gray-900 dark:text-white line-clamp-2 flex items-center gap-1.5">
                      {f.visibility === 'PRIVATE' && <Lock size={13} className="text-gray-400 shrink-0" />}
                      {f.title}
                    </h2>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0" style={{ background: meta.color + '1a', color: meta.color }}>{meta.label}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3">{f.pitch}</p>
                {f.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {f.categories.map((c) => (
                      <span key={c.id} className="text-[11px] font-medium text-amber-600 dark:text-amber-400 w-fit">{c.label}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 pt-2 mt-auto border-t border-gray-50 dark:border-gray-800">
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 truncate"><User size={12} />{f.author.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(f.id) }}
                      title="Favori"
                      className={`p-1.5 rounded-full transition-all ${f.isFavorite ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600 hover:text-amber-400'}`}
                    >
                      <Star size={14} fill={f.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleVote(f.id) }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${f.hasVoted ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}
                    >
                      <ThumbsUp size={11} /> {f.votes}
                    </button>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} onSave={createFiche} existingFiches={fiches} />}
    </div>
  )
}
