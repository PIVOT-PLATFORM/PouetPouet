'use client'

import { useState } from 'react'
import type { WheelDraw, WheelEvent } from '@/hooks/useWheel'

// ── Spinning slot card ────────────────────────────────────────────────────────

export function SlotCard({
  name,
  color,
  locked,
  index,
}: {
  name: string
  color: string
  locked: boolean
  index: number
}) {
  return (
    <div
      className={`w-28 h-36 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shadow-xl transition-all duration-300 ${
        locked
          ? 'scale-100 opacity-100'
          : 'scale-95 opacity-80'
      }`}
      style={{
        animation: locked ? `popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${index * 120}ms both` : undefined,
      }}
    >
      <span className="text-white font-bold text-center text-lg leading-tight px-3 select-none">
        {name}
      </span>
    </div>
  )
}

// ── Draw result panel ─────────────────────────────────────────────────────────

export function DrawResultPanel({
  draw,
  events,
  onUpdateDraw,
  onRedraw,
  onCreateEvent,
}: {
  draw: WheelDraw
  events: WheelEvent[]
  onUpdateDraw: (id: string, patch: { note?: string; eventId?: string | null }) => Promise<void>
  onRedraw: (excluded: string[]) => void
  onCreateEvent: (name: string) => Promise<WheelEvent>
}) {
  const [note, setNote] = useState(draw.note ?? '')
  const [selectedEventId, setSelectedEventId] = useState(draw.eventId ?? '')
  const [newEventName, setNewEventName] = useState('')
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSaveNote() {
    setSaving(true)
    await onUpdateDraw(draw.id, { note: note || undefined })
    setSaving(false)
  }

  async function handleAssignEvent(eventId: string) {
    setSelectedEventId(eventId)
    await onUpdateDraw(draw.id, { eventId: eventId || null })
  }

  async function handleCreateAndAssign() {
    if (!newEventName.trim()) return
    const event = await onCreateEvent(newEventName.trim())
    setSelectedEventId(event.id)
    setNewEventName('')
    setShowNewEvent(false)
    await onUpdateDraw(draw.id, { eventId: event.id })
  }

  const allExcluded = [...draw.excluded, ...draw.results]

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 flex flex-col gap-4">
      {/* Note */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Note</label>
        <div className="flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ex: Daily du 17/05/2026"
            className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:bg-gray-800 dark:text-white"
            onKeyDown={(e) => e.key === 'Enter' && handleSaveNote()}
          />
          <button
            onClick={handleSaveNote}
            disabled={saving}
            className="px-3 py-2 rounded-xl bg-primary-100 text-primary-700 text-sm font-medium hover:bg-primary-200 disabled:opacity-50 transition-colors"
          >
            {saving ? '…' : '✓'}
          </button>
        </div>
      </div>

      {/* Event assignment */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Événement</label>
        {showNewEvent ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              placeholder="Nom de l'événement"
              className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:bg-gray-800 dark:text-white"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAssign()}
            />
            <button onClick={handleCreateAndAssign} className="px-3 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700">
              Créer
            </button>
            <button onClick={() => setShowNewEvent(false)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">
              ✕
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <select
              value={selectedEventId}
              onChange={(e) => handleAssignEvent(e.target.value)}
              className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:bg-gray-800 dark:text-white"
            >
              <option value="">— Aucun événement —</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            <button
              onClick={() => setShowNewEvent(true)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 whitespace-nowrap"
            >
              + Nouveau
            </button>
          </div>
        )}
      </div>

      {/* Re-draw */}
      <button
        onClick={() => onRedraw(allExcluded)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-primary-300 text-primary-600 text-sm font-semibold hover:bg-primary-50 dark:border-primary-700 dark:text-primary-400 dark:hover:bg-primary-950 transition-colors"
      >
        🔄 Relancer sans {draw.results.join(', ')}
      </button>
    </div>
  )
}

// ── Inline event creator ──────────────────────────────────────────────────────

export function CreateEventInline({ onCreate }: { onCreate: (name: string) => Promise<WheelEvent> }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    await onCreate(name.trim())
    setName('')
    setOpen(false)
    setSaving(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-primary-600 hover:text-primary-800 dark:text-primary-400 font-semibold text-left"
      >
        + Créer un événement
      </button>
    )
  }

  return (
    <div className="flex gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom de l'événement"
        onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setOpen(false) }}
        className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:bg-gray-800 dark:text-white"
      />
      <button
        onClick={handleCreate}
        disabled={saving || !name.trim()}
        className="px-3 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
      >
        {saving ? '…' : 'OK'}
      </button>
      <button onClick={() => setOpen(false)} className="px-2 py-2 text-gray-400 hover:text-gray-600">✕</button>
    </div>
  )
}
