'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCapacityTeams, useCapacityEvents } from '@/hooks/useCapacity'
import type { CapacityTeam, CapacityEvent, CapacityEventType } from '@/hooks/useCapacity'
import type { CreateEventInput } from '@/hooks/useCapacity'
import {
  EVENT_TYPE_LABELS, EVENT_TYPE_EMOJI, EVENT_STATUS_LABELS, WEEKDAY_LABELS,
  computeEventCapacity, formatDateRange,
} from '@/lib/capacity'

interface TeamMemberDraft { name: string; role: string; fte: number }

// ── Team editor modal ─────────────────────────────────────────────────────────

function TeamModal({
  team, onSave, onClose,
}: {
  team?: CapacityTeam | null
  onSave: (name: string, members: TeamMemberDraft[], color: string, description: string) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(team?.name ?? '')
  const [description, setDescription] = useState(team?.description ?? '')
  const [color, setColor] = useState(team?.color ?? '#6366f1')
  const [members, setMembers] = useState<TeamMemberDraft[]>(
    team?.members.map((m) => ({ name: m.name, role: m.role ?? '', fte: m.fte ?? 1 })) ?? [{ name: '', role: '', fte: 1 }],
  )
  const [saving, setSaving] = useState(false)

  function update(i: number, patch: Partial<TeamMemberDraft>) {
    setMembers((p) => p.map((m, idx) => idx === i ? { ...m, ...patch } : m))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clean = members.map((m) => ({ ...m, name: m.name.trim() })).filter((m) => m.name)
    if (!name.trim() || !clean.length) return
    setSaving(true)
    try {
      await onSave(name.trim(), clean, color, description)
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
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{team ? 'Modifier l\'équipe' : 'Nouvelle équipe'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nom</label>
              <input
                autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Squad Alpha"
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Couleur</label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-10 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description (optionnel)</label>
            <input
              value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tribu, domaine…"
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Membres</label>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 px-1 text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                <span className="flex-1">Nom</span>
                <span className="w-28">Rôle</span>
                <span className="w-16 text-center">FTE</span>
                <span className="w-6" />
              </div>
              {members.map((m, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={m.name} onChange={(e) => update(i, { name: e.target.value })} placeholder={`Membre ${i + 1}`}
                    className="flex-1 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                  <input
                    value={m.role} onChange={(e) => update(i, { role: e.target.value })} placeholder="Dev…"
                    className="w-28 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                  <input
                    type="number" min="0" max="1" step="0.1" value={m.fte}
                    onChange={(e) => update(i, { fte: parseFloat(e.target.value) || 0 })}
                    className="w-16 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                  <button type="button" onClick={() => setMembers((p) => p.filter((_, idx) => idx !== i))} className="w-6 text-gray-400 hover:text-red-500 transition-colors">✕</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setMembers((p) => [...p, { name: '', role: '', fte: 1 }])} className="mt-2 text-sm text-primary-600 hover:text-primary-800 font-medium dark:text-primary-400">
              + Ajouter un membre
            </button>
          </div>
        </form>
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex gap-3 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !name.trim()} className="flex-1 rounded-xl bg-primary-600 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create event modal ────────────────────────────────────────────────────────

const TYPES: CapacityEventType[] = ['PI_PLANNING', 'SPRINT', 'RELEASE', 'CUSTOM']

function addDaysISO(base: string, days: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function CreateEventModal({
  teams, events, onCreate, onClose,
}: {
  teams: CapacityTeam[]
  events: CapacityEvent[]
  onCreate: (input: CreateEventInput) => Promise<CapacityEvent>
  onClose: () => void
}) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [name, setName] = useState('')
  const [type, setType] = useState<CapacityEventType>('SPRINT')
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '')
  const [parentId, setParentId] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(addDaysISO(today, 13))
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [hoursPerDay, setHoursPerDay] = useState(8)
  const [focusFactor, setFocusFactor] = useState(0.8)
  const [seedFromTeam, setSeedFromTeam] = useState(true)
  const [saving, setSaving] = useState(false)

  const piEvents = events.filter((e) => e.type === 'PI_PLANNING')

  function toggleDay(d: number) {
    setWorkingDays((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !startDate || !endDate) return
    setSaving(true)
    try {
      const event = await onCreate({
        name: name.trim(), type,
        teamId: teamId || null,
        parentId: parentId || null,
        startDate, endDate, workingDays, hoursPerDay, focusFactor,
        seedFromTeam: seedFromTeam && !!teamId,
      })
      router.push(`/capacity/${event.id}`)
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
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">PI Planning, sprint, release…</p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nom</label>
            <input
              autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="PI 25.1, Sprint 42…"
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t} type="button" onClick={() => setType(t)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    type === t ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400'
                  }`}
                >
                  <span>{EVENT_TYPE_EMOJI[t]}</span> {EVENT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Début</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Fin</label>
              <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
          </div>

          {/* Working days */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Jours travaillés</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button
                  key={d} type="button" onClick={() => toggleDay(d)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    workingDays.includes(d) ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-950 dark:text-primary-300' : 'border-gray-200 dark:border-gray-700 text-gray-400'
                  }`}
                >
                  {WEEKDAY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Params */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Heures / jour</label>
              <input type="number" min="1" max="24" step="0.5" value={hoursPerDay} onChange={(e) => setHoursPerDay(parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Focus factor <span className="text-gray-400">({Math.round(focusFactor * 100)}%)</span>
              </label>
              <input type="range" min="0" max="1" step="0.05" value={focusFactor} onChange={(e) => setFocusFactor(parseFloat(e.target.value))} className="w-full mt-2.5 accent-primary-600" />
            </div>
          </div>

          {/* Team */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Équipe</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white">
              <option value="">— Aucune équipe —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.members.length})</option>)}
            </select>
            {teamId && (
              <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input type="checkbox" checked={seedFromTeam} onChange={(e) => setSeedFromTeam(e.target.checked)} className="accent-primary-600" />
                Pré-remplir les membres depuis l'équipe
              </label>
            )}
          </div>

          {/* Parent PI */}
          {type !== 'PI_PLANNING' && piEvents.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Rattacher à un PI Planning (optionnel)</label>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white">
                <option value="">— Aucun —</option>
                {piEvents.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          )}
        </form>

        <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex gap-3 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !name.trim()} className="flex-1 rounded-xl bg-primary-600 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Création…' : 'Créer l\'événement'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Event card ────────────────────────────────────────────────────────────────

function EventCard({ event, onOpen, onDelete }: { event: CapacityEvent; onOpen: () => void; onDelete: () => void }) {
  const cap = computeEventCapacity(event)
  const status = EVENT_STATUS_LABELS[event.status]
  return (
    <div
      onClick={onOpen}
      className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex items-center gap-4 hover:border-primary-200 dark:hover:border-primary-800 transition-colors cursor-pointer"
    >
      <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950 flex items-center justify-center text-xl shrink-0">
        {EVENT_TYPE_EMOJI[event.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-900 dark:text-white truncate">{event.name}</p>
          {event.parent && <span className="text-[11px] text-gray-400 truncate">↳ {event.parent.name}</span>}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {EVENT_TYPE_LABELS[event.type]} · {formatDateRange(event.startDate, event.endDate)}
          {' · '}{event._count?.members ?? event.members.length} pers.
          {' · '}{cap.totalNetPersonDays} j·h
          {cap.totalPoints != null && ` · ~${cap.totalPoints} pts`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {event.team && (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="w-2 h-2 rounded-full" style={{ background: event.team.color }} />
            {event.team.name}
          </span>
        )}
        <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${status.cls}`}>{status.label}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
          title="Supprimer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CapacityPage() {
  const router = useRouter()
  const { teams, isLoading: teamsLoading, createTeam, updateTeam, deleteTeam } = useCapacityTeams()
  const { events, isLoading: eventsLoading, createEvent, deleteEvent } = useCapacityEvents()

  const [showCreate, setShowCreate] = useState(false)
  const [teamModal, setTeamModal] = useState<{ open: boolean; team: CapacityTeam | null }>({ open: false, team: null })
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  async function handleSaveTeam(name: string, members: TeamMemberDraft[], color: string, description: string) {
    if (teamModal.team) await updateTeam(teamModal.team.id, name, members, color, description)
    else await createTeam(name, members, color, description)
  }

  const q = search.trim().toLowerCase()
  const filtered = q ? events.filter((e) => e.name.toLowerCase().includes(q)) : events

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Capacité</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Calculez la capacité de vos équipes par PI, sprint ou release</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 active:scale-95 transition-all shadow-sm shadow-primary-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Nouvel événement
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Events list */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Événements</h2>

          {!eventsLoading && events.length > 0 && (
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" />
              </svg>
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un événement…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all"
              />
            </div>
          )}

          {eventsLoading ? (
            <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />)}</div>
          ) : events.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
              <span className="text-4xl block mb-3">🧮</span>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Aucun événement</p>
              <p className="text-gray-500 text-sm mt-1">Créez un PI Planning ou un sprint pour calculer la capacité.</p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">Aucun événement ne correspond à « {search} ».</p>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onOpen={() => router.push(`/capacity/${event.id}`)}
                  onDelete={() => setConfirmDelete(event.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Teams sidebar */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Équipes</h2>
            <button onClick={() => setTeamModal({ open: true, team: null })} className="text-xs text-primary-600 hover:text-primary-800 font-semibold dark:text-primary-400">+ Nouvelle</button>
          </div>

          {teamsLoading ? (
            <div className="flex flex-col gap-2">{[1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
          ) : teams.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 text-center">
              <p className="text-gray-500 text-sm">Créez une équipe avec ses membres et leurs FTE pour la réutiliser.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {teams.map((team) => (
                <div key={team.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: team.color }} />
                      {team.name}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => setTeamModal({ open: true, team })} className="text-xs text-gray-400 hover:text-primary-600 px-1.5 py-0.5 rounded transition-colors">Modifier</button>
                      <button onClick={() => deleteTeam(team.id)} className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded transition-colors">✕</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {team.members.map((m) => (
                      <span key={m.id} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-md px-2 py-0.5">
                        {m.name}{m.fte !== 1 && <span className="text-gray-400"> ·{m.fte}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreate && <CreateEventModal teams={teams} events={events} onCreate={createEvent} onClose={() => setShowCreate(false)} />}
      {teamModal.open && <TeamModal team={teamModal.team} onSave={handleSaveTeam} onClose={() => setTeamModal({ open: false, team: null })} />}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">Supprimer cet événement ?</h3>
            <p className="text-sm text-gray-500 mb-5">Les membres et absences associés seront supprimés. Action irréversible.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
              <button onClick={() => { deleteEvent(confirmDelete); setConfirmDelete(null) }} className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
