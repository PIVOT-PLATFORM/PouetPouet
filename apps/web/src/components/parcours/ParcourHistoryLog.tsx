'use client'

import { CheckCircle2, XCircle, SkipForward, Info, FileText, MessageSquare } from 'lucide-react'
import type { ParcourHistoryEntry } from '@pouetpouet/shared'

const ACTION_ICON: Record<string, React.ReactNode> = {
  step_completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  step_rejected:  <XCircle className="w-4 h-4 text-red-500" />,
  step_skipped:   <SkipForward className="w-4 h-4 text-gray-400" />,
  started:        <Info className="w-4 h-4 text-blue-500" />,
  completed:      <CheckCircle2 className="w-4 h-4 text-green-600" />,
  document_added: <FileText className="w-4 h-4 text-cyan-500" />,
  comment:        <MessageSquare className="w-4 h-4 text-gray-400" />,
}

const ACTION_LABEL: Record<string, string> = {
  step_completed: 'Étape validée',
  step_rejected:  'Étape rejetée',
  step_skipped:   'Étape ignorée',
  started:        'Parcours démarré',
  completed:      'Parcours terminé',
  document_added: 'Document ajouté',
  comment:        'Commentaire',
}

interface Props {
  entries: ParcourHistoryEntry[]
}

export function ParcourHistoryLog({ entries }: Props) {
  if (entries.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">Aucune activité pour l'instant.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">{ACTION_ICON[entry.action] ?? <Info className="w-4 h-4 text-gray-400" />}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium dark:text-white">{ACTION_LABEL[entry.action] ?? entry.action}</span>
              {entry.stepIndex !== null && entry.stepIndex !== undefined && (
                <span className="text-xs text-gray-400">étape {entry.stepIndex + 1}</span>
              )}
            </div>
            {entry.comment && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 italic">"{entry.comment}"</p>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 block">
              {new Date(entry.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
