'use client'

import { use, useMemo, useState } from 'react'
import Link from 'next/link'
import { expandRecurrence, type RecurrenceFreq } from '@pouetpouet/shared'
import { useMeetEvent } from '@/hooks/useMeetops'
import { EventCalendar } from '@/components/meetops/event-calendar'
import type { Meeting, MeetSeries } from '@/lib/meetops'
import {
  EVENT_TYPE_LABELS, EVENT_TYPE_EMOJI, EVENT_STATUS_LABELS, MEETING_STATUS_LABELS,
  formatMeetingDate, countMeetings, downloadIcs,
} from '@/lib/meetops'

const STATUSES = ['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'] as const

// ── Bloc participants d'une réunion ─────────────────────────────────────────────

function Participants({
  meeting, onAdd, onRemove,
}: {
  meeting: Meeting
  onAdd: (email: string, name: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    await onAdd(email.trim(), name.trim())
    setEmail(''); setName('')
  }

  return (
    <div className="mt-2 pl-4 border-l-2 border-gray-100 dark:border-gray-800">
      {meeting.participants.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mb-2">
          {meeting.participants.map((p) => (
            <li key={p.id} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-full pl-2.5 pr-1 py-0.5 text-xs text-gray-700 dark:text-gray-300">
              {p.name ? `${p.name} (${p.email})` : p.email}
              <button onClick={() => onRemove(p.id)} className="text-gray-400 hover:text-red-500 px-1" title="Retirer">✕</button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex gap-1.5">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="email@exemple.fr"
          className="flex-1 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (optionnel)"
          className="w-32 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400" />
        <button type="submit" disabled={!email.trim()}
          className="px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-gray-800 disabled:opacity-40 rounded-lg">+ Ajouter</button>
      </form>
    </div>
  )
}

// ── Modale d'ajout de réunion ───────────────────────────────────────────────────

function MeetingModal({
  series, onSave, onClose,
}: {
  series: MeetSeries
  onSave: (input: { title?: string; startAt: string; durationMin?: number; location?: string | null; agenda?: string | null }) => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [durationMin, setDurationMin] = useState(series.defaultDurationMin)
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) return
    setSaving(true)
    try {
      await onSave({
        title: title.trim() || undefined,
        startAt: new Date(`${date}T${time}`).toISOString(),
        durationMin,
        location: location.trim() || null,
      })
      onClose()
    } catch (err) {
      alert((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nouvelle réunion</h2>
          <p className="text-xs text-gray-500 mt-0.5">Série « {series.title} »</p>
        </div>
        <form onSubmit={submit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Titre (par défaut : titre de la série)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={series.title}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} autoFocus
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Heure</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            <div className="w-20">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Min.</label>
              <input type="number" min={5} step={5} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Lieu / lien (optionnel)</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Salle B12 ou lien Teams…"
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">Annuler</button>
            <button type="submit" disabled={saving || !date} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl">
              {saving ? 'Ajout…' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modale de récurrence (génération de réunions) ───────────────────────────────

const WEEKDAYS = [
  { value: 1, label: 'L' }, { value: 2, label: 'M' }, { value: 3, label: 'M' },
  { value: 4, label: 'J' }, { value: 5, label: 'V' }, { value: 6, label: 'S' }, { value: 0, label: 'D' },
]

function RecurrenceModal({
  series, onGenerate, onClose,
}: {
  series: MeetSeries
  onGenerate: (input: {
    freq: RecurrenceFreq; interval: number; startDate: string; daysOfWeek?: number[]
    until?: string | null; count?: number | null; durationMin: number; location?: string | null
  }) => Promise<{ created: number; skipped: number }>
  onClose: () => void
}) {
  const [freq, setFreq] = useState<RecurrenceFreq>('WEEKLY')
  const [interval, setInterval] = useState(1)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1])
  const [endMode, setEndMode] = useState<'count' | 'until'>('count')
  const [count, setCount] = useState(10)
  const [until, setUntil] = useState('')
  const [durationMin, setDurationMin] = useState(series.defaultDurationMin)
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)

  const startDate = date ? `${date}T${time}` : ''

  // Prévisualisation live avec la même fonction pure que l'API.
  const preview = useMemo(() => {
    if (!startDate) return []
    return expandRecurrence({
      freq, interval, startDate,
      daysOfWeek: freq === 'WEEKLY' ? daysOfWeek : undefined,
      until: endMode === 'until' ? (until || undefined) : undefined,
      count: endMode === 'count' ? count : undefined,
    })
  }, [freq, interval, startDate, daysOfWeek, endMode, count, until])

  function toggleDay(d: number) {
    setDaysOfWeek((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) return
    if (endMode === 'until' && !until) { alert('Renseigne une date de fin'); return }
    if (freq === 'WEEKLY' && daysOfWeek.length === 0) { alert('Sélectionne au moins un jour'); return }
    setSaving(true)
    try {
      const res = await onGenerate({
        freq, interval, startDate,
        daysOfWeek: freq === 'WEEKLY' ? daysOfWeek : undefined,
        until: endMode === 'until' ? until : null,
        count: endMode === 'count' ? count : null,
        durationMin,
        location: location.trim() || null,
      })
      alert(`${res.created} réunion(s) créée(s)${res.skipped ? `, ${res.skipped} déjà existante(s)` : ''}.`)
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
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Générer les réunions</h2>
          <p className="text-xs text-gray-500 mt-0.5">Série « {series.title} »</p>
        </div>
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Fréquence</label>
              <select value={freq} onChange={(e) => setFreq(e.target.value as RecurrenceFreq)}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="DAILY">Quotidienne</option>
                <option value="WEEKLY">Hebdomadaire</option>
                <option value="MONTHLY">Mensuelle</option>
              </select>
            </div>
            <div className="w-28">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tous les</label>
              <input type="number" min={1} value={interval} onChange={(e) => setInterval(Math.max(1, Number(e.target.value)))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
          </div>

          {freq === 'WEEKLY' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Jours</label>
              <div className="flex gap-1.5">
                {WEEKDAYS.map((d) => (
                  <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${daysOfWeek.includes(d.value) ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Première occurrence</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} autoFocus
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Heure</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            <div className="w-20">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Min.</label>
              <input type="number" min={5} step={5} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Fin</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                <input type="radio" checked={endMode === 'count'} onChange={() => setEndMode('count')} />
                après
                <input type="number" min={1} max={200} value={count} disabled={endMode !== 'count'}
                  onChange={(e) => setCount(Math.min(200, Math.max(1, Number(e.target.value))))}
                  className="w-16 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1 text-sm disabled:opacity-40" />
                réunions
              </label>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="radio" checked={endMode === 'until'} onChange={() => setEndMode('until')} />
              jusqu&apos;au
              <input type="date" value={until} disabled={endMode !== 'until'} onChange={(e) => setUntil(e.target.value)}
                className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1 text-sm disabled:opacity-40" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Lieu / lien (optionnel)</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Salle B12 ou lien Teams…"
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Aperçu : {preview.length} réunion{preview.length > 1 ? 's' : ''}{preview.length >= 200 ? ' (plafond atteint)' : ''}
            </p>
            {preview.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatMeetingDate(preview[0].toISOString())}
                {preview.length > 1 && <> → {formatMeetingDate(preview[preview.length - 1].toISOString())}</>}
              </p>
            )}
          </div>
        </form>
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 shrink-0 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">Annuler</button>
          <button onClick={submit} disabled={saving || !date || preview.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl">
            {saving ? 'Génération…' : `Générer ${preview.length || ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page détail ─────────────────────────────────────────────────────────────────

export default function MeetopsEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const {
    event, isLoading, error,
    updateEvent, addSeries, deleteSeries,
    addMeeting, deleteMeeting, generateMeetings, addParticipant, removeParticipant,
  } = useMeetEvent(id)

  const [newSeries, setNewSeries] = useState('')
  const [meetingModal, setMeetingModal] = useState<MeetSeries | null>(null)
  const [recurrenceModal, setRecurrenceModal] = useState<MeetSeries | null>(null)
  const [view, setView] = useState<'list' | 'calendar'>('list')

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" /></div>
  }
  if (error || !event) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Événement introuvable</h2>
        <Link href="/meetops" className="text-sm text-primary-600 hover:text-primary-700 mt-3 inline-block">← Retour</Link>
      </div>
    )
  }

  async function handleAddSeries(e: React.FormEvent) {
    e.preventDefault()
    if (!newSeries.trim()) return
    await addSeries({ title: newSeries.trim() })
    setNewSeries('')
  }

  async function handleExport(path: string) {
    try { await downloadIcs(path) } catch (err) { alert((err as Error).message) }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <Link href="/meetops" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">← MeetOps</Link>

      {/* En-tête événement */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <span className="w-3 h-3 rounded-full mt-2 shrink-0" style={{ background: event.color }} />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{event.name}</h1>
            {event.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{event.description}</p>}
            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
              <span>{EVENT_TYPE_EMOJI[event.type]} {EVENT_TYPE_LABELS[event.type]}</span>
              <span>·</span>
              <span>{event.series.length} série{event.series.length > 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{countMeetings(event)} réunion{countMeetings(event) > 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {countMeetings(event) > 0 && (
              <button onClick={() => handleExport(`/api/meetops/events/${event.id}/ics`)}
                className="text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-2 py-1.5"
                title="Exporter toutes les réunions au format .ics">↓ .ics</button>
            )}
            <select
              value={event.status} onChange={(e) => updateEvent({ status: e.target.value as typeof STATUSES[number] })}
              className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{EVENT_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Bascule de vue */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 self-start">
        <button onClick={() => setView('list')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${view === 'list' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
          Liste
        </button>
        <button onClick={() => setView('calendar')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${view === 'calendar' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
          Calendrier
        </button>
      </div>

      {view === 'calendar' && <EventCalendar event={event} />}

      {/* Séries */}
      <div className={`flex flex-col gap-4 ${view === 'calendar' ? 'hidden' : ''}`}>
        {event.series.map((series) => (
          <div key={series.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">{series.title}</h2>
              <div className="flex items-center gap-2 shrink-0">
                {series.meetings.length > 0 && (
                  <button onClick={() => handleExport(`/api/meetops/series/${series.id}/ics`)}
                    className="text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded-lg" title="Exporter la série en .ics">↓ .ics</button>
                )}
                <button onClick={() => setRecurrenceModal(series)}
                  className="text-xs font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-gray-800 px-2 py-1 rounded-lg">⟳ Générer</button>
                <button onClick={() => setMeetingModal(series)}
                  className="text-xs font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-gray-800 px-2 py-1 rounded-lg">+ Réunion</button>
                <button onClick={() => { if (confirm(`Supprimer la série « ${series.title} » ?`)) deleteSeries(series.id) }}
                  className="text-xs text-gray-400 hover:text-red-500 px-1" title="Supprimer la série">✕</button>
              </div>
            </div>

            {series.meetings.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Aucune réunion planifiée.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {series.meetings.map((m) => (
                  <li key={m.id} className="border border-gray-100 dark:border-gray-800 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{m.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatMeetingDate(m.startAt)} · {m.durationMin} min
                          {m.location ? ` · ${m.location}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">{MEETING_STATUS_LABELS[m.status]}</span>
                        <button onClick={() => handleExport(`/api/meetops/meetings/${m.id}/ics`)}
                          className="text-gray-400 hover:text-primary-600 text-xs px-1" title="Exporter en .ics">↓</button>
                        <button onClick={() => { if (confirm('Supprimer cette réunion ?')) deleteMeeting(m.id) }}
                          className="text-gray-400 hover:text-red-500 text-xs px-1" title="Supprimer">✕</button>
                      </div>
                    </div>
                    <Participants
                      meeting={m}
                      onAdd={(email, name) => addParticipant(m.id, { email, name: name || null })}
                      onRemove={removeParticipant}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {/* Ajout de série */}
        <form onSubmit={handleAddSeries} className="flex gap-2">
          <input value={newSeries} onChange={(e) => setNewSeries(e.target.value)} placeholder="Nom d'une nouvelle série (ex. Daily, Reviews…)"
            className="flex-1 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          <button type="submit" disabled={!newSeries.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl">+ Série</button>
        </form>
      </div>

      {meetingModal && (
        <MeetingModal
          series={meetingModal}
          onSave={(input) => addMeeting(meetingModal.id, input)}
          onClose={() => setMeetingModal(null)}
        />
      )}

      {recurrenceModal && (
        <RecurrenceModal
          series={recurrenceModal}
          onGenerate={(input) => generateMeetings(recurrenceModal.id, input)}
          onClose={() => setRecurrenceModal(null)}
        />
      )}
    </div>
  )
}
