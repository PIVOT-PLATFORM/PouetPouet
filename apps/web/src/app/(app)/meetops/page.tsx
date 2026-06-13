'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMeetEvents } from '@/hooks/useMeetops'
import type { CreateEventInput } from '@/hooks/useMeetops'
import type { MeetEventType } from '@/lib/meetops'
import {
  EVENT_TYPE_LABELS, EVENT_TYPE_EMOJI, EVENT_STATUS_LABELS,
} from '@/lib/meetops'

const EVENT_TYPES: MeetEventType[] = ['VERSION', 'SPRINT', 'COPIL', 'COMOP', 'RELEASE', 'ONBOARDING', 'CUSTOM']

// ── Modale de création d'événement ─────────────────────────────────────────────

function EventModal({ onSave, onClose }: { onSave: (input: CreateEventInput) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<MeetEventType>('CUSTOM')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [color, setColor] = useState('#475569')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      alert('La date de fin doit suivre la date de début')
      return
    }
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        type,
        description: description.trim() || null,
        startDate: startDate || null,
        endDate: endDate || null,
        color,
      })
      onClose()
    } catch (err) {
      alert((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nouvel événement</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nom</label>
              <input
                autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Release v2.0, COPIL mensuel…"
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Couleur</label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-10 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Type</label>
            <select
              value={type} onChange={(e) => setType(e.target.value as MeetEventType)}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{EVENT_TYPE_EMOJI[t]} {EVENT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description (optionnel)</label>
            <input
              value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contexte de l'événement…"
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Début (optionnel)</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Fin (optionnel)</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
          </div>
        </form>
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 shrink-0 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl transition-colors">
            {saving ? 'Création…' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page liste ──────────────────────────────────────────────────────────────────

export default function MeetopsPage() {
  const router = useRouter()
  const { events, isLoading, createEvent, deleteEvent } = useMeetEvents()
  const [modalOpen, setModalOpen] = useState(false)

  async function handleCreate(input: CreateEventInput) {
    const event = await createEvent(input)
    router.push(`/meetops/${event.id}`)
  }

  async function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.stopPropagation()
    if (!confirm(`Supprimer l'événement « ${name} » et toutes ses réunions ?`)) return
    await deleteEvent(id)
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">🗓️ MeetOps</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gérez vos événements, séries et réunions au même endroit.</p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors shrink-0">
          + Nouvel événement
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Chargement…</p>
      ) : events.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-4xl mb-3">🗓️</p>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Aucun événement pour le moment.</p>
          <button onClick={() => setModalOpen(true)} className="text-sm font-medium text-primary-600 hover:text-primary-700">
            Créer votre premier événement
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((ev) => (
            <button key={ev.id} onClick={() => router.push(`/meetops/${ev.id}`)}
              className="text-left bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ev.color }} />
                  <h2 className="font-semibold text-gray-900 dark:text-white truncate">{ev.name}</h2>
                </div>
                <span
                  onClick={(e) => handleDelete(e, ev.id, ev.name)}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-sm shrink-0 cursor-pointer"
                  title="Supprimer"
                >✕</span>
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
                <span>{EVENT_TYPE_EMOJI[ev.type]} {EVENT_TYPE_LABELS[ev.type]}</span>
                <span>·</span>
                <span>{EVENT_STATUS_LABELS[ev.status]}</span>
                <span>·</span>
                {(() => {
                  const n = ev._count?.series ?? 0
                  return <span>{n} série{n > 1 ? 's' : ''}</span>
                })()}
              </div>
            </button>
          ))}
        </div>
      )}

      {modalOpen && <EventModal onSave={handleCreate} onClose={() => setModalOpen(false)} />}
    </div>
  )
}
