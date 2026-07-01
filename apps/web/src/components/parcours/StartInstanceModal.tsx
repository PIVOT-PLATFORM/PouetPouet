'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import type { ParcourTemplateSummary, ParcourInstanceDetail } from '@pouetpouet/shared'

interface Props {
  template: ParcourTemplateSummary
  onClose: () => void
}

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Faible' },
  { value: 'normal', label: 'Normal' },
  { value: 'high',   label: 'Élevé' },
  { value: 'urgent', label: 'Urgent' },
]

export function StartInstanceModal({ template, onClose }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(`${template.name} — ${new Date().toLocaleDateString('fr-FR')}`)
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  const [dueAt, setDueAt] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleStart() {
    setLoading(true)
    try {
      const instance = await api.post<ParcourInstanceDetail>('/api/parcours/instances', {
        templateId: template.id,
        title: title.trim(),
        priority,
        dueAt: dueAt || undefined,
      })
      router.push(`/parcours/run/${instance.id}`)
      onClose()
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 dark:border-gray-800 p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold dark:text-white">Démarrer un parcours</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          Template : <span className="font-medium text-gray-700 dark:text-gray-300">{template.name}</span>
          {' · '}{template.stepCount} étape{template.stepCount > 1 ? 's' : ''}
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Titre du parcours</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              placeholder="Nom de cette instance"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Priorité</label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPriority(opt.value as typeof priority)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    priority === opt.value
                      ? 'bg-cyan-500 border-cyan-500 text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Échéance (optionnel)</label>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Annuler
          </button>
          <button
            onClick={handleStart}
            disabled={!title.trim() || loading}
            className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {loading ? 'Démarrage…' : 'Démarrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
