'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft, Star, Trash2, Trophy, User } from 'lucide-react'
import { useChallenge, type ChallengeStatus } from '@/hooks/useChallenges'
import { useOrgUnits } from '@/hooks/useInnovationOrg'
import { useCriteria, useJurors, useMyScores, useRanking, type Criterion } from '@/hooks/useScoring'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { ModuleShareModal } from '@/components/share/module-share-modal'

const STATUSES: { key: ChallengeStatus; label: string; color: string }[] = [
  { key: 'DRAFT', label: 'Brouillon', color: '#6b7280' },
  { key: 'OPEN', label: 'Ouvert', color: '#16a34a' },
  { key: 'EVALUATION', label: 'En évaluation', color: '#2563eb' },
  { key: 'CLOSED', label: 'Clôturé', color: '#dc2626' },
]

const inputCls = 'w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

function frDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Panneau admin : critères de notation ─────────────────────────────────────────
function CriteriaPanel({ challengeId, locked }: { challengeId: string; locked: boolean }) {
  const { criteria, addCriterion, removeCriterion } = useCriteria(challengeId)
  const [label, setLabel] = useState('')
  const [poids, setPoids] = useState(1)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    await addCriterion(label.trim(), poids)
    setLabel('')
    setPoids(1)
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Critères de notation</h2>
      {locked && <p className="text-xs text-amber-600 dark:text-amber-400">Verrouillés — le challenge est en évaluation ou clôturé.</p>}
      {criteria.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun critère défini. Sans critère, les jurés ne pourront pas noter.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {criteria.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              {c.label} <span className="text-gray-400">(poids {c.poids})</span>
              {!locked && <button onClick={() => removeCriterion(c.id)} className="hover:text-red-500"><Trash2 size={11} /></button>}
            </span>
          ))}
        </div>
      )}
      {!locked && (
        <form onSubmit={handleAdd} className="flex gap-2 pt-1">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nom du critère (ex. Impact)" className={inputCls} />
          <select value={poids} onChange={(e) => setPoids(Number(e.target.value))} className={`${inputCls} w-24`}>
            {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>Poids {p}</option>)}
          </select>
          <button type="submit" className="shrink-0 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Ajouter</button>
        </form>
      )}
    </div>
  )
}

// ── Panneau admin : jurés ─────────────────────────────────────────────────────────
function JurorsPanel({ challengeId }: { challengeId: string }) {
  const { jurors, addJuror, removeJuror } = useJurors(challengeId, true)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setError(null)
    try {
      await addJuror(email.trim())
      setEmail('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Jurés</h2>
      {jurors.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun juré désigné pour l'instant.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {jurors.map((j) => (
            <span key={j.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              {j.user.name}
              <button onClick={() => removeJuror(j.user.id)} className="hover:text-red-500"><Trash2 size={11} /></button>
            </span>
          ))}
        </div>
      )}
      <form onSubmit={handleAdd} className="flex gap-2 pt-1">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="email@exemple.com" className={inputCls} />
        <button type="submit" className="shrink-0 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Ajouter</button>
      </form>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}

// ── Modale de notation pour le juré courant ──────────────────────────────────────
function ScoreModal({ challengeId, ficheId, ficheTitle, criteria, onClose }: {
  challengeId: string
  ficheId: string
  ficheTitle: string
  criteria: Criterion[]
  onClose: () => void
}) {
  const { scores, submit } = useMyScores(challengeId, ficheId, true)
  const [notes, setNotes] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  const noteFor = (criterionId: string) => notes[criterionId] ?? scores.find((s) => s.criterionId === criterionId)?.note ?? 5

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await submit(criteria.map((c) => ({ criterionId: c.id, note: noteFor(c.id) })))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Noter « {ficheTitle} »</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {criteria.map((c) => (
            <div key={c.id}>
              <label className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {c.label} <span className="text-amber-600 dark:text-amber-400 font-bold">{noteFor(c.id)}/10</span>
              </label>
              <input
                type="range" min={0} max={10} value={noteFor(c.id)}
                onChange={(e) => setNotes((prev) => ({ ...prev, [c.id]: Number(e.target.value) }))}
                className="w-full accent-amber-500"
              />
            </div>
          ))}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-60">{saving ? 'Envoi…' : 'Enregistrer la note'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Classement ────────────────────────────────────────────────────────────────────
function RankingPanel({ challengeId, enabled }: { challengeId: string; enabled: boolean }) {
  const { ranking } = useRanking(challengeId, enabled)
  if (!ranking) return null

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Classement</h2>
      {ranking.length === 0 ? (
        <p className="text-sm text-gray-400">Aucune fiche inscrite.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {ranking.map((r, i) => (
            <li key={r.entryId} className="flex items-center gap-3 rounded-xl px-2 py-1.5 -mx-2">
              <span className="w-5 text-sm font-bold text-gray-300 dark:text-gray-600 shrink-0">{i + 1}</span>
              <Link href={`/innovation/${r.fiche.id}`} className="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-gray-100 truncate hover:underline">{r.fiche.title}</Link>
              <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                <Star size={11} />{r.weightedAverage !== null ? r.weightedAverage.toFixed(1) : '—'}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default function ChallengeDetailPage() {
  useFlagGuard('module.innovation')
  const { id } = useParams<{ id: string }>()
  const { challenge, isLoading, notFound, updateChallenge, removeEntry, setWinners } = useChallenge(id)
  const { units } = useOrgUnits()
  const { criteria } = useCriteria(id)

  const [showShare, setShowShare] = useState(false)
  const [selectingWinners, setSelectingWinners] = useState(false)
  const [selectedWinners, setSelectedWinners] = useState<Set<string>>(new Set())
  const [scoringFicheId, setScoringFicheId] = useState<string | null>(null)

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
  const canScore = challenge.isJuror && challenge.status === 'EVALUATION' && criteria.length > 0
  const showRanking = challenge.status === 'CLOSED' || (challenge.canManage && challenge.status === 'EVALUATION')
  const scoringFiche = challenge.entries.find((e) => e.fiche.id === scoringFicheId)?.fiche

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
          {challenge.orgUnitRef && (
            <p className="text-xs text-gray-400 mt-1">Éligibilité : {units.find((u) => u.ref === challenge.orgUnitRef)?.nom ?? challenge.orgUnitRef} et son périmètre</p>
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

      {challenge.canManage && (
        <>
          <CriteriaPanel challengeId={challenge.id} locked={challenge.status === 'EVALUATION' || challenge.status === 'CLOSED'} />
          <JurorsPanel challengeId={challenge.id} />
        </>
      )}

      {showRanking && <RankingPanel challengeId={challenge.id} enabled={showRanking} />}

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
                <div className="flex items-center gap-2 shrink-0">
                  {canScore && (
                    <button onClick={() => setScoringFicheId(e.fiche.id)} className="text-amber-600 dark:text-amber-400 font-semibold hover:text-amber-700">Noter</button>
                  )}
                  {!selectingWinners && (
                    <button onClick={() => removeEntry(e.fiche.id)} className="text-gray-400 hover:text-red-500">Retirer</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showShare && (
        <ModuleShareModal module="challenge" resourceId={challenge.id} resourceName={challenge.nom} onClose={() => setShowShare(false)} />
      )}

      {scoringFiche && (
        <ScoreModal challengeId={challenge.id} ficheId={scoringFiche.id} ficheTitle={scoringFiche.title} criteria={criteria} onClose={() => setScoringFicheId(null)} />
      )}
    </div>
  )
}
