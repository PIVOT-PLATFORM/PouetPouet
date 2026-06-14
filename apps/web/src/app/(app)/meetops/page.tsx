'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMeetEvents, useMeetSearch } from '@/hooks/useMeetops'
import { useMeetGraph } from '@/hooks/useMeetGraph'
import type { CreateEventInput } from '@/hooks/useMeetops'
import { labelColor } from '@/lib/meetops'
import type { MeetEventType } from '@/lib/meetops'
import {
  EVENT_TYPE_LABELS, EVENT_TYPE_EMOJI, EVENT_STATUS_LABELS,
} from '@/lib/meetops'

// ── Bannière de connexion Microsoft ─────────────────────────────────────────────

function GraphBanner() {
  const { status, connect, disconnect } = useMeetGraph()
  const params = useSearchParams()
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const g = params.get('graph')
    if (g === 'connected') setNotice('✅ Compte Microsoft connecté.')
    else if (g === 'error') setNotice('❌ Échec de la connexion Microsoft. Réessaie.')
  }, [params])

  if (!status) return null

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-lg">🟦</span>
        {!status.configured ? (
          <span className="text-gray-500 dark:text-gray-400">Connecteur Microsoft non configuré (variables <code className="text-xs">MS_GRAPH_*</code> à renseigner côté serveur).</span>
        ) : status.connected ? (
          <span className="text-gray-700 dark:text-gray-200">Microsoft connecté{status.email ? ` — ${status.email}` : ''}</span>
        ) : (
          <span className="text-gray-700 dark:text-gray-200">Connecte ton compte Microsoft pour envoyer des réunions Outlook + Teams.</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {notice && <span className="text-xs text-gray-500">{notice}</span>}
        {status.configured && (status.connected ? (
          <button onClick={() => { if (confirm('Déconnecter le compte Microsoft ?')) disconnect() }}
            className="text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-1.5 rounded-lg">Déconnecter</button>
        ) : (
          <button onClick={() => connect().catch((e) => alert((e as Error).message))}
            className="text-xs font-medium text-white bg-[#2f2f8f] hover:opacity-90 px-3 py-1.5 rounded-lg">Connecter Microsoft</button>
        ))}
      </div>
    </div>
  )
}

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
  const [search, setSearch] = useState('')
  const { results, isSearching } = useMeetSearch(search)
  const searching = search.trim().length >= 2

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
    <div>
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">MeetOps</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {isLoading ? '…' : `${events.length} événement${events.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/meetops/calendar"
            className="flex items-center gap-2 rounded-xl ring-1 ring-inset ring-gray-200 dark:ring-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
            📆 Calendrier
          </Link>
          <Link href="/meetops/templates"
            className="flex items-center gap-2 rounded-xl ring-1 ring-inset ring-gray-200 dark:ring-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
            🧩 Modèles
          </Link>
          <Link href="/meetops/lists"
            className="flex items-center gap-2 rounded-xl ring-1 ring-inset ring-gray-200 dark:ring-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
            📋 Listes
          </Link>
          <button onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 active:scale-95 transition-all shadow-sm shadow-primary-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Nouvel événement
          </button>
        </div>
      </div>

      <div className="mb-5">
        <Suspense fallback={null}><GraphBanner /></Suspense>
      </div>

      {/* Barre de recherche transverse */}
      <div className="relative mb-6">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un événement, une réunion, une étiquette, un participant…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {searching ? (
        isSearching && results.length === 0 ? (
          <p className="text-sm text-gray-400">Recherche…</p>
        ) : results.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-500 dark:text-gray-400">Aucun résultat pour « {search.trim()} ».</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-400">{results.length} événement{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''}</p>
            {results.map((ev) => (
              <button key={ev.id} onClick={() => router.push(`/meetops/${ev.id}`)}
                className="text-left bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ev.color }} />
                  <h2 className="font-semibold text-gray-900 dark:text-white truncate">{ev.name}</h2>
                  <span className="text-xs text-gray-400 shrink-0">· {ev._count?.meetings ?? 0} réunion{(ev._count?.meetings ?? 0) > 1 ? 's' : ''}</span>
                </div>
                {ev.matched.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5 mt-3">
                    {ev.matched.map((m) => (
                      <li key={m.id} className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5 text-gray-600 dark:text-gray-300">
                        {m.label && <span className="w-1.5 h-1.5 rounded-full" style={{ background: labelColor(m.label) }} />}
                        {m.title}
                      </li>
                    ))}
                  </ul>
                )}
              </button>
            ))}
          </div>
        )
      ) : isLoading ? (
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
                  const n = ev._count?.meetings ?? 0
                  return <span>{n} réunion{n > 1 ? 's' : ''}</span>
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
