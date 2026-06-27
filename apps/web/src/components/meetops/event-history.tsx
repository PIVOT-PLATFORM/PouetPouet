'use client'

import { useMeetHistory } from '@/hooks/useMeetops'
import { HISTORY_ACTION_LABELS } from '@/lib/meetops'

const ACTION_EMOJI: Record<string, string> = {
  created: '➕', updated: '✏️', deleted: '🗑️', sent: '📤', reordered: '↕️', bulk: '⚙️', cleared: '🧹',
}

function formatStamp(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

// Journal d'activité d'un événement. `refreshKey` force le rechargement (ex. après une action).
export function EventHistory({ eventId, refreshKey }: { eventId: string; refreshKey?: unknown }) {
  const { history, isLoading } = useMeetHistory(eventId, refreshKey)

  if (isLoading) return <p className="text-sm text-gray-400">Chargement…</p>
  if (history.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-8 text-center">
        <p className="text-3xl mb-2">🕓</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Aucune activité enregistrée pour le moment.</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
      <ul className="flex flex-col">
        {history.map((h) => (
          <li key={h.id} className="flex items-start gap-3 py-2 border-b border-gray-50 dark:border-gray-800/60 last:border-0">
            <span className="text-base shrink-0 mt-0.5">{ACTION_EMOJI[h.action] ?? '•'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 dark:text-gray-200">
                <span className="font-medium">{HISTORY_ACTION_LABELS[h.action] ?? h.action}</span>
                {h.meetingTitle && <span className="text-gray-500 dark:text-gray-400"> — {h.meetingTitle}</span>}
              </p>
              {(h.field || h.newValue) && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {h.action === 'bulk' ? (
                    h.newValue
                  ) : (
                    <>
                      {h.field ? `${h.field} : ` : ''}
                      {h.oldValue ? <span className="line-through">{h.oldValue}</span> : null}
                      {h.oldValue && h.newValue ? ' → ' : ''}
                      {h.newValue}
                    </>
                  )}
                </p>
              )}
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 whitespace-nowrap">{formatStamp(h.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
