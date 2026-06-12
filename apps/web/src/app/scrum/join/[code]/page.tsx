'use client'

import { use, useState, useEffect } from 'react'
import { useScrumParticipant } from '@/hooks/useScrumParticipant'
import { ESTIMATION_SCALES } from '@/hooks/useScrum'

export default function ScrumJoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const { room, isJoined, participantCount, myVotes, error, activeTicket, participantName, join, vote } = useScrumParticipant()
  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)

  // Store name in sessionStorage after successful join
  useEffect(() => {
    if (isJoined && participantName) {
      try { sessionStorage.setItem(`klx_scrum_${code}`, JSON.stringify({ participantName })) } catch {}
    }
  }, [isJoined, participantName, code])

  // Auto-rejoin on refresh if we have a stored name
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`klx_scrum_${code}`)
      if (stored) {
        const { participantName: storedName } = JSON.parse(stored) as { participantName: string }
        if (storedName) { setJoining(true); join(code, storedName) }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  useEffect(() => {
    if (error) setJoining(false)
  }, [error])

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setJoining(true)
    join(code, name.trim())
  }

  const ticket = activeTicket
  const currentScale = room?.scale ?? 'FIBONACCI'
  const myVote = ticket ? myVotes[`${ticket.id}:${currentScale}`] : null
  const hasVoted = !!myVote

  const scaleInfo = ESTIMATION_SCALES[room?.scale ?? 'FIBONACCI'] ?? ESTIMATION_SCALES.FIBONACCI

  // ── Join form ────────────────────────────────────────────────────────────────
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <span className="text-5xl mb-4 block">🃏</span>
            <h1 className="text-2xl font-bold text-gray-900">Scrum Poker</h1>
            <p className="text-gray-500 mt-1 font-mono text-sm">{code.toUpperCase()}</p>
          </div>

          <form onSubmit={handleJoin} className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Votre prénom</label>
              <input
                autoFocus
                type="text"
                placeholder="Marie, Thomas…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={joining || !name.trim()}
              className="w-full rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {joining ? 'Connexion…' : 'Rejoindre la salle'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Joined view ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur border-b border-gray-100">
        <div>
          <p className="text-xs text-gray-400">Scrum Poker · {scaleInfo.label}</p>
          <p className="font-bold text-gray-900">{room?.name}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          {participantCount} participant{participantCount !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* No active ticket */}
        {!ticket && (
          <div className="text-center">
            <span className="text-5xl block mb-4">⏳</span>
            <h2 className="text-lg font-semibold text-gray-700">En attente du prochain ticket…</h2>
            <p className="text-gray-400 text-sm mt-1">L'hôte va bientôt lancer un vote</p>
          </div>
        )}

        {/* Ticket active - VOTING and not yet voted */}
        {ticket && ticket.status === 'VOTING' && !hasVoted && (
          <div className="w-full max-w-sm">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5 mb-6">
              <p className="text-xs font-medium text-primary-500 uppercase tracking-wide mb-1">Ticket</p>
              <h2 className="text-lg font-bold text-gray-900">{ticket.title}</h2>
            </div>
            <p className="text-sm text-gray-500 text-center mb-4">Choisissez votre estimation ({scaleInfo.label})</p>
            <div className="grid grid-cols-4 gap-3">
              {scaleInfo.values.map((v) => (
                <button
                  key={v}
                  onClick={() => vote(ticket.id, v, ticket.roomId, currentScale)}
                  className="h-20 rounded-2xl bg-white border-2 border-gray-100 shadow-sm text-xl font-bold text-gray-800 hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 active:scale-95 transition-all"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Ticket active - VOTING and voted */}
        {ticket && ticket.status === 'VOTING' && hasVoted && (
          <div className="text-center">
            <div className="w-24 h-32 mx-auto rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center mb-4 shadow-xl">
              <span className="text-3xl font-bold text-white leading-tight text-center px-2">{myVote}</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-700">Vote envoyé !</h2>
            <p className="text-gray-400 text-sm mt-1">En attente de la révélation…</p>
          </div>
        )}

        {/* Ticket revealed */}
        {ticket && ticket.status === 'REVEALED' && (
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5 mb-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">{ticket.title}</h2>
              <div className="flex flex-wrap gap-3 justify-center">
                {ticket.votes.map((v) => (
                  <div key={v.id} className="flex flex-col items-center gap-1.5">
                    <div className={`w-14 h-20 rounded-xl shadow-md flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-600 ${
                      v.participantName === participantName ? 'ring-2 ring-offset-2 ring-primary-400' : ''
                    }`}>
                      <span className="text-lg font-bold text-white leading-tight text-center px-1">{v.value ?? '?'}</span>
                    </div>
                    <span className="text-xs text-gray-500 truncate max-w-[56px]">{v.participantName}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-center text-sm text-gray-400">En attente de l'estimation finale…</p>
          </div>
        )}

        {/* Ticket done */}
        {ticket && ticket.status === 'DONE' && (
          <div className="text-center">
            <span className="text-5xl block mb-4">✅</span>
            <h2 className="text-lg font-semibold text-gray-700">{ticket.title}</h2>
            <div className="mt-4 inline-block bg-green-100 rounded-2xl px-6 py-3">
              <p className="text-xs text-green-500 font-medium">Estimation</p>
              <p className="text-4xl font-bold text-green-700">
                {currentScale === 'TIME' ? ticket.estimateTime : ticket.estimate}{scaleInfo.suffix ? ` ${scaleInfo.suffix}` : ''}
              </p>
            </div>
            <p className="text-gray-400 text-sm mt-4">En attente du prochain ticket…</p>
          </div>
        )}
      </div>
    </div>
  )
}
