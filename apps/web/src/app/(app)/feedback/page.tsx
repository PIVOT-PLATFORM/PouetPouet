'use client'

import { useState, useRef } from 'react'
import { MessageSquare, Plus, RefreshCw, ThumbsUp, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'
import { useFeedback, type FeedbackTicket, type FeedbackColumn, type FeedbackType } from '@/hooks/useFeedback'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { useAuthStore } from '@/store/auth'

// ── Constantes ────────────────────────────────────────────────────────────────

const COLUMNS: { key: FeedbackColumn; label: string; color: string }[] = [
  { key: 'ANALYSE', label: 'Analyse', color: '#7c3aed' },
  { key: 'BACKLOG', label: 'Backlog', color: '#2563eb' },
  { key: 'IMPLEMENTING', label: 'Implémentation', color: '#d97706' },
  { key: 'PARKING', label: 'Parking', color: '#6b7280' },
  { key: 'DONE', label: 'Fait', color: '#16a34a' },
]

const COLUMN_ORDER = COLUMNS.map((c) => c.key)

const inputCls = 'w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400'

function frDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Modal création / édition ──────────────────────────────────────────────────

function TicketModal({ initial, defaultName, onClose, onSave }: {
  initial?: FeedbackTicket
  defaultName: string
  onClose: () => void
  onSave: (title: string, body: string, type: FeedbackType, authorName: string) => Promise<unknown>
}) {
  const isEdit = !!initial
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [type, setType] = useState<FeedbackType>(initial?.type ?? 'BUG')
  const [authorName, setAuthorName] = useState(initial?.authorName ?? defaultName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim() || !authorName.trim()) { setError('Tous les champs sont obligatoires.'); return }
    setSaving(true)
    setError(null)
    try {
      await onSave(title.trim(), body.trim(), type, authorName.trim())
      onClose()
    } catch {
      setError('Erreur lors de l\'enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{isEdit ? 'Modifier le ticket' : 'Nouveau ticket'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Type</label>
            <div className="flex gap-2">
              {(['BUG', 'FEATURE'] as FeedbackType[]).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${type === t
                    ? t === 'BUG' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 ring-2 ring-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 ring-2 ring-blue-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                  {t === 'BUG' ? '🐛 Bug' : '✨ Fonctionnalité'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Titre</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Résumé en une ligne" className={inputCls} maxLength={120} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Décrivez le bug ou le besoin en détail…" rows={4} className={`${inputCls} resize-none`} maxLength={2000} />
          </div>
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Votre nom</label>
              <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="Prénom Nom" className={inputCls} maxLength={80} />
            </div>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-60">
              {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Envoyer le ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Carte ticket ──────────────────────────────────────────────────────────────

function TicketCard({ ticket, userId, isAdmin, isDragging, onDragStart, onDragEnd, onVote, onEdit, onDelete }: {
  ticket: FeedbackTicket
  userId: string | undefined
  isAdmin: boolean
  isDragging: boolean
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onVote: (id: string) => void
  onEdit: (t: FeedbackTicket) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [voting, setVoting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isLong = ticket.body.length > 140
  const canEdit = isAdmin || ticket.authorId === userId

  async function handleVote() {
    setVoting(true)
    try { await onVote(ticket.id) } finally { setVoting(false) }
  }

  async function handleDelete() {
    if (!confirm(`Supprimer le ticket "${ticket.title}" ?`)) return
    setDeleting(true)
    try { await onDelete(ticket.id) } finally { setDeleting(false) }
  }

  return (
    <div
      draggable={isAdmin}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', ticket.id); e.dataTransfer.effectAllowed = 'move'; onDragStart(ticket.id) }}
      onDragEnd={onDragEnd}
      className={`rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col gap-3 shadow-sm transition-opacity ${isAdmin ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'opacity-40' : 'opacity-100'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ticket.type === 'BUG' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
          {ticket.type === 'BUG' ? '🐛 Bug' : '✨ Feature'}
        </span>
        {canEdit && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onEdit(ticket)} className="p-1 rounded-lg text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <Pencil size={12} />
            </button>
            {isAdmin && (
              <button onClick={handleDelete} disabled={deleting} className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{ticket.title}</p>

      <div>
        <p className={`text-xs text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line ${!expanded && isLong ? 'line-clamp-3' : ''}`}>
          {ticket.body}
        </p>
        {isLong && (
          <button onClick={() => setExpanded((v) => !v)} className="mt-1 flex items-center gap-0.5 text-xs text-violet-600 dark:text-violet-400 font-medium">
            {expanded ? <><ChevronUp size={12} /> Réduire</> : <><ChevronDown size={12} /> Voir plus</>}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-50 dark:border-gray-800">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{ticket.authorName}</p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">{frDate(ticket.createdAt)}</p>
        </div>
        <button
          onClick={handleVote}
          disabled={voting}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${ticket.hasVoted ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-violet-50 dark:hover:bg-violet-900/20'}`}>
          <ThumbsUp size={11} /> {ticket.votes}
        </button>
      </div>

    </div>
  )
}

// ── Colonne kanban ────────────────────────────────────────────────────────────

function KanbanColumn({ col, tickets, userId, isAdmin, draggedId, onDragStart, onDragEnd, onRefresh, onMove, onVote, onEdit, onDelete, onNew }: {
  col: typeof COLUMNS[number]
  tickets: FeedbackTicket[]
  userId: string | undefined
  isAdmin: boolean
  draggedId: string | null
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onRefresh: () => void
  onMove: (id: string, c: FeedbackColumn) => void
  onVote: (id: string) => void
  onEdit: (t: FeedbackTicket) => void
  onDelete: (id: string) => void
  onNew: () => void
}) {
  const [refreshing, setRefreshing] = useState(false)
  const [isOver, setIsOver] = useState(false)
  // Counter trick to handle dragenter/dragleave on nested children
  const overCount = useRef(0)

  async function handleRefresh() {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    overCount.current += 1
    setIsOver(true)
  }

  function handleDragLeave() {
    overCount.current -= 1
    if (overCount.current === 0) setIsOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    overCount.current = 0
    setIsOver(false)
    const id = e.dataTransfer.getData('text/plain')
    const ticket = tickets.find((t) => t.id === id)
    // Ne rien faire si le ticket est déjà dans cette colonne
    if (!id || ticket) return
    onMove(id, col.key)
  }

  const isDraggingOver = isOver && draggedId !== null
  // La colonne active est celle qui contient le ticket en cours de drag
  const containsDragged = tickets.some((t) => t.id === draggedId)

  return (
    <div
      className={`flex flex-col min-w-[280px] max-w-[320px] w-[300px] min-h-0 rounded-2xl transition-colors ${isDraggingOver ? 'bg-violet-50 dark:bg-violet-950/30' : 'bg-transparent'}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-3 shrink-0 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: col.color }} />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{col.label}</span>
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">{tickets.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {col.key === 'ANALYSE' && (
            <button onClick={onNew} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-violet-600">
              <Plus size={14} />
            </button>
          )}
          <button onClick={handleRefresh} disabled={refreshing} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className={`flex flex-col gap-2 overflow-y-auto flex-1 min-h-0 px-1 pb-2 ${isDraggingOver && !containsDragged ? 'ring-2 ring-violet-400 ring-inset rounded-xl' : ''}`}>
        {tickets.length === 0 && !isDraggingOver && (
          <div className="rounded-xl border-2 border-dashed border-gray-100 dark:border-gray-800 py-8 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-600">Vide</p>
          </div>
        )}
        {isDraggingOver && !containsDragged && tickets.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-700 py-8 text-center">
            <p className="text-xs text-violet-400 dark:text-violet-500">Déposer ici</p>
          </div>
        )}
        {tickets.map((t) => (
          <TicketCard
            key={t.id}
            ticket={t}
            userId={userId}
            isAdmin={isAdmin}
            isDragging={t.id === draggedId}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onVote={onVote}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        {/* Zone de dépôt visible en bas si la colonne a déjà des tickets */}
        {isDraggingOver && !containsDragged && tickets.length > 0 && (
          <div className="rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-700 py-4 text-center shrink-0">
            <p className="text-xs text-violet-400 dark:text-violet-500">Déposer ici</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function FeedbackPage() {
  useFlagGuard('module.feedback')
  const { tickets, isLoading, load, createTicket, updateTicket, moveTicket, deleteTicket, toggleVote } = useFeedback()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.isAdmin ?? false
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<FeedbackTicket | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const byColumn = (col: FeedbackColumn) => tickets.filter((t) => t.column === col)

  return (
    <div className="flex flex-col h-[calc(100vh-56px-4rem)]">
      <div className="flex items-end justify-between pb-5 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
            <MessageSquare size={28} style={{ color: '#7c3aed' }} /> Feedback
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} · partagez vos retours et idées
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 active:scale-95 transition-all shadow-sm">
          <Plus size={16} /> Nouveau ticket
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="h-8 w-8 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto flex-1 min-h-0 pb-4">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.key}
              col={col}
              tickets={byColumn(col.key)}
              userId={user?.id}
              isAdmin={isAdmin}
              draggedId={draggedId}
              onDragStart={setDraggedId}
              onDragEnd={() => setDraggedId(null)}
              onRefresh={load}
              onMove={moveTicket}
              onVote={toggleVote}
              onEdit={setEditing}
              onDelete={deleteTicket}
              onNew={() => setCreating(true)}
            />
          ))}
        </div>
      )}

      {creating && (
        <TicketModal
          defaultName={user?.name ?? ''}
          onClose={() => setCreating(false)}
          onSave={createTicket}
        />
      )}

      {editing && (
        <TicketModal
          initial={editing}
          defaultName={editing.authorName}
          onClose={() => setEditing(null)}
          onSave={(title, body, type) => updateTicket(editing.id, { title, body, type })}
        />
      )}
    </div>
  )
}
