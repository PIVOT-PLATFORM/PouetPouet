'use client'

import { use, useEffect, useState } from 'react'
import { useQuizHost } from '@/hooks/useQuizSocket'
import { ChevronLeft, ChevronRight, Users, Play, Trophy, Clock, Copy, Check } from 'lucide-react'
import Link from 'next/link'

const OPTION_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500']
const OPTION_LABELS = ['A', 'B', 'C', 'D']

function Timer({ endsAt }: { endsAt: string }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    function update() {
      const remaining = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000))
      setSeconds(remaining)
    }
    update()
    const id = setInterval(update, 500)
    return () => clearInterval(id)
  }, [endsAt])

  const pct = seconds > 0 ? (seconds / 30) * 100 : 0
  return (
    <div className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
      <Clock className="w-6 h-6 text-rose-500" />
      {seconds}s
      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-rose-500 transition-all duration-500 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function QuizSessionPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id: quizId, sessionId } = use(params)
  const { state, reveal, leaderboard, ended, error, start, next, end } = useQuizHost(sessionId)
  const [copied, setCopied] = useState(false)

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/quiz/join/${state?.code ?? '...'}`
    : ''

  function copyLink() {
    if (!state?.code) return
    navigator.clipboard.writeText(joinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-500">{error}</p>
        <Link href={`/quiz/${quizId}`} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ChevronLeft className="w-5 h-5" /> Retour
        </Link>
      </div>
    )
  }

  if (!state) {
    return <div className="text-center py-12 text-gray-400 text-sm">Connexion…</div>
  }

  // ── ENDED ─────────────────────────────────────────────────────────────────
  if (state.status === 'ENDED' && ended) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-500" />
          Résultats finaux — {state.quizTitle}
        </h1>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
          {ended.podium.map((p) => (
            <div key={p.name} className="flex items-center gap-4 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <span className="text-lg font-bold text-gray-400 w-8">{p.rank}</span>
              <span className="flex-1 font-semibold text-gray-900 dark:text-gray-100">{p.name}</span>
              <span className="font-bold text-rose-600">{p.score.toLocaleString()} pts</span>
            </div>
          ))}
        </div>
        <Link href={`/quiz/${quizId}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeft className="w-5 h-5" /> Retour à l'éditeur
        </Link>
      </div>
    )
  }

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  if (state.status === 'LOBBY') {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Link href="/quiz" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{state.quizTitle}</h1>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 text-center">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Code de session</p>
          <p className="text-5xl font-black tracking-widest text-gray-900 dark:text-gray-100 mb-4">{state.code}</p>
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Lien copié !' : 'Copier le lien d\'invitation'}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {state.participants.length} participant{state.participants.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {state.participants.map((p) => (
              <span key={p.id} className="rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-medium px-3 py-1.5 text-gray-700 dark:text-gray-300">
                {p.name}
              </span>
            ))}
            {state.participants.length === 0 && (
              <p className="text-xs text-gray-400">En attente des participants…</p>
            )}
          </div>
        </div>

        <button
          onClick={start}
          disabled={state.participants.length === 0}
          className="flex items-center justify-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-base font-semibold py-4 disabled:opacity-50 transition-colors"
        >
          <Play className="w-5 h-5" />
          Démarrer le quiz
        </button>
      </div>
    )
  }

  // ── QUESTION ──────────────────────────────────────────────────────────────
  if (state.status === 'QUESTION' && state.question) {
    const q = state.question
    const answeredCount = reveal ? reveal.stats.reduce((a, b) => a + b, 0) : 0
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Question {q.index + 1} / {q.total}
          </p>
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <Users className="w-4 h-4" />
            {state.participants.length} participants
          </div>
        </div>

        {state.questionEndAt && <Timer endsAt={state.questionEndAt} />}

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{q.text}</p>
          <p className="text-xs text-gray-400 mt-2">{q.points} pts max</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {q.options.map((opt, idx) => (
            <div key={idx} className={`${OPTION_COLORS[idx] ?? 'bg-gray-400'} rounded-2xl p-4 flex items-center gap-3 text-white`}>
              <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-sm font-bold">{OPTION_LABELS[idx]}</span>
              <span className="font-semibold text-sm">{opt}</span>
            </div>
          ))}
        </div>

        <div className="text-center text-sm text-gray-400">
          {answeredCount} / {state.participants.length} réponse{answeredCount !== 1 ? 's' : ''} reçue{answeredCount !== 1 ? 's' : ''}
        </div>
      </div>
    )
  }

  // ── REVEAL ────────────────────────────────────────────────────────────────
  if (state.status === 'REVEAL' && state.question && reveal) {
    const q = state.question
    const total = reveal.stats.reduce((a, b) => a + b, 0) || 1
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Question {q.index + 1} / {q.total} — Résultat
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{q.text}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {q.options.map((opt, idx) => {
            const pct = Math.round((reveal.stats[idx] ?? 0) / total * 100)
            const isCorrect = idx === reveal.correct
            return (
              <div
                key={idx}
                className={`rounded-2xl p-4 flex flex-col gap-2 ${isCorrect ? `${OPTION_COLORS[idx] ?? 'bg-gray-400'} text-white` : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 opacity-60'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-xs font-bold">{OPTION_LABELS[idx]}</span>
                  <span className="font-semibold text-sm">{opt}</span>
                  <span className="ml-auto text-sm font-bold">{reveal.stats[idx] ?? 0}</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={next}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-white text-white dark:text-gray-900 text-base font-semibold py-4 transition-colors"
        >
          Voir le classement
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    )
  }

  // ── LEADERBOARD ───────────────────────────────────────────────────────────
  if (state.status === 'LEADERBOARD' && leaderboard) {
    const isLast = state.currentQuestion + 1 >= state.totalQuestions
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          Classement — Q{state.currentQuestion + 1}/{state.totalQuestions}
        </h2>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {leaderboard.podium.slice(0, 5).map((p, idx) => (
            <div key={p.name} className="flex items-center gap-4 px-5 py-3">
              <span className="text-lg font-bold text-gray-300 dark:text-gray-600 w-7">{idx + 1}</span>
              <span className="flex-1 font-semibold text-gray-900 dark:text-gray-100">{p.name}</span>
              <span className="font-bold text-rose-600">{p.score.toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          {isLast ? (
            <button
              onClick={end}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-base font-semibold py-4 transition-colors"
            >
              <Trophy className="w-5 h-5" />
              Terminer
            </button>
          ) : (
            <button
              onClick={next}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-white text-white dark:text-gray-900 text-base font-semibold py-4 transition-colors"
            >
              Question suivante
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return <div className="text-center py-12 text-gray-400 text-sm">En attente…</div>
}
