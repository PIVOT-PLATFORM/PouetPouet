'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CreateBoardInput } from '@/hooks/useBoards'
import type { BoardTemplate } from '@/hooks/useTemplates'

export const ACTIVITY_OPTIONS = [
  { key: 'voting', label: 'Vote', emoji: '🗳️' },
  { key: 'timer', label: 'Timer', emoji: '⏱️' },
  { key: 'drawing', label: 'Dessin', emoji: '✏️' },
  { key: 'frames', label: 'Cadres', emoji: '🖼️' },
  { key: 'fields', label: 'Champs', emoji: '🏷️' },
] as const

interface Props {
  onClose: () => void
  onCreate: (input: CreateBoardInput) => Promise<unknown>
  templates: BoardTemplate[]
}

export function CreateBoardModal({ onClose, onCreate, templates }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [maxParticipants, setMaxParticipants] = useState('')
  const [enabledActivities, setEnabledActivities] = useState<string[]>(
    ACTIVITY_OPTIONS.map((a) => a.key)
  )
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // When a template is picked, prefill fields (user can still override)
  useEffect(() => {
    if (!templateId) return
    const tpl = templates.find((t) => t.id === templateId)
    if (!tpl) return
    if (!description) setDescription(tpl.description ?? '')
    if (!coverImage) setCoverImage(tpl.coverImage ?? '')
    if (!maxParticipants) setMaxParticipants(tpl.maxParticipants?.toString() ?? '')
    if (tpl.enabledActivities) setEnabledActivities(tpl.enabledActivities)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId])

  function toggleActivity(key: string) {
    setEnabledActivities((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom est requis'); return }
    setIsLoading(true)
    setError(null)
    try {
      const max = maxParticipants.trim()
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        coverImage: coverImage.trim() || null,
        maxParticipants: max ? Number(max) : null,
        enabledActivities,
        templateId: templateId ?? undefined,
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-5">Nouveau board</h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Template picker */}
            {templates.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">À partir d'un template</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTemplateId(null)}
                    className={`p-3 rounded-xl border text-left text-sm transition-all ${
                      !templateId
                        ? 'border-primary-400 bg-primary-50 text-primary-700 dark:bg-primary-950/50'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="font-medium">Vierge</div>
                    <div className="text-xs text-gray-500 mt-0.5">Board vide</div>
                  </button>
                  {templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setTemplateId(tpl.id)}
                      className={`p-3 rounded-xl border text-left text-sm transition-all ${
                        templateId === tpl.id
                          ? 'border-primary-400 bg-primary-50 text-primary-700 dark:bg-primary-950/50'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="font-medium truncate">{tpl.name}</div>
                      {tpl.description && (
                        <div className="text-xs text-gray-500 mt-0.5 truncate">{tpl.description}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Input
              label="Nom du board"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rétrospective sprint 42"
              ref={inputRef}
            />

            <Input
              label="Description (optionnel)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Quelques mots…"
            />

            {/* Advanced toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="self-start text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Options avancées
            </button>

            {showAdvanced && (
              <div className="flex flex-col gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <Input
                  label="Image de couverture (URL)"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="https://…"
                />
                <Input
                  label="Nombre max de participants (optionnel)"
                  type="number"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  placeholder="ex : 10"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Activités disponibles</label>
                  <div className="flex flex-wrap gap-2">
                    {ACTIVITY_OPTIONS.map((opt) => {
                      const active = enabledActivities.includes(opt.key)
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => toggleActivity(opt.key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all ${
                            active
                              ? 'border-primary-300 bg-primary-50 text-primary-700 dark:bg-primary-950/40'
                              : 'border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-500'
                          }`}
                        >
                          <span>{opt.emoji}</span>
                          <span>{opt.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <Button variant="ghost" type="button" onClick={onClose} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" isLoading={isLoading} className="flex-1">
                Créer
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
