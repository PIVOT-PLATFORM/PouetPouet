'use client'

import type { Activity } from '@/hooks/useSession'

interface Props {
  activity: Activity
  responses: unknown[]
  participantCount: number
  // Absent (vue participant) : pas de bouton de fermeture
  onClose?: () => void
  // Rapport d'une activité clôturée : libellés adaptés, bouton "Fermer le rapport"
  reportMode?: boolean
}

export function ActivityResults({ activity, responses, participantCount, onClose, reportMode }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">{reportMode ? 'Résultats' : 'Activité en cours'}</p>
          <p className="text-sm font-semibold text-gray-800 mt-0.5">{activity.title}</p>
        </div>
        <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-medium">
          {reportMode ? `${responses.length} réponse${responses.length !== 1 ? 's' : ''}` : `${responses.length}/${participantCount}`}
        </span>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {activity.type === 'POLL' && <PollResults activity={activity} responses={responses} />}
        {activity.type === 'QUIZ' && <PollResults activity={activity} responses={responses} showCorrect />}
        {activity.type === 'WORDCLOUD' && <WordcloudResults responses={responses} />}
        {activity.type === 'BRAINSTORM' && <BrainstormResults responses={responses} />}
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="w-full rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 transition-colors"
        >
          {reportMode ? 'Fermer le rapport' : 'Terminer l\'activité'}
        </button>
      )}
    </div>
  )
}

function PollResults({ activity, responses, showCorrect = false }: { activity: Activity; responses: unknown[]; showCorrect?: boolean }) {
  const options = activity.config.options as string[]
  const correctAnswer = activity.config.correctAnswer as number | undefined
  const total = responses.length

  const counts = options.map((_, i) =>
    responses.filter((r) => (r as { value: number }).value === i).length
  )

  return (
    <div className="flex flex-col gap-2">
      {options.map((opt, i) => {
        const count = counts[i]
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        const isCorrect = showCorrect && correctAnswer === i

        return (
          <div key={i}>
            <div className="flex justify-between text-xs mb-1">
              <span className={`font-medium ${isCorrect ? 'text-green-600' : 'text-gray-700'}`}>
                {isCorrect && '✅ '}{opt}
              </span>
              <span className="text-gray-400">{count} ({pct}%)</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isCorrect ? 'bg-green-500' : 'bg-indigo-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WordcloudResults({ responses }: { responses: unknown[] }) {
  const words: Record<string, number> = {}
  responses.forEach((r) => {
    const word = ((r as { value: string }).value ?? '').trim().toLowerCase()
    if (word) words[word] = (words[word] ?? 0) + 1
  })

  const max = Math.max(...Object.values(words), 1)
  const sorted = Object.entries(words).sort((a, b) => b[1] - a[1])

  if (sorted.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-4">En attente de contributions…</p>
  }

  return (
    <div className="flex flex-wrap gap-2 py-2">
      {sorted.map(([word, count]) => {
        const size = Math.round(12 + (count / max) * 20)
        const opacity = 0.5 + (count / max) * 0.5
        return (
          <span
            key={word}
            className="font-semibold text-indigo-600 transition-all"
            style={{ fontSize: size, opacity }}
          >
            {word}
          </span>
        )
      })}
    </div>
  )
}

function BrainstormResults({ responses }: { responses: unknown[] }) {
  if (responses.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-4">En attente d'idées…</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {responses.map((r, i) => (
        <div key={i} className="rounded-lg bg-yellow-50 border border-yellow-100 px-3 py-2 text-sm text-gray-700">
          💡 {(r as { value: string }).value}
        </div>
      ))}
    </div>
  )
}
