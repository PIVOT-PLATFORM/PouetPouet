'use client'

import type { VoteSession, Card } from '@/hooks/useBoard'
import { cardDisplayText } from '@/lib/card-format'

interface Props {
  session: VoteSession
  cards: Card[]
  isHistory?: boolean
  isOwner?: boolean
  onClose: () => void
  onStopVote?: () => void
}

interface CardResult {
  card: Card
  count: number
}

function buildResults(session: VoteSession, cards: Card[]): CardResult[] {
  const counts: Record<string, number> = {}
  for (const vote of session.votes) {
    counts[vote.cardId] = (counts[vote.cardId] ?? 0) + 1
  }
  return cards
    .filter((c) => counts[c.id] !== undefined)
    .map((c) => ({ card: c, count: counts[c.id] }))
    .sort((a, b) => b.count - a.count)
}

export function VoteResultsPanel({ session, cards, isHistory = false, isOwner = false, onClose, onStopVote }: Props) {
  const results = buildResults(session, cards)
  const totalVotes = session.votes.length
  const maxCount = results[0]?.count ?? 1

  const closedAt = session.closedAt ? new Date(session.closedAt) : null
  const duration = closedAt && session.createdAt
    ? Math.round((closedAt.getTime() - new Date(session.createdAt).getTime()) / 1000)
    : null

  function formatDuration(s: number) {
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m${s % 60 > 0 ? ` ${s % 60}s` : ''}`
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-white font-bold text-lg leading-tight">
                  {isHistory ? 'Dernier vote' : 'Résultats du vote'}
                </h2>
                <p className="text-white/70 text-xs mt-0.5">
                  {totalVotes} vote{totalVotes !== 1 ? 's' : ''} · {session.voterIds.length} participant{session.voterIds.length !== 1 ? 's' : ''}
                  {duration !== null && ` · ${formatDuration(duration)}`}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Stats row */}
          <div className="flex gap-3 mt-4">
            <div className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-center">
              <p className="text-white font-bold text-lg">{session.votesPerPerson}</p>
              <p className="text-white/60 text-xs">votes/pers.</p>
            </div>
            <div className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-center">
              <p className="text-white font-bold text-lg">{results.length}</p>
              <p className="text-white/60 text-xs">post-its votés</p>
            </div>
            <div className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-center">
              <p className="text-white font-bold text-lg">{results[0]?.count ?? 0}</p>
              <p className="text-white/60 text-xs">votes max</p>
            </div>
          </div>
        </div>

        {/* Results list */}
        <div className="p-4 space-y-2.5 max-h-[50vh] overflow-y-auto">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm font-medium">Aucun vote enregistré</p>
            </div>
          ) : results.map((r, i) => {
            const pct = Math.round((r.count / maxCount) * 100)
            const isFirst = i === 0
            return (
              <div key={r.card.id} className={`relative flex items-center gap-3 px-4 py-3 rounded-xl border overflow-hidden ${isFirst ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 bg-gray-50'}`}>
                {/* Progress bar background */}
                <div
                  className={`absolute inset-y-0 left-0 transition-all ${isFirst ? 'bg-indigo-100' : 'bg-gray-100'}`}
                  style={{ width: `${pct}%` }}
                />
                {/* Rank */}
                <span className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isFirst ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {i + 1}
                </span>
                {/* Card color dot */}
                <div className="relative z-10 w-3 h-3 rounded-full shrink-0 border border-black/10" style={{ background: r.card.color }} />
                {/* Content */}
                <p className={`relative z-10 flex-1 text-sm font-medium truncate ${isFirst ? 'text-indigo-800' : 'text-gray-700'}`}>
                  {cardDisplayText(r.card) || <span className="italic text-gray-400">Post-it vide</span>}
                </p>
                {/* Vote count */}
                <span className={`relative z-10 shrink-0 text-sm font-bold ${isFirst ? 'text-indigo-600' : 'text-gray-500'}`}>
                  {r.count} vote{r.count > 1 ? 's' : ''}
                </span>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          {!isHistory && (
            <div className="relative flex-1 group">
              <button
                disabled={!isOwner}
                onClick={isOwner ? () => { onStopVote?.(); onClose() } : undefined}
                className={`w-full py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  isOwner
                    ? 'border-red-200 text-red-600 hover:bg-red-50 cursor-pointer'
                    : 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                }`}
              >
                Terminer le vote
              </button>
              {!isOwner && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Seul le propriétaire peut terminer le vote
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                </div>
              )}
            </div>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
