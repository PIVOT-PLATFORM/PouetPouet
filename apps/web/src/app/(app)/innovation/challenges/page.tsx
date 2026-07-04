'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, Trophy } from 'lucide-react'
import { useChallenges, type ChallengeStatus, type ChallengeInput } from '@/hooks/useChallenges'
import { useOrgUnits } from '@/hooks/useInnovationOrg'
import { OrgUnitPicker } from '@/components/innovation/org-unit-picker'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { useAuthStore } from '@/store/auth'

const STATUSES: Record<ChallengeStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Brouillon', color: '#6b7280' },
  OPEN: { label: 'Ouvert', color: '#16a34a' },
  EVALUATION: { label: 'En évaluation', color: '#2563eb' },
  CLOSED: { label: 'Clôturé', color: '#dc2626' },
}

const inputCls = 'w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

function frDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function CreateModal({ onClose, onSave }: { onClose: () => void; onSave: (input: ChallengeInput) => Promise<unknown> }) {
  const [nom, setNom] = useState('')
  const [description, setDescription] = useState('')
  const [theme, setTheme] = useState('')
  const [orgUnitRef, setOrgUnitRef] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { units } = useOrgUnits()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim() || !description.trim()) { setError('Nom et description sont obligatoires.'); return }
    setSaving(true)
    setError(null)
    try {
      await onSave({ nom: nom.trim(), description: description.trim(), theme: theme.trim() || undefined, orgUnitRef: orgUnitRef ?? undefined })
      onClose()
    } catch {
      setError('Erreur lors de la création.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nouveau challenge</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nom</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} className={inputCls} maxLength={120} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Thème (optionnel)</label>
            <input value={theme} onChange={(e) => setTheme(e.target.value)} className={inputCls} maxLength={120} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Périmètre d'éligibilité (optionnel)</label>
            <OrgUnitPicker units={units} value={orgUnitRef} onChange={setOrgUnitRef} placeholder="Ouvert à tous" />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-60">
              {saving ? 'Création…' : 'Créer (brouillon)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ChallengesListPage() {
  useFlagGuard('module.innovation')
  const user = useAuthStore((s) => s.user)
  const { challenges, isLoading, createChallenge } = useChallenges()
  const [creating, setCreating] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <Link href="/innovation" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors w-fit"><ChevronLeft size={16} />Innovation</Link>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2"><Trophy size={28} style={{ color: '#eab308' }} />Challenges</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{isLoading ? '…' : `${challenges.length} challenge${challenges.length !== 1 ? 's' : ''}`}</p>
        </div>
        {user?.isAdmin && (
          <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 active:scale-95 transition-all shadow-sm">
            <Plus size={16} /> Nouveau challenge
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 border-b border-gray-100 dark:border-gray-800 -mt-2">
        <Link href="/innovation" className="text-sm font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 pb-2">Fiches</Link>
        <span className="text-sm font-semibold text-gray-900 dark:text-white border-b-2 border-amber-500 pb-2">Challenges</span>
        <Link href="/innovation/dashboard" className="text-sm font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 pb-2">Dashboard</Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : challenges.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
          <Trophy className="w-10 h-10 opacity-30" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Aucun challenge pour l'instant</p>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
          {challenges.map((c) => {
            const meta = STATUSES[c.status]
            return (
              <Link key={c.id} href={`/innovation/challenges/${c.id}`} className="flex flex-col gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white line-clamp-2">{c.nom}</h2>
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0" style={{ background: meta.color + '1a', color: meta.color }}>{meta.label}</span>
                </div>
                {c.theme && <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{c.theme}</p>}
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{c.description}</p>
                <div className="flex items-center justify-between gap-2 pt-2 mt-auto border-t border-gray-50 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                  <span>{c.entryCount} fiche{c.entryCount !== 1 ? 's' : ''} inscrite{c.entryCount !== 1 ? 's' : ''}</span>
                  {(c.opensAt || c.closesAt) && <span>{frDate(c.opensAt)}{c.closesAt ? ` → ${frDate(c.closesAt)}` : ''}</span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} onSave={createChallenge} />}
    </div>
  )
}
