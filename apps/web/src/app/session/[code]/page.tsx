'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useParticipantSession } from '@/hooks/useParticipantSession'
import { ActivityResults } from '@/components/session/activity-results'
import { useAuthStore } from '@/store/auth'

export default function SessionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const { sessionInfo, participantCount, currentActivity, responses, hasResponded, isJoined, error, closedByHost, lastReport, join, respond } =
    useParticipantSession(code)
  const { user } = useAuthStore()
  const [name, setName] = useState('')

  // If the logged-in user is the board owner, show a host redirect screen
  if (sessionInfo && user && sessionInfo.board?.ownerId === user.id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/20 backdrop-blur mb-6 text-5xl">
            🎛️
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Vous êtes l'animateur</h2>
          <p className="text-indigo-200 text-sm mb-8">
            Cette session vous appartient. Retournez sur le board pour contrôler les activités et partager le code{' '}
            <span className="font-mono font-bold text-white">{code}</span> à vos participants.
          </p>
          <Link
            href={`/boards/${sessionInfo.boardId}`}
            className="inline-flex items-center gap-2 rounded-xl bg-white text-indigo-700 font-semibold px-6 py-3 text-sm hover:bg-indigo-50 transition-colors shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour au board
          </Link>
          <p className="text-indigo-300 text-xs mt-5">
            Pour tester en tant que participant, ouvrez cette page dans un autre navigateur ou en navigation privée.
          </p>
        </div>
      </div>
    )
  }

  if (closedByHost) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-6">🏁</div>
          <h2 className="text-2xl font-bold text-white mb-2">Session terminée</h2>
          <p className="text-indigo-200 text-sm">L'animateur a mis fin à la session. Merci pour votre participation !</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Session introuvable</h2>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!sessionInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-4">
              <span className="text-3xl">🎯</span>
            </div>
            <h1 className="text-2xl font-bold text-white">{sessionInfo.board.name}</h1>
            <p className="text-indigo-200 text-sm mt-1">Session interactive</p>
          </div>

          <div className="bg-white rounded-2xl p-7 shadow-2xl">
            <h2 className="text-base font-semibold text-gray-900 mb-5 text-center">Comment vous appelez-vous ?</h2>
            <form onSubmit={(e) => { e.preventDefault(); join(name.trim() || 'Anonyme') }} className="flex flex-col gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre prénom"
                autoFocus
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-95 transition-all"
              >
                Rejoindre →
              </button>
            </form>
            <p className="text-center text-xs text-gray-400 mt-4">Aucun compte requis</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 flex flex-col">
      {/* Header */}
      <header className="px-5 py-4 flex items-center justify-between">
        <span className="font-bold text-white text-base">PouetPouet</span>
        <div className="flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white text-xs font-medium">
            {participantCount} participant{participantCount > 1 ? 's' : ''}
          </span>
        </div>
      </header>

      {/* Contenu */}
      <main className="flex-1 flex items-center justify-center p-5">
        {currentActivity ? (
          <ActivityView
            activity={currentActivity}
            hasResponded={hasResponded}
            responses={responses}
            onRespond={respond}
          />
        ) : lastReport ? (
          <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-2xl p-5">
            <ActivityResults
              activity={lastReport.activity}
              responses={lastReport.responses}
              participantCount={participantCount}
              reportMode
            />
          </div>
        ) : (
          <WaitingScreen boardName={sessionInfo?.board?.name} />
        )}
      </main>
    </div>
  )
}

function WaitingScreen({ boardName }: { boardName?: string }) {
  return (
    <div className="text-center max-w-sm mx-auto px-4">
      <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur flex items-center justify-center text-5xl mx-auto mb-6 animate-pulse">
        ⏳
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Vous êtes connecté !</h2>
      {boardName && (
        <p className="text-white/90 font-medium mb-3">{boardName}</p>
      )}
      <p className="text-indigo-200 mb-8">L'animateur va bientôt lancer une activité…</p>

      <div className="bg-white/10 backdrop-blur rounded-2xl p-5 text-left space-y-3">
        <p className="text-xs font-semibold text-indigo-200 uppercase tracking-widest mb-3">Ce qui va se passer</p>
        <div className="flex items-start gap-3">
          <span className="text-lg shrink-0">🗳️</span>
          <p className="text-sm text-white/80">Un sondage ou quiz apparaîtra ici automatiquement</p>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-lg shrink-0">💡</span>
          <p className="text-sm text-white/80">Vous pourrez soumettre vos idées en brainstorming</p>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-lg shrink-0">📱</span>
          <p className="text-sm text-white/80">Gardez cette page ouverte, pas besoin de la recharger</p>
        </div>
      </div>
    </div>
  )
}

interface ActivityViewProps {
  activity: { id: string; type: string; title: string; config: Record<string, unknown> }
  hasResponded: boolean
  responses: unknown[]
  onRespond: (id: string, value: unknown) => void
}

function PollActivity({ activity, hasResponded, onRespond }: ActivityViewProps) {
  const options = activity.config.options as string[]
  return (
    <div className="w-full max-w-lg">
      <div className="bg-white/10 backdrop-blur rounded-2xl px-5 py-3 mb-6 text-center">
        <p className="text-xs text-indigo-200 uppercase tracking-widest mb-1">
          {activity.type === 'QUIZ' ? 'Quiz' : 'Sondage'}
        </p>
        <h2 className="text-xl font-bold text-white leading-snug">{activity.title}</h2>
      </div>

      {hasResponded ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl">
          <div className="text-4xl mb-3">✅</div>
          <p className="font-semibold text-gray-800">Réponse envoyée !</p>
          <p className="text-gray-400 text-sm mt-1">En attente des autres participants…</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => onRespond(activity.id, i)}
              className="w-full rounded-2xl bg-white px-5 py-4 text-left text-sm font-medium text-gray-800 hover:bg-indigo-50 hover:scale-[1.02] active:scale-100 transition-all shadow-lg shadow-indigo-900/20"
            >
              <span className="inline-flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TextActivity({ activity, hasResponded, onRespond }: ActivityViewProps) {
  const [text, setText] = useState('')
  const isWordcloud = activity.type === 'WORDCLOUD'

  return (
    <div className="w-full max-w-lg">
      <div className="bg-white/10 backdrop-blur rounded-2xl px-5 py-3 mb-6 text-center">
        <p className="text-xs text-indigo-200 uppercase tracking-widest mb-1">
          {isWordcloud ? 'Nuage de mots' : 'Brainstorming'}
        </p>
        <h2 className="text-xl font-bold text-white leading-snug">{activity.title}</h2>
      </div>

      {hasResponded ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl">
          <div className="text-4xl mb-3">✅</div>
          <p className="font-semibold text-gray-800">Contribution envoyée !</p>
          <p className="text-gray-400 text-sm mt-1">En attente des autres participants…</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 shadow-xl">
          <form
            onSubmit={(e) => { e.preventDefault(); if (text.trim()) onRespond(activity.id, text.trim()) }}
            className="flex flex-col gap-4"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={isWordcloud ? 'Un mot…' : 'Votre idée…'}
              autoFocus
              maxLength={isWordcloud ? 30 : 200}
              className="rounded-xl border border-gray-200 px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 active:scale-95 transition-all"
            >
              Envoyer
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function ActivityView(props: ActivityViewProps) {
  const { activity } = props
  if (activity.type === 'POLL' || activity.type === 'QUIZ') return <PollActivity {...props} />
  if (activity.type === 'WORDCLOUD' || activity.type === 'BRAINSTORM') return <TextActivity {...props} />
  return null
}
