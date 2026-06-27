'use client'

import { use, useState, useEffect, useRef } from 'react'
import { useQuizParticipant } from '@/hooks/useQuizSocket'
import { Zap, Trophy } from 'lucide-react'

const OPTION_COLORS = [
  'bg-red-500 hover:bg-red-400 active:bg-red-600',
  'bg-blue-500 hover:bg-blue-400 active:bg-blue-600',
  'bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600',
  'bg-green-500 hover:bg-green-400 active:bg-green-600',
  'bg-purple-500 hover:bg-purple-400 active:bg-purple-600',
  'bg-orange-500 hover:bg-orange-400 active:bg-orange-600',
  'bg-teal-500 hover:bg-teal-400 active:bg-teal-600',
  'bg-pink-500 hover:bg-pink-400 active:bg-pink-600',
]
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

function Timer({ endsAt }: { endsAt: string }) {
  const [seconds, setSeconds] = useState(0)
  const [total, setTotal] = useState(30)

  useEffect(() => {
    const end = new Date(endsAt).getTime()
    const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000))
    setTotal(remaining)

    function update() {
      const r = Math.max(0, Math.ceil((end - Date.now()) / 1000))
      setSeconds(r)
    }
    update()
    const id = setInterval(update, 500)
    return () => clearInterval(id)
  }, [endsAt])

  const pct = total > 0 ? (seconds / total) * 100 : 0
  const color = pct > 50 ? 'bg-green-500' : pct > 25 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="flex items-center gap-3">
      <span className="text-2xl font-black text-white w-10 text-center">{seconds}</span>
      <div className="flex-1 h-3 bg-white/20 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function QuizJoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const {
    state, reveal, leaderboard, ended,
    participantId, hasAnswered, streak, multiplier, error,
    join, answer,
  } = useQuizParticipant()

  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)
  const [isJoined, setIsJoined] = useState(false)
  const [myName, setMyName] = useState('')
  const [myLastAnswer, setMyLastAnswer] = useState<number | null>(null)
  const questionStartRef = useRef<number>(Date.now())

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`klx_quiz_${code}`)
      if (stored) {
        const { participantName } = JSON.parse(stored) as { participantName: string }
        if (participantName) {
          setMyName(participantName)
          setJoining(true)
          join(code, participantName)
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  useEffect(() => {
    if (state && participantId && !isJoined) {
      setIsJoined(true)
      setJoining(false)
      try {
        sessionStorage.setItem(`klx_quiz_${code}`, JSON.stringify({ participantName: myName || name }))
      } catch {}
    }
  }, [state, participantId, isJoined, code, myName, name])

  useEffect(() => {
    if (state?.status === 'QUESTION') {
      setMyLastAnswer(null)
      questionStartRef.current = Date.now()
    }
  }, [state?.status, state?.currentQuestion])

  useEffect(() => {
    if (error) setJoining(false)
  }, [error])

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setMyName(name.trim())
    setJoining(true)
    join(code, name.trim())
  }

  function handleAnswer(idx: number) {
    if (hasAnswered || myLastAnswer !== null) return
    setMyLastAnswer(idx)
    const responseMs = Date.now() - questionStartRef.current
    answer(idx, responseMs)
  }

  // ── Join form ─────────────────────────────────────────────────────────────
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-600 to-rose-800 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <Zap className="w-12 h-12 text-white mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-white">Quiz interactif</h1>
            <p className="text-rose-200 mt-1 font-mono text-sm">{code.toUpperCase()}</p>
          </div>

          <form onSubmit={handleJoin} className="bg-white rounded-2xl shadow-xl p-6 flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Votre prénom</label>
              <input
                autoFocus
                type="text"
                placeholder="Marie, Thomas…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={joining || !name.trim()}
              className="w-full rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
            >
              {joining ? 'Connexion…' : 'Rejoindre'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── ENDED ─────────────────────────────────────────────────────────────────
  if (state?.status === 'ENDED' && ended) {
    const myRank = ended.podium.find((p) => p.name === (myName || name))
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500 to-amber-700 flex flex-col items-center justify-center p-4 gap-6">
        <Trophy className="w-16 h-16 text-white" />
        <h1 className="text-3xl font-black text-white">Quiz terminé !</h1>
        {myRank && (
          <div className="text-center">
            <p className="text-amber-200 text-sm">Votre classement</p>
            <p className="text-5xl font-black text-white">#{myRank.rank}</p>
            <p className="text-xl font-bold text-amber-100 mt-1">{myRank.score.toLocaleString()} pts</p>
          </div>
        )}
        <div className="bg-white/20 rounded-2xl p-5 w-full max-w-xs">
          {ended.podium.slice(0, 3).map((p, idx) => (
            <div key={p.name} className="flex items-center gap-3 py-2">
              <span className="text-lg font-bold text-amber-200 w-6">{idx + 1}</span>
              <span className={`flex-1 font-semibold text-white ${p.name === (myName || name) ? 'underline' : ''}`}>{p.name}</span>
              {p.bestStreak >= 2 && <span className="text-orange-200 text-sm">🔥{p.bestStreak}</span>}
              <span className="font-bold text-amber-100">{p.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── LOBBY ─────────────────────────────────────────────────────────────────
  if (!state || state.status === 'LOBBY') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-600 to-rose-800 flex flex-col items-center justify-center gap-6 p-4">
        <Zap className="w-12 h-12 text-white animate-pulse" />
        <div className="text-center">
          <p className="text-rose-200 text-sm">{state?.quizTitle}</p>
          <h1 className="text-2xl font-bold text-white mt-1">En attente du démarrage…</h1>
          <p className="text-rose-200 text-sm mt-1">Bienvenue {myName || name} !</p>
        </div>
        <div className="bg-white/20 rounded-2xl px-6 py-3 text-white text-sm">
          {state?.participants.length ?? 0} participant{(state?.participants.length ?? 0) !== 1 ? 's' : ''} connecté{(state?.participants.length ?? 0) !== 1 ? 's' : ''}
        </div>
      </div>
    )
  }

  // ── LEADERBOARD ───────────────────────────────────────────────────────────
  if (state.status === 'LEADERBOARD' && leaderboard) {
    const myEntry = leaderboard.podium.find((p) => p.name === (myName || name))
    const myRankNum = leaderboard.podium.findIndex((p) => p.name === (myName || name)) + 1
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-indigo-800 flex flex-col items-center justify-center p-4 gap-6">
        <h1 className="text-2xl font-black text-white">Classement</h1>
        {myEntry && (
          <div className="text-center">
            <p className="text-indigo-200 text-sm">Votre position</p>
            <p className="text-5xl font-black text-white">#{myRankNum}</p>
            <p className="text-lg font-semibold text-indigo-200">{myEntry.score.toLocaleString()} pts</p>
          </div>
        )}
        <div className="bg-white/20 rounded-2xl p-4 w-full max-w-xs">
          {leaderboard.podium.slice(0, 5).map((p, idx) => (
            <div key={p.name} className={`flex items-center gap-3 py-2 ${p.name === (myName || name) ? 'font-bold' : ''}`}>
              <span className="text-lg text-indigo-200 w-6">{idx + 1}</span>
              <span className="flex-1 text-white text-sm">{p.name}</span>
              {p.streak >= 2 && <span className="text-orange-300 text-sm">🔥{p.streak}</span>}
              <span className="text-indigo-200 text-sm">{p.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <p className="text-indigo-200 text-sm animate-pulse">En attente de la prochaine question…</p>
      </div>
    )
  }

  // ── REVEAL ────────────────────────────────────────────────────────────────
  if (state.status === 'REVEAL' && reveal && state.question) {
    const wasCorrect = myLastAnswer !== null && myLastAnswer === reveal.correct
    const myScore = state.participants.find((p) => p.name === (myName || name))?.score ?? 0
    const myRevealEntry = reveal.scores.find((s) => s.name === (myName || name))
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-6 p-4 ${wasCorrect ? 'bg-gradient-to-br from-green-600 to-green-800' : 'bg-gradient-to-br from-red-600 to-red-800'}`}>
        <div className="text-6xl">{wasCorrect ? '✅' : '❌'}</div>
        <h2 className="text-2xl font-black text-white">{wasCorrect ? 'Bonne réponse !' : myLastAnswer === null ? 'Temps écoulé !' : 'Mauvaise réponse'}</h2>
        {myRevealEntry && myRevealEntry.delta > 0 && (
          <div className="text-center">
            <p className="text-white/80 text-sm">Points gagnés</p>
            <p className="text-4xl font-black text-white">+{myRevealEntry.delta.toLocaleString()}</p>
            {streak >= 2 && (
              <p className="text-sm font-semibold text-orange-300 mt-1">🔥 Série de {streak} · ×{multiplier.toFixed(1)}</p>
            )}
          </div>
        )}
        <div className="bg-white/20 rounded-2xl px-6 py-3 text-center">
          <p className="text-white/80 text-sm">Score total</p>
          <p className="text-2xl font-bold text-white">{myScore.toLocaleString()} pts</p>
        </div>
        <p className="text-white/70 text-sm animate-pulse">En attente du classement…</p>
      </div>
    )
  }

  // ── QUESTION ──────────────────────────────────────────────────────────────
  if (state.status === 'QUESTION' && state.question) {
    const q = state.question

    if (hasAnswered || myLastAnswer !== null) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center gap-6 p-4">
          <div className="text-5xl animate-bounce">⏳</div>
          <h2 className="text-xl font-bold text-white">Vote envoyé !</h2>
          {streak >= 2 && (
            <div className="bg-orange-500/20 border border-orange-500/30 rounded-2xl px-6 py-3 text-center">
              <p className="text-orange-300 text-xs font-medium mb-1">Multiplicateur de série</p>
              <p className="text-2xl font-black text-orange-400">🔥 ×{multiplier.toFixed(1)}</p>
              <p className="text-orange-300 text-xs mt-1">{streak} bonnes réponses d'affilée</p>
            </div>
          )}
          <p className="text-gray-400 text-sm">En attente des autres joueurs…</p>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="bg-gray-800 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-400">Q{q.index + 1}/{q.total}</span>
            {streak >= 2 && (
              <span className="text-xs font-semibold text-orange-400">🔥 Série de {streak} · ×{multiplier.toFixed(1)}</span>
            )}
            <span className="text-xs font-medium text-gray-400">{q.points} pts</span>
          </div>
          {state.questionEndAt && <Timer endsAt={state.questionEndAt} />}
        </div>

        <div className="px-4 py-5 text-center">
          <p className="text-lg font-bold text-white">{q.text}</p>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-3 p-4">
          {q.options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              className={`${OPTION_COLORS[idx] ?? 'bg-gray-500'} rounded-2xl p-5 flex flex-col items-center justify-center gap-3 text-white font-bold transition-all active:scale-95`}
            >
              <span className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl font-black">
                {OPTION_LABELS[idx]}
              </span>
              <span className="text-sm text-center leading-tight">{opt}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-gray-400 text-sm animate-pulse">En attente…</p>
    </div>
  )
}
