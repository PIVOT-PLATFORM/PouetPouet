'use client'

import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { Select } from '@/components/ui/select'
import type { PiCycleTeam, PiIteration, PiTicket, PiTicketInput, PiTicketType } from '@/hooks/usePi'
import { TICKET_TYPES } from './pi-ticket-card'

const inputCls = 'w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400'

// '' représente « Train » (teamId null) et « Non planifié » (iterationId null)
// dans les Select, dont les options n'acceptent que des strings.
const NONE = ''

export function TicketModal({ ticket, initialCell, teams, iterations, canEdit, onSave, onDelete, onClose }: {
  ticket: PiTicket | null // null = création
  initialCell: { teamId: string | null; iterationId: string | null }
  teams: PiCycleTeam[]
  iterations: PiIteration[]
  canEdit: boolean
  onSave: (input: PiTicketInput) => Promise<unknown>
  onDelete: (() => Promise<unknown>) | null
  onClose: () => void
}) {
  const [type, setType] = useState<PiTicketType>(ticket?.type ?? 'FEATURE')
  const [title, setTitle] = useState(ticket?.title ?? '')
  const [description, setDescription] = useState(ticket?.description ?? '')
  const [teamId, setTeamId] = useState(ticket ? (ticket.teamId ?? NONE) : (initialCell.teamId ?? NONE))
  const [iterationId, setIterationId] = useState(ticket ? (ticket.iterationId ?? NONE) : (initialCell.iterationId ?? NONE))
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !canEdit) return
    setSaving(true)
    try {
      await onSave({
        type,
        title: title.trim(),
        description: description.trim() || null,
        teamId: teamId || null,
        iterationId: iterationId || null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDelete || !confirm(`Supprimer le ticket « ${ticket?.title} » ? Ses dépendances seront supprimées.`)) return
    await onDelete()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{ticket ? (canEdit ? 'Modifier le ticket' : 'Ticket') : 'Nouveau ticket'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {TICKET_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                disabled={!canEdit}
                onClick={() => setType(t.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors disabled:cursor-default ${type === t.value ? 'text-white' : 'bg-transparent text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}
                style={type === t.value ? { background: t.color, borderColor: t.color } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre du ticket…"
            maxLength={300}
            autoFocus={canEdit}
            readOnly={!canEdit}
            className={inputCls}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optionnelle)…"
            rows={3}
            maxLength={3000}
            readOnly={!canEdit}
            className={`${inputCls} resize-none`}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Équipe</label>
              {canEdit ? (
                <Select
                  value={teamId}
                  onChange={setTeamId}
                  options={[{ value: NONE, label: '🚂 Train' }, ...teams.map((t) => ({ value: t.id, label: t.name }))]}
                />
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-200 px-1 py-2">{teams.find((t) => t.id === teamId)?.name ?? 'Train'}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Itération</label>
              {canEdit ? (
                <Select
                  value={iterationId}
                  onChange={setIterationId}
                  options={[{ value: NONE, label: 'Non planifié' }, ...iterations.map((it) => ({ value: it.id, label: it.label }))]}
                />
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-200 px-1 py-2">{iterations.find((it) => it.id === iterationId)?.label ?? 'Non planifié'}</p>
              )}
            </div>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2 pt-1">
              {ticket && onDelete && (
                <button type="button" onClick={handleDelete} className="p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" title="Supprimer le ticket">
                  <Trash2 size={16} />
                </button>
              )}
              <div className="flex-1" />
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
              <button type="submit" disabled={saving || !title.trim()} className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                {saving ? 'Enregistrement…' : ticket ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
