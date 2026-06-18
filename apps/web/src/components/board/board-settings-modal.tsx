'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ACTIVITY_OPTIONS } from '@/components/dashboard/create-board-modal'
import { api } from '@/lib/api'

interface BoardSettings {
  id: string
  name: string
  description: string | null
  coverImage: string | null
  maxParticipants: number | null
  enabledActivities: string[] | null
  templateDraftOf?: string | null
}

interface Props {
  board: BoardSettings
  onClose: () => void
  onSave: (input: {
    name?: string
    description?: string | null
    coverImage?: string | null
    maxParticipants?: number | null
    enabledActivities?: string[] | null
  }) => Promise<unknown>
}

export function BoardSettingsModal({ board, onClose, onSave }: Props) {
  const [name, setName] = useState(board.name)
  const [description, setDescription] = useState(board.description ?? '')
  const [coverImage, setCoverImage] = useState(board.coverImage ?? '')
  const [maxParticipants, setMaxParticipants] = useState(board.maxParticipants?.toString() ?? '')
  const [enabledActivities, setEnabledActivities] = useState<string[]>(
    board.enabledActivities ?? ACTIVITY_OPTIONS.map((a) => a.key)
  )
  const [isLoading, setIsLoading] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templateSaved, setTemplateSaved] = useState(false)
  const [templateName, setTemplateName] = useState(board.name)
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setUploadError('Fichier non supporté (image uniquement)'); return }
    if (file.size > 1.5 * 1024 * 1024) { setUploadError('Fichier trop volumineux (max 1,5 Mo)'); return }
    setUploadError(null)
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') setCoverImage(reader.result) }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

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
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        coverImage: coverImage.trim() || null,
        maxParticipants: max ? Number(max) : null,
        enabledActivities,
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setIsLoading(false)
    }
  }

  async function handleSaveAsTemplate() {
    if (!templateName.trim()) return
    setSavingTemplate(true)
    setError(null)
    try {
      await api.post('/api/templates', {
        name: templateName.trim(),
        fromBoardId: board.id,
      })
      setTemplateSaved(true)
      setShowTemplateForm(false)
      setTimeout(() => setTemplateSaved(false), 3000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSavingTemplate(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-5">Paramètres du board</h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {templateSaved && (
            <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
              Template enregistré
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Quelques mots…" />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Image de couverture</label>
              {coverImage && (
                <div className="relative mb-2 rounded-xl overflow-hidden h-28 bg-gray-100 dark:bg-gray-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverImage} alt="Couverture" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setCoverImage('')}
                    className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors"
                    title="Supprimer la couverture"
                  >✕</button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={coverImage.startsWith('data:') ? '' : coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="https://…"
                  className="flex-1 rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <label
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-gray-800 border border-primary-200 dark:border-gray-700 rounded-xl cursor-pointer transition-colors shrink-0"
                  title="Importer une image"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Importer
                  <input type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
                </label>
              </div>
              {uploadError && <p className="mt-1 text-xs text-red-500">{uploadError}</p>}
            </div>
            <Input
              label="Nombre max de participants"
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

            {/* Save as template (hidden when already editing a template draft) */}
            {!board.templateDraftOf && (
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
              {!showTemplateForm ? (
                <button
                  type="button"
                  onClick={() => setShowTemplateForm(true)}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  Enregistrer comme template
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nom du template</label>
                  <div className="flex gap-2">
                    <input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="Ex : Rétro sprint"
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveAsTemplate}
                      disabled={savingTemplate || !templateName.trim()}
                      className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                    >
                      {savingTemplate ? '…' : 'Enregistrer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTemplateForm(false)}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">Le contenu actuel du board (cartes, cadres, champs) sera copié dans le template.</p>
                </div>
              )}
            </div>
            )}

            <div className="flex gap-3 mt-4">
              <Button variant="ghost" type="button" onClick={onClose} className="flex-1">Annuler</Button>
              <Button type="submit" isLoading={isLoading} className="flex-1">Enregistrer</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
