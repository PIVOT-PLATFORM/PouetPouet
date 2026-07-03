'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft, ThumbsUp, User, X } from 'lucide-react'
import { useInnovationFiche, type InnovationStatus } from '@/hooks/useInnovation'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { useAuthStore } from '@/store/auth'

const STATUSES: { key: InnovationStatus; label: string; color: string }[] = [
  { key: 'IDEE', label: 'Idée', color: '#eab308' },
  { key: 'EXPLORATION', label: 'En exploration', color: '#2563eb' },
  { key: 'ADOPTEE', label: 'Adoptée', color: '#16a34a' },
  { key: 'ABANDONNEE', label: 'Abandonnée', color: '#6b7280' },
]

const inputCls = 'w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

function frDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function Section({ title, body }: { title: string; body: string | null }) {
  if (!body) return null
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{title}</h3>
      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">{body}</p>
    </div>
  )
}

export default function InnovationDetailPage() {
  useFlagGuard('module.innovation')
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const { fiche, isLoading, notFound, updateFiche, toggleVote, addContributor, removeContributor } = useInnovationFiche(id)

  const [editing, setEditing] = useState(false)
  const [contributorEmail, setContributorEmail] = useState('')
  const [contributorError, setContributorError] = useState<string | null>(null)
  const [abandonReason, setAbandonReason] = useState('')
  const [showAbandon, setShowAbandon] = useState(false)

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>
  }
  if (notFound || !fiche) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Fiche introuvable.</p>
        <Link href="/innovation" className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700"><ChevronLeft size={16} />Retour à Innovation</Link>
      </div>
    )
  }

  const canEdit = !!user && (user.isAdmin || fiche.authorId === user.id || fiche.contributors.some((c) => c.id === user.id))
  const meta = STATUSES.find((s) => s.key === fiche.status) ?? STATUSES[0]

  async function handleStatusChange(next: InnovationStatus) {
    if (next === 'ABANDONNEE') { setShowAbandon(true); return }
    await updateFiche({ status: next, abandonReason: null })
  }

  async function confirmAbandon() {
    if (!abandonReason.trim()) return
    await updateFiche({ status: 'ABANDONNEE', abandonReason: abandonReason.trim() })
    setShowAbandon(false)
    setAbandonReason('')
  }

  async function handleAddContributor(e: React.FormEvent) {
    e.preventDefault()
    if (!contributorEmail.trim()) return
    setContributorError(null)
    try {
      await addContributor(contributorEmail.trim())
      setContributorEmail('')
    } catch (err) {
      setContributorError((err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <Link href="/innovation" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"><ChevronLeft size={16} />Innovation</Link>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              defaultValue={fiche.title}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== fiche.title) updateFiche({ title: v }); setEditing(false) }}
              autoFocus
              className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-amber-400 rounded-lg px-2 py-1 -ml-2 focus:outline-none w-full"
            />
          ) : (
            <h1
              onClick={() => canEdit && setEditing(true)}
              className={`text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight ${canEdit ? 'cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-2 py-1 -ml-2' : ''}`}
            >
              {fiche.title}
            </h1>
          )}
          <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
            <User size={14} />{fiche.author.name} · {frDate(fiche.createdAt)}
          </p>
        </div>
        <button
          onClick={() => toggleVote()}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 ${fiche.hasVoted ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}
        >
          <ThumbsUp size={16} /> {fiche.votes}
        </button>
      </div>

      {/* Statut */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            disabled={!canEdit}
            onClick={() => handleStatusChange(s.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${canEdit ? '' : 'cursor-default'}`}
            style={fiche.status === s.key ? { background: s.color, color: 'white' } : { background: s.color + '1a', color: s.color, opacity: canEdit ? 1 : 0.6 }}
          >
            {s.label}
          </button>
        ))}
      </div>
      {fiche.status === 'ABANDONNEE' && fiche.abandonReason && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">Motif d'abandon : {fiche.abandonReason}</p>
      )}

      {/* Contenu */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col gap-5">
        <Section title="Pitch" body={fiche.pitch} />
        <Section title="Problème" body={fiche.probleme} />
        <Section title="Solution" body={fiche.solution} />
        <Section title="Bénéfices" body={fiche.benefices} />
      </div>

      {/* Contributeurs */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Contributeurs</h3>
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{fiche.author.name} · auteur</span>
          {fiche.contributors.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              {c.name}
              {canEdit && (
                <button onClick={() => removeContributor(c.id)} className="hover:text-red-500"><X size={11} /></button>
              )}
            </span>
          ))}
        </div>
        {canEdit && (
          <form onSubmit={handleAddContributor} className="flex gap-2 pt-1">
            <input value={contributorEmail} onChange={(e) => setContributorEmail(e.target.value)} type="email" placeholder="email@exemple.com" className={inputCls} />
            <button type="submit" className="shrink-0 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Ajouter</button>
          </form>
        )}
        {contributorError && <p className="text-sm text-red-500">{contributorError}</p>}
      </div>

      {showAbandon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAbandon(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 dark:border-gray-800 p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Motif d'abandon</h2>
            <textarea value={abandonReason} onChange={(e) => setAbandonReason(e.target.value)} rows={3} placeholder="Pourquoi cette fiche est-elle abandonnée ?" className={`${inputCls} resize-none`} autoFocus />
            <div className="flex gap-3">
              <button onClick={() => setShowAbandon(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
              <button onClick={confirmAbandon} disabled={!abandonReason.trim()} className="flex-1 py-2.5 rounded-xl bg-gray-700 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50">Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
