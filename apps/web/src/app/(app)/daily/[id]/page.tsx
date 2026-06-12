'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useDailySession } from '@/hooks/useDaily'
import type { DailyParticipant } from '@/hooks/useDaily'
import { formatTime, formatSessionTime } from '@/lib/time'

// ── Circular progress ─────────────────────────────────────────────────────────

function CircleTimer({ elapsed, total, children }: { elapsed: number; total: number; children: React.ReactNode }) {
  const radius = 72
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(elapsed / total, 1)
  const isOver = elapsed > total

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="90" cy="90" r={radius}
          fill="none"
          stroke={isOver ? '#ef4444' : '#6366f1'}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}

// ── Participant pill ──────────────────────────────────────────────────────────

function ParticipantPill({ p, index, isCurrent }: { p: DailyParticipant; index: number; isCurrent: boolean }) {
  const statusIcon = {
    WAITING: <span className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />,
    SPEAKING: <span className="w-5 h-5 rounded-full bg-primary-500 animate-pulse shrink-0" />,
    DONE: <span className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center text-white text-xs shrink-0">✓</span>,
    SKIPPED: <span className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs shrink-0">→</span>,
  }[p.status]

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
      isCurrent
        ? 'bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800'
        : p.status === 'DONE' || p.status === 'SKIPPED'
        ? 'opacity-50'
        : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800'
    }`}>
      {statusIcon}
      <span className={`text-sm font-medium flex-1 ${isCurrent ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}>
        {index + 1}. {p.name}
      </span>
      {(p.status === 'DONE' || p.status === 'SKIPPED') && p.speakingAt && p.doneSpeaking && (
        <span className="text-xs text-gray-400">
          {formatTime(Math.floor((new Date(p.doneSpeaking).getTime() - new Date(p.speakingAt).getTime()) / 1000))}
        </span>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DailySessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { session, isLoading, sessionElapsed, speakerElapsed, shuffle, start, next, skip, end } = useDailySession(id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <span className="text-4xl block mb-4">📅</span>
          <p className="text-gray-400">Chargement…</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-gray-500">Session introuvable.</p>
          <button onClick={() => router.push('/daily')} className="mt-4 text-primary-600 text-sm font-medium">
            Retour aux dailys
          </button>
        </div>
      </div>
    )
  }

  const currentSpeaker = session.participants.find((p) => p.status === 'SPEAKING') ?? null
  const nextSpeaker = currentSpeaker
    ? session.participants.find((p) => p.order === currentSpeaker.order + 1) ?? null
    : null
  const remaining = session.participants.filter((p) => p.status === 'WAITING').length
  const isLastSpeaker = remaining === 0 && session.status === 'RUNNING'
  const done = session.participants.filter((p) => p.status === 'DONE' || p.status === 'SKIPPED').length
  const speakerRemaining = session.timePerPerson - speakerElapsed
  const isOverTime = speakerElapsed > session.timePerPerson

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/daily" className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{session.name}</h1>

        {/* Global timer */}
        {session.startedAt && (
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-400 mb-0.5">Durée totale</p>
            <p className="text-2xl font-bold font-mono text-gray-700 dark:text-gray-200">
              {formatSessionTime(sessionElapsed)}
            </p>
          </div>
        )}
      </div>

      {/* ── PENDING state ── */}
      {session.status === 'PENDING' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 flex flex-col items-center gap-6">
          <div className="text-center">
            <span className="text-5xl block mb-3">🗓️</span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Prêt à démarrer</h2>
            <p className="text-gray-500 text-sm">
              {session.participants.length} participants · {Math.floor(session.timePerPerson / 60)}min par personne
            </p>
          </div>

          {/* Participant order preview */}
          <div className="w-full max-w-sm flex flex-col gap-2">
            {session.participants.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <span className="text-sm font-bold text-gray-400 w-5 text-center">{i + 1}</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.name}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={shuffle}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              🔀 Mélanger
            </button>
            <button
              onClick={start}
              className="flex items-center gap-2 px-6 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              ▶ Démarrer le daily
            </button>
          </div>
        </div>
      )}

      {/* ── RUNNING state ── */}
      {session.status === 'RUNNING' && currentSpeaker && (
        <>
          {/* Current speaker */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 flex flex-col items-center gap-4">
            <p className="text-xs font-semibold text-primary-500 uppercase tracking-widest">En train de parler</p>

            <CircleTimer elapsed={speakerElapsed} total={session.timePerPerson}>
              <span className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{currentSpeaker.name}</span>
              <span className={`text-3xl font-bold font-mono mt-1 ${isOverTime ? 'text-red-500' : 'text-primary-600'}`}>
                {isOverTime ? '+' : ''}{formatTime(Math.abs(speakerRemaining))}
              </span>
              {isOverTime && (
                <span className="text-xs text-red-400 mt-0.5">Temps dépassé</span>
              )}
            </CircleTimer>

            {/* Next up preview */}
            {nextSpeaker && (
              <div className="text-center py-2 px-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <p className="text-xs text-gray-400 mb-0.5">Suivant</p>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{nextSpeaker.name}</p>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-3 mt-2">
              {!isLastSpeaker && (
                <button
                  onClick={skip}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  Sauter →
                </button>
              )}
              <button
                onClick={isLastSpeaker ? end : next}
                className={`px-6 py-2 rounded-xl text-white text-sm font-semibold transition-colors ${
                  isLastSpeaker
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {isLastSpeaker ? '✓ Terminer le daily' : 'Passer la parole →'}
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 text-sm text-gray-500 px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              {done} terminé{done !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-300" />
              {remaining} en attente
            </span>
            <div className="flex-1" />
            <button
              onClick={end}
              className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
            >
              Terminer le daily
            </button>
          </div>
        </>
      )}

      {/* ── DONE state ── */}
      {session.status === 'DONE' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 flex flex-col items-center gap-4">
          <span className="text-5xl">🎉</span>
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Daily terminé !</h2>
            <p className="text-gray-500 text-sm">Durée totale : {formatSessionTime(sessionElapsed)}</p>
          </div>
          <button
            onClick={() => router.push('/daily')}
            className="mt-2 px-5 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            Retour aux dailys
          </button>
        </div>
      )}

      {/* ── Participant list (always visible) ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Participants
        </h3>
        <div className="flex flex-col gap-2">
          {session.participants.map((p, i) => (
            <ParticipantPill
              key={p.id}
              p={p}
              index={i}
              isCurrent={p.status === 'SPEAKING'}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
