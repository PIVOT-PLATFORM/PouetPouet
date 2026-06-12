'use client'

import { useState } from 'react'
import type { Activity } from '@/hooks/useSession'

type ActivityType = Activity['type']

interface Props {
  onLaunch: (type: ActivityType, title: string, config: Record<string, unknown>) => void
  onClose: () => void
}

const TYPES: { type: ActivityType; label: string; icon: string; description: string }[] = [
  { type: 'POLL', label: 'Sondage', icon: '📊', description: 'Vote à choix multiples' },
  { type: 'WORDCLOUD', label: 'Nuage de mots', icon: '☁️', description: 'Réponses libres en un mot' },
  { type: 'BRAINSTORM', label: 'Brainstorming', icon: '💡', description: 'Idées libres et anonymes' },
  { type: 'QUIZ', label: 'Quiz', icon: '🎯', description: 'QCM avec bonne réponse' },
]

export function ActivityLauncher({ onLaunch, onClose }: Props) {
  const [step, setStep] = useState<'type' | 'config'>('type')
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null)
  const [title, setTitle] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [correctAnswer, setCorrectAnswer] = useState(0)

  function handleSelectType(type: ActivityType) {
    setSelectedType(type)
    setStep('config')
  }

  function handleLaunch() {
    if (!selectedType || !title.trim()) return
    const config: Record<string, unknown> = {}

    if (selectedType === 'POLL') {
      config.options = options.filter((o) => o.trim())
      config.question = title
    } else if (selectedType === 'QUIZ') {
      config.options = options.filter((o) => o.trim())
      config.question = title
      config.correctAnswer = correctAnswer
    } else {
      config.question = title
      config.anonymous = selectedType === 'BRAINSTORM'
    }

    onLaunch(selectedType, title.trim(), config)
    onClose()
  }

  function addOption() {
    setOptions((prev) => [...prev, ''])
  }

  function updateOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)))
  }

  function removeOption(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {step === 'config' && (
              <button onClick={() => setStep('type')} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="font-semibold text-gray-900">
              {step === 'type' ? 'Choisir une activité' : `Configurer le ${TYPES.find(t => t.type === selectedType)?.label}`}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {step === 'type' && (
            <div className="grid grid-cols-2 gap-3">
              {TYPES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => handleSelectType(t.type)}
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-gray-100 p-5 hover:border-primary-300 hover:bg-primary-50 transition-all group"
                >
                  <span className="text-3xl">{t.icon}</span>
                  <span className="font-semibold text-gray-800 text-sm group-hover:text-primary-700">{t.label}</span>
                  <span className="text-xs text-gray-400">{t.description}</span>
                </button>
              ))}
            </div>
          )}

          {step === 'config' && selectedType && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  {selectedType === 'POLL' || selectedType === 'QUIZ' ? 'Question' : 'Thème / consigne'}
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  placeholder="Ex: Quelle est votre priorité ce sprint ?"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {(selectedType === 'POLL' || selectedType === 'QUIZ') && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Options</label>
                  <div className="flex flex-col gap-2">
                    {options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {selectedType === 'QUIZ' && (
                          <input
                            type="radio"
                            name="correct"
                            checked={correctAnswer === i}
                            onChange={() => setCorrectAnswer(i)}
                            className="accent-primary-600"
                            title="Bonne réponse"
                          />
                        )}
                        <input
                          value={opt}
                          onChange={(e) => updateOption(i, e.target.value)}
                          placeholder={`Option ${i + 1}`}
                          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        {options.length > 2 && (
                          <button onClick={() => removeOption(i)} className="text-gray-300 hover:text-red-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                    {options.length < 6 && (
                      <button
                        onClick={addOption}
                        className="text-sm text-primary-600 hover:text-primary-700 text-left mt-1"
                      >
                        + Ajouter une option
                      </button>
                    )}
                  </div>
                  {selectedType === 'QUIZ' && (
                    <p className="text-xs text-gray-400 mt-2">Sélectionnez la bonne réponse avec le bouton radio</p>
                  )}
                </div>
              )}

              <button
                onClick={handleLaunch}
                disabled={!title.trim()}
                className="w-full rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-2"
              >
                🚀 Lancer l'activité
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
