'use client'

import { useState } from 'react'
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

  return (
    <>
      <div className="absolute top-2 right-4 z-40 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
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

        {/* Activité */}
        <div className="px-4 py-4 border-b border-gray-100">
          {currentActivity ? (
            <ActivityResults
              activity={currentActivity}
              responses={activityResponses}
              participantCount={participantCount}
              onClose={onCloseActivity}
            />
          ) : lastReport ? (
            <ActivityResults
              activity={lastReport.activity}
              responses={lastReport.responses}
              participantCount={participantCount}
              reportMode
              onClose={() => onClearReport?.()}
            />
          ) : (
            <button
              onClick={() => setShowLauncher(true)}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary-50 border border-primary-200 px-3 py-2.5 text-sm font-medium text-primary-600 hover:bg-primary-100 transition-colors"
            >
              <span>🚀</span> Lancer une activité
            </button>
          )}
        </div>

        {/* Fermer session */}
        <div className="px-4 py-3">
          <button
            onClick={onCloseSession}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
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
