'use client'

import { useState } from 'react'
import { Trash2, Pencil } from 'lucide-react'
import type { InnovationComment } from '@/hooks/useInnovationComments'

function relativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 30) return `il y a ${days} j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface Props {
  comments: InnovationComment[]
  currentUserId: string
  isAdmin: boolean
  onAdd: (body: string) => Promise<unknown>
  onEdit: (commentId: string, body: string) => Promise<unknown>
  onDelete: (commentId: string) => Promise<unknown>
}

// Fil de discussion à plat (pas de réponses imbriquées, cf. plan pré-release) : liste
// chronologique + zone de saisie en bas, édition/suppression réservées à l'auteur
// (suppression aussi ouverte à un admin, modération).
export function CommentThread({ comments, currentUserId, isAdmin, onAdd, onEdit, onDelete }: Props) {
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  async function handlePost() {
    const trimmed = draft.trim()
    if (!trimmed) return
    setPosting(true)
    try {
      await onAdd(trimmed)
      setDraft('')
    } finally {
      setPosting(false)
    }
  }

  function startEdit(c: InnovationComment) {
    setEditingId(c.id)
    setEditDraft(c.body)
  }

  async function saveEdit(commentId: string) {
    const trimmed = editDraft.trim()
    if (!trimmed) return
    await onEdit(commentId, trimmed)
    setEditingId(null)
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.length === 0 ? (
        <p className="text-xs text-gray-400">Aucun commentaire pour l&apos;instant.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((c) => {
            const mine = c.author.id === currentUserId
            const isEditing = editingId === c.id
            return (
              <div key={c.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-gray-700 dark:text-gray-200">{c.author.name}</span> · {relativeDate(c.createdAt)}
                  </p>
                  {(mine || isAdmin) && !isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      {mine && (
                        <button onClick={() => startEdit(c)} className="p-1 rounded text-gray-300 hover:text-amber-600" title="Modifier"><Pencil size={12} /></button>
                      )}
                      <button onClick={() => onDelete(c.id)} className="p-1 rounded text-gray-300 hover:text-red-500" title="Supprimer"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div className="flex flex-col gap-1.5">
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={2}
                      autoFocus
                      className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(c.id)} className="text-xs font-semibold text-amber-600 hover:text-amber-700">Enregistrer</button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600">Annuler</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{c.body}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ajouter un commentaire…"
          rows={2}
          className="flex-1 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button onClick={handlePost} disabled={posting || !draft.trim()} className="self-end shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
          {posting ? '…' : 'Publier'}
        </button>
      </div>
    </div>
  )
}
