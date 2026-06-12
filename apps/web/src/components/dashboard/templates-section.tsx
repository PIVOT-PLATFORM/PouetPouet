'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BoardTemplate, CreateTemplateInput } from '@/hooks/useTemplates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const TEMPLATE_THEMES = [
  { gradient: 'from-violet-500 to-primary-600', light: 'bg-violet-50', text: 'text-violet-600' },
  { gradient: 'from-blue-500 to-cyan-600', light: 'bg-blue-50', text: 'text-blue-600' },
  { gradient: 'from-emerald-500 to-teal-600', light: 'bg-emerald-50', text: 'text-emerald-600' },
  { gradient: 'from-orange-500 to-amber-500', light: 'bg-orange-50', text: 'text-orange-600' },
  { gradient: 'from-pink-500 to-rose-500', light: 'bg-pink-50', text: 'text-pink-600' },
  { gradient: 'from-secondary-500 to-fuchsia-600', light: 'bg-secondary-50', text: 'text-secondary-600' },
]

function getTheme(id: string) {
  const n = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return TEMPLATE_THEMES[n % TEMPLATE_THEMES.length]
}

function TemplateIcon({ gradient, src }: { gradient: string; src?: string | null }) {
  if (src) {
    return <img src={src} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
  }
  return (
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    </div>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="w-4 h-4" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  )
}

interface Props {
  templates: BoardTemplate[]
  onCreate: (input: CreateTemplateInput) => Promise<BoardTemplate>
  onDelete: (id: string) => Promise<void>
  onEditContent: (id: string) => Promise<string>
  onToggleFavorite: (id: string) => Promise<void>
  ownedBoards: { id: string; name: string }[]
}

export function TemplatesSection({ templates, onCreate, onDelete, onEditContent, onToggleFavorite, ownedBoards }: Props) {
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const sortedTemplates = [...templates].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('Supprimer ce template ?')) return
    setDeletingId(id)
    try { await onDelete(id) } finally { setDeletingId(null) }
  }

  async function handleToggleFavorite(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    await onToggleFavorite(id)
  }

  async function handleOpen(id: string) {
    if (openingId) return
    setOpeningId(id)
    try {
      const boardId = await onEditContent(id)
      router.push(`/boards/${boardId}`)
    } catch (err) {
      alert((err as Error).message)
      setOpeningId(null)
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Mes templates
          {templates.length > 0 && <span className="ml-2 text-gray-400 font-normal normal-case tracking-normal">({templates.length})</span>}
        </h2>
        <button
          onClick={() => setShowNew(true)}
          className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouveau template
        </button>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-4">
          Aucun template. Créez-en un depuis un board existant pour le réutiliser plus tard.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedTemplates.map((tpl) => {
            const theme = getTheme(tpl.id)
            return (
              <div
                key={tpl.id}
                onClick={() => handleOpen(tpl.id)}
                className={`group relative bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 cursor-pointer hover:shadow-lg hover:shadow-gray-200/60 dark:hover:shadow-gray-900/60 hover:-translate-y-0.5 transition-all duration-200 ${openingId === tpl.id ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3 mb-4">
                  <TemplateIcon gradient={theme.gradient} src={tpl.coverImage} />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">{tpl.name}</h3>
                    {tpl.description && (
                      <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">{tpl.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => handleToggleFavorite(e, tpl.id)}
                      title={tpl.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                      className={`rounded-lg p-1.5 transition-all ${
                        tpl.isFavorite
                          ? 'text-amber-400 hover:text-amber-500 hover:bg-amber-50'
                          : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'
                      }`}
                    >
                      <StarIcon filled={tpl.isFavorite} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, tpl.id)}
                      disabled={deletingId === tpl.id}
                      className="rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    Modifié {new Date(tpl.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${theme.light} ${theme.text}`}>
                    Template
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showNew && (
        <NewTemplateModal
          onClose={() => setShowNew(false)}
          onCreate={onCreate}
          ownedBoards={ownedBoards}
        />
      )}
    </section>
  )
}

function NewTemplateModal({
  onClose,
  onCreate,
  ownedBoards,
}: {
  onClose: () => void
  onCreate: (input: CreateTemplateInput) => Promise<BoardTemplate>
  ownedBoards: { id: string; name: string }[]
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [fromBoardId, setFromBoardId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom est requis'); return }
    setIsLoading(true)
    setError(null)
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || null,
        fromBoardId: fromBoardId || undefined,
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
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-5">Nouveau template</h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Rétrospective sprint" />
          <Input label="Description (optionnel)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Quelques mots…" />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">À partir d'un board (optionnel)</label>
            <select
              value={fromBoardId}
              onChange={(e) => setFromBoardId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Template vierge</option>
              {ownedBoards.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Si renseigné, les cartes, cadres et champs du board seront copiés dans le template.</p>
          </div>
          <div className="flex gap-3 mt-2">
            <Button variant="ghost" type="button" onClick={onClose} className="flex-1">Annuler</Button>
            <Button type="submit" isLoading={isLoading} className="flex-1">Créer</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
