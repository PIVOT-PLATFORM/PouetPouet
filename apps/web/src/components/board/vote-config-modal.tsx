'use client'

import { useState } from 'react'
import type { BoardMember } from '@/hooks/useBoard'

interface Props {
  members: BoardMember[]
  currentUserId: string
  onStart: (config: { votesPerPerson: number; timerSeconds: number | null; voterIds: string[] }) => void
  onClose: () => void
}

const TIMER_PRESETS = [
  { label: '1 min', seconds: 60 },
  { label: '2 min', seconds: 120 },
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
]

export function VoteConfigModal({ members, currentUserId, onStart, onClose }: Props) {
  const [votesPerPerson, setVotesPerPerson] = useState(3)
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(120)
  const [timerCustomMin, setTimerCustomMin] = useState('2')
  const [timerCustomSec, setTimerCustomSec] = useState('00')
  const [selectedVoters, setSelectedVoters] = useState<Set<string>>(
    new Set(members.map((m) => m.id))
  )

  function toggleVoter(id: string) {
    setSelectedVoters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() { setSelectedVoters(new Set(members.map((m) => m.id))) }
  function selectNone() { setSelectedVoters(new Set()) }

  function handleCustomTimer() {
    const m = Math.max(0, parseInt(timerCustomMin) || 0)
    const s = Math.max(0, Math.min(59, parseInt(timerCustomSec) || 0))
    const total = m * 60 + s
    if (total > 0) setTimerSeconds(total)
  }

  function handleStart() {
    if (selectedVoters.size === 0) return
    onStart({
      votesPerPerson,
      timerSeconds: timerEnabled ? timerSeconds : null,
      voterIds: Array.from(selectedVoters),
    })
    onClose()
  }

  function formatSeconds(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-br from-primary-500 to-secondary-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-white font-bold text-lg leading-tight">Configurer le vote</h2>
                <p className="text-white/70 text-xs mt-0.5">Paramétrez la session de vote pour ce board</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">

          {/* Votes per person */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Votes par personne
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setVotesPerPerson((v) => Math.max(1, v - 1))}
                className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 font-bold text-lg transition-colors"
              >−</button>
              <div className="flex-1 text-center">
                <span className="text-3xl font-bold text-primary-600">{votesPerPerson}</span>
                <p className="text-xs text-gray-400 mt-0.5">vote{votesPerPerson > 1 ? 's' : ''} par personne</p>
              </div>
              <button
                onClick={() => setVotesPerPerson((v) => Math.min(20, v + 1))}
                className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 font-bold text-lg transition-colors"
              >+</button>
            </div>
          </div>

          {/* Timer */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">Timer</label>
              <button
                onClick={() => setTimerEnabled((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${timerEnabled ? 'bg-primary-500' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${timerEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {timerEnabled && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {TIMER_PRESETS.map((p) => (
                    <button
                      key={p.seconds}
                      onClick={() => setTimerSeconds(p.seconds)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${timerSeconds === p.seconds ? 'bg-primary-500 border-primary-500 text-white' : 'border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-600'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      type="number" min={0} max={99}
                      value={timerCustomMin}
                      onChange={(e) => setTimerCustomMin(e.target.value)}
                      className="w-14 text-center border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                      placeholder="mm"
                    />
                    <span className="text-gray-400 font-bold">:</span>
                    <input
                      type="number" min={0} max={59}
                      value={timerCustomSec}
                      onChange={(e) => setTimerCustomSec(e.target.value)}
                      className="w-14 text-center border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                      placeholder="ss"
                    />
                  </div>
                  <button
                    onClick={handleCustomTimer}
                    className="px-3 py-1.5 rounded-lg bg-primary-50 text-primary-600 text-xs font-semibold hover:bg-primary-100 transition-colors"
                  >
                    Appliquer
                  </button>
                  <span className="text-sm text-gray-500 font-medium">{formatSeconds(timerSeconds)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Voters */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">
                Participants ({selectedVoters.size}/{members.length})
              </label>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs text-primary-500 hover:text-primary-700 font-medium">Tous</button>
                <span className="text-gray-300">·</span>
                <button onClick={selectNone} className="text-xs text-gray-400 hover:text-gray-600 font-medium">Aucun</button>
              </div>
            </div>
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {members.map((member) => {
                const selected = selectedVoters.has(member.id)
                const isMe = member.id === currentUserId
                return (
                  <button
                    key={member.id}
                    onClick={() => toggleVoter(member.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${selected ? 'border-primary-200 bg-primary-50' : 'border-gray-100 bg-gray-50 opacity-50'}`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? 'border-primary-500 bg-primary-500' : 'border-gray-300 bg-white'}`}>
                      {selected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    {member.avatar ? (
                      <img src={member.avatar} alt={member.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-secondary-500 flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">{member.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {member.name}{isMe && <span className="ml-1 text-xs text-primary-400 font-normal">(moi)</span>}
                      </p>
                      <p className="text-xs text-gray-400">{member.role === 'OWNER' ? 'Propriétaire' : member.role === 'EDITOR' ? 'Éditeur' : 'Lecteur'}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Annuler
          </button>
          <button
            onClick={handleStart}
            disabled={selectedVoters.size === 0}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-secondary-600 text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            Lancer le vote
          </button>
        </div>
      </div>
    </div>
  )
}
