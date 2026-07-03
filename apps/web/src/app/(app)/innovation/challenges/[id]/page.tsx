'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft, Trophy, User } from 'lucide-react'
import { useChallenge, type ChallengeStatus } from '@/hooks/useChallenges'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { ModuleShareModal } from '@/components/share/module-share-modal'

const STATUSES: { key: ChallengeStatus; label: string; color: string }[] = [
  { key: 'DRAFT', label: 'Brouillon', color: '#6b7280' },
  { key: 'OPEN', label: 'Ouvert', color: '#16a34a' },
  { key: 'EVALUATION', label: 'En évaluation', color: '#2563eb' },
  { key: 'CLOSED', label: 'Clôturé', color: '#dc2626' },
]

function frDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ChallengeDetailPage() {
  useFlagGuard('module.innovation')
  const { id } = useParams<{ id: string }>()
  const { challenge, isLoading, notFound, updateChallenge, removeEntry, setWinners } = useChallenge(id)

  const [showShare, setShowShare] = useState(false)
  const [selectingWinners, setSelectingWinners] = useState(false)
  const [selectedWinners, setSelectedWinners] = useState<Set<string>>(new Set())

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>
  }
  if (notFound || !challenge) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Challenge introuvable.</p>
        <Link href="/innovation/challenges" className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700"><ChevronLeft size={16} />Retour aux challenges</Link>
      </div>
    )
  }

  const canEvaluate = challenge.canManage && (challenge.status === 'EVALUATION' || challenge.status === 'CLOSED')

  function startSelectingWinners() {
    setSelectedWinners(new Set(challenge!.entries.filter((e) => e.isWinner).map((e) => e.fiche.id)))
    setSelectingWinners(true)
  }

  function toggleWinner(ficheId: string) {
    setSelectedWinners((prev) => {
      const next = new Set(prev)
      if (next.has(ficheId)) next.delete(ficheId); else next.add(ficheId)
      return next
    })
  }

  async function saveWinners() {
    await setWinners(Array.from(selectedWinners))
    setSelectingWinners(false)
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <Link href="/innovation/challenges" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors w-fit"><ChevronLeft size={16} />Challenges</Link>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2"><Trophy size={28} style={{ color: '#eab308' }} />{challenge.nom}</h1>
          {challenge.theme && <p className="text-amber-600 dark:text-amber-400 font-medium mt-1">{challenge.theme}</p>}
          {(challenge.opensAt || challenge.closesAt) && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{frDate(challenge.opensAt)}{challenge.closesAt ? ` → ${frDate(challenge.closesAt)}` : ''}</p>
          )}
        </div>
        {challenge.canManage && (
          <button onClick={() => setShowShare(true)} className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Partager</button>
        )}
      </div>

      {/* Statut */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            disabled={!challenge.canManage}
            onClick={() => updateChallenge({ status: s.key })}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={challenge.status === s.key ? { background: s.color, color: 'white' } : { background: s.color + '1a', color: s.color, opacity: challenge.canManage ? 1 : 0.6 }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">{challenge.description}</p>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Fiches inscrites ({challenge.entries.length})</h2>
        {canEvaluate && !selectingWinners && (
          <button onClick={startSelectingWinners} className="text-sm font-medium text-amber-600 hover:text-amber-700">Désigner les lauréats</button>
        )}
        {selectingWinners && (
          <div className="flex gap-2">
            <button onClick={() => setSelectingWinners(false)} className="text-sm font-medium text-gray-500 hover:text-gray-700">Annuler</button>
            <button onClick={saveWinners} className="text-sm font-semibold text-amber-600 hover:text-amber-700">Enregistrer</button>
          </div>
        )}
      </div>

      {challenge.entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400">
          <Trophy className="w-8 h-8 opacity-30" />
          <p className="text-sm font-medium">Aucune fiche inscrite pour l'instant</p>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
          {challenge.entries.map((e) => (
            <div key={e.fiche.id} className={`flex flex-col gap-2 bg-white dark:bg-gray-900 border rounded-2xl p-4 ${e.isWinner ? 'border-amber-400 ring-1 ring-amber-200 dark:ring-amber-900' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex items-start justify-between gap-2">
                {selectingWinners ? (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={selectedWinners.has(e.fiche.id)} onChange={() => toggleWinner(e.fiche.id)} className="mt-1 accent-amber-500" />
                    <Link href={`/innovation/${e.fiche.id}`} className="text-sm font-bold text-gray-900 dark:text-white hover:underline line-clamp-2">{e.fiche.title}</Link>
                  </label>
                ) : (
                  <Link href={`/innovation/${e.fiche.id}`} className="text-sm font-bold text-gray-900 dark:text-white hover:underline line-clamp-2">{e.fiche.title}</Link>
                )}
                {e.isWinner && <span className="text-lg shrink-0">🏆</span>}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{e.fiche.pitch}</p>
              <div className="flex items-center justify-between gap-2 pt-1 mt-auto text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1 truncate"><User size={11} />{e.fiche.author.name}</span>
                {!selectingWinners && (
                  <button onClick={() => removeEntry(e.fiche.id)} className="text-gray-400 hover:text-red-500">Retirer</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showShare && (
        <ModuleShareModal module="challenge" resourceId={challenge.id} resourceName={challenge.nom} onClose={() => setShowShare(false)} />
      )}
    </div>
  )
}
