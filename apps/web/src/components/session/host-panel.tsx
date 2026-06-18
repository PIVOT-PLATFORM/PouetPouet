'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { Session, Activity } from '@/hooks/useSession'
import { ActivityLauncher } from './activity-launcher'
import { ActivityResults } from './activity-results'

interface Props {
  session: Session
  participantCount: number
  currentActivity: Activity | null
  activityResponses: unknown[]
  lastReport?: { activity: Activity; responses: unknown[] } | null
  onClearReport?: () => void
  onLaunchActivity: (type: Activity['type'], title: string, config: Record<string, unknown>) => void
  onCloseActivity: () => void
  onCloseSession: () => void
}

interface Participant {
  id: string
  name: string
  joinedAt: string
}

interface HistoryActivity extends Activity {
  createdAt: string
  responseCount: number
  responses: { id: string; value: unknown }[]
}

const TYPE_ICON: Record<string, string> = {
  POLL: '📊', QUIZ: '🎯', WORDCLOUD: '☁️', BRAINSTORM: '💡',
}

export function HostPanel({
  session,
  participantCount,
  currentActivity,
  activityResponses,
  lastReport,
  onClearReport,
  onLaunchActivity,
  onCloseActivity,
  onCloseSession,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [showLauncher, setShowLauncher] = useState(false)
  const [tab, setTab] = useState<'live' | 'history'>('live')
  const [showParticipants, setShowParticipants] = useState(false)
  const [participants, setParticipants] = useState<Participant[] | null>(null)
  const [history, setHistory] = useState<HistoryActivity[] | null>(null)
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null)

  function copyCode() {
    navigator.clipboard.writeText(session.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyLink() {
    const url = `${window.location.origin}/join?code=${session.code}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Invalidate list when count changes so the panel stays in sync without F5
  useEffect(() => {
    if (showParticipants) setParticipants(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantCount])

  useEffect(() => {
    if (!showParticipants || participants !== null) return
    api.get<Participant[]>(`/api/sessions/${session.id}/participants`)
      .then(setParticipants)
      .catch(() => setParticipants([]))
  }, [showParticipants, participants, session.id])

  useEffect(() => {
    if (tab !== 'history' || history !== null) return
    api.get<HistoryActivity[]>(`/api/sessions/${session.id}/activities`)
      .then(setHistory)
      .catch(() => setHistory([]))
  }, [tab, history, session.id])

  // Refresh history after an activity is closed
  useEffect(() => {
    if (lastReport) setHistory(null)
  }, [lastReport])

  return (
    <>
      <div className="absolute top-2 right-4 z-40 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-primary-600 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white text-sm font-medium">Session en cours</span>
          </div>
          <div className="flex items-center gap-1.5 text-primary-100 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-semibold">{participantCount}</span>
          </div>
        </div>

        {/* Code */}
        <div className="px-4 py-4 text-center border-b border-gray-100">
          <p className="text-xs text-gray-400 mb-1.5 uppercase tracking-widest">Code d'accès</p>
          <button
            onClick={copyCode}
            className="text-3xl font-bold tracking-[0.2em] text-primary-600 hover:text-primary-700 transition-colors font-mono block w-full"
          >
            {session.code}
          </button>
          <button
            onClick={copyLink}
            className="mt-2 text-xs text-gray-400 hover:text-primary-500 transition-colors"
          >
            {copied ? '✅ Copié !' : '🔗 Copier le lien d\'invitation'}
          </button>
        </div>

        {/* Participants collapsible */}
        <div className="border-b border-gray-100">
          <button
            onClick={() => setShowParticipants((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <span className="font-medium uppercase tracking-wide">Participants ({participantCount})</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${showParticipants ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showParticipants && (
            <div className="px-4 pb-3 max-h-36 overflow-y-auto">
              {participants === null ? (
                <p className="text-xs text-gray-400 text-center py-2">Chargement…</p>
              ) : participants.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">Aucun participant pour l'instant</p>
              ) : (
                <ul className="space-y-1">
                  {participants.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                      {p.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('live')}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === 'live' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            En cours
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === 'history' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Historique {history && history.length > 0 ? `(${history.length})` : ''}
          </button>
        </div>

        {/* Tab content */}
        <div className="px-4 py-4">
          {tab === 'live' && (
            currentActivity ? (
              <ActivityResults
                activity={currentActivity}
                responses={activityResponses}
                participantCount={participantCount}
                onClose={onCloseActivity}
                closeLabel="Enregistrer et fermer"
              />
            ) : lastReport ? (
              <ActivityResults
                activity={lastReport.activity}
                responses={lastReport.responses}
                participantCount={participantCount}
                reportMode
                onClose={() => { onClearReport?.(); setHistory(null) }}
              />
            ) : (
              <button
                onClick={() => setShowLauncher(true)}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary-50 border border-primary-200 px-3 py-2.5 text-sm font-medium text-primary-600 hover:bg-primary-100 transition-colors"
              >
                <span>🚀</span> Lancer une activité
              </button>
            )
          )}

          {tab === 'history' && (
            <div>
              {history === null ? (
                <p className="text-xs text-gray-400 text-center py-3">Chargement…</p>
              ) : history.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">Aucune activité terminée pour cette session</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((a) => (
                    <li key={a.id} className="rounded-lg border border-gray-100 overflow-hidden">
                      <button
                        onClick={() => setExpandedActivity(expandedActivity === a.id ? null : a.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-base shrink-0">{TYPE_ICON[a.type] ?? '📋'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-800 truncate">{a.title}</p>
                          <p className="text-[10px] text-gray-400">{a.responseCount} réponse{a.responseCount !== 1 ? 's' : ''}</p>
                        </div>
                        <svg
                          className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${expandedActivity === a.id ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expandedActivity === a.id && (
                        <div className="px-3 pb-3 border-t border-gray-100 bg-gray-50">
                          <div className="pt-2">
                            <ActivityResults
                              activity={a}
                              responses={a.responses}
                              participantCount={a.responseCount}
                              reportMode
                            />
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Fermer session */}
        <div className="px-4 pb-3">
          <button
            onClick={onCloseSession}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-gray-100 pt-3"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Fermer la session
          </button>
        </div>
      </div>

      {showLauncher && (
        <ActivityLauncher
          onLaunch={onLaunchActivity}
          onClose={() => setShowLauncher(false)}
        />
      )}
    </>
  )
}
