'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GitBranch, Plus, Clock, CheckCircle2, XCircle, ChevronRight } from 'lucide-react'
import { useParcourInstances } from '@/hooks/useParcours'
import { useFlagGuard } from '@/hooks/useFlagGuard'

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminé',
  REJECTED: 'Rejeté',
  CANCELLED: 'Annulé',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  IN_PROGRESS: <Clock className="w-4 h-4 text-blue-500" />,
  COMPLETED:   <CheckCircle2 className="w-4 h-4 text-green-500" />,
  REJECTED:    <XCircle className="w-4 h-4 text-red-500" />,
  CANCELLED:   <XCircle className="w-4 h-4 text-gray-400" />,
}

const PRIORITY_BADGE: Record<string, string> = {
  low:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  normal: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  high:   'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
}

export default function ParcoursPage() {
  useFlagGuard('module.parcours')
  const { instances, isLoading } = useParcourInstances()
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? instances : instances.filter((i) => i.status === filter)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="w-7 h-7 text-cyan-500" />
          <h1 className="text-3xl font-bold dark:text-white">Parcours</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/parcours/templates"
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white transition-colors"
          >
            Templates
          </Link>
          <Link
            href="/parcours/templates/new"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau template
          </Link>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {[['all', 'Tous'], ['IN_PROGRESS', 'En cours'], ['COMPLETED', 'Terminés'], ['REJECTED', 'Rejetés'], ['CANCELLED', 'Annulés']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === val
                ? 'bg-cyan-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <GitBranch className="w-12 h-12 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">
            {filter === 'all' ? 'Aucun parcours en cours.' : 'Aucun parcours dans ce statut.'}
          </p>
          <Link href="/parcours/templates" className="text-cyan-500 hover:underline text-sm">
            Démarrer depuis un template →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((instance) => (
            <Link
              key={instance.id}
              href={`/parcours/run/${instance.id}`}
              className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-cyan-200 dark:hover:border-cyan-800 hover:shadow-sm transition-all group"
            >
              <div className="flex-shrink-0">{STATUS_ICON[instance.status]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm dark:text-white truncate">{instance.title}</span>
                  {instance.refNumber && (
                    <span className="text-xs text-gray-400 font-mono flex-shrink-0">{instance.refNumber}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{STATUS_LABEL[instance.status]}</span>
                  <span>·</span>
                  <span>Étape {instance.currentStep + 1}/{instance.stepCount}</span>
                  {instance.priority !== 'normal' && (
                    <>
                      <span>·</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_BADGE[instance.priority]}`}>
                        {instance.priority}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-cyan-500 flex-shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
