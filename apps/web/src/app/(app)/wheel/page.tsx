'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTeams } from '@/hooks/useDaily'
import { useWheel } from '@/hooks/useWheel'
import type { WheelDraw, WheelEvent, DrawMode } from '@/hooks/useWheel'
import type { DailyTeam } from '@/hooks/useDaily'

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_COLORS = [
  'from-indigo-500 to-purple-600',
  'from-pink-500 to-rose-600',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-600',
  'from-sky-400 to-blue-600',
  'from-violet-500 to-fuchsia-600',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// ── Spinning slot card ────────────────────────────────────────────────────────

function SlotCard({
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

function DrawResultPanel({
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
            className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-800 dark:text-white"
            onKeyDown={(e) => e.key === 'Enter' && handleSaveNote()}
          />
          <button
            onClick={handleSaveNote}
            disabled={saving}
            className="px-3 py-2 rounded-xl bg-indigo-100 text-indigo-700 text-sm font-medium hover:bg-indigo-200 disabled:opacity-50 transition-colors"
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
              className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-800 dark:text-white"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAssign()}
            />
            <button onClick={handleCreateAndAssign} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
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
              className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-800 dark:text-white"
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
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-indigo-300 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950 transition-colors"
      >
        🔄 Relancer sans {draw.results.join(', ')}
      </button>
    </div>
  )
}

// ── Draw history item ─────────────────────────────────────────────────────────

const MODE_BADGE: Record<DrawMode, { label: string; cls: string }> = {
  WEIGHTED: { label: 'Équilibré', cls: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400' },
  RANDOM:   { label: 'Aléatoire', cls: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400' },
}

function DrawHistoryItem({ draw, onDelete }: { draw: WheelDraw; onDelete: (id: string) => void }) {
  const badge = MODE_BADGE[draw.mode] ?? MODE_BADGE.WEIGHTED
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-1 mb-1">
          {draw.results.map((r, i) => (
            <span key={i} className="text-xs font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-lg px-2 py-0.5">
              {r}
            </span>
          ))}
        </div>
        {draw.note && (
          <p className="text-xs text-gray-400 italic truncate">{draw.note}</p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-gray-300 dark:text-gray-600">{formatShortDate(draw.createdAt)} · {draw.teamName}</p>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${badge.cls}`}>{badge.label}</span>
        </div>
      </div>
      <button
        onClick={() => onDelete(draw.id)}
        className="text-gray-300 hover:text-red-400 transition-colors shrink-0 p-1"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
  )
}

// ── Event editor ──────────────────────────────────────────────────────────────

const PAGE_SIZE_EVENT = 5
const PAGE_SIZE_STANDALONE = 4

function Pagination({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / pageSize)
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 pt-1">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 px-1"
      >
        ‹
      </button>
      <span className="text-xs text-gray-400">{page + 1} / {pages}</span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= pages - 1}
        className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 px-1"
      >
        ›
      </button>
    </div>
  )
}

function EventSection({
  event,
  onDelete,
  onRename,
  onDeleteDraw,
}: {
  event: WheelEvent
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onDeleteDraw: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(event.name)
  const [page, setPage] = useState(0)

  const visibleDraws = event.draws.slice(page * PAGE_SIZE_EVENT, (page + 1) * PAGE_SIZE_EVENT)

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-sm">{expanded ? '▾' : '▸'}</span>
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { onRename(event.id, name); setEditing(false) }
              if (e.key === 'Escape') { setName(event.name); setEditing(false) }
            }}
            onBlur={() => { onRename(event.id, name); setEditing(false) }}
            className="flex-1 text-sm font-semibold bg-transparent border-b border-indigo-400 focus:outline-none"
          />
        ) : (
          <span className="flex-1 text-sm font-semibold text-gray-800 dark:text-white truncate">{event.name}</span>
        )}
        <span className="text-xs text-gray-400 shrink-0">{event.draws.length} tirage{event.draws.length !== 1 ? 's' : ''}</span>
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true) }}
          className="text-gray-300 hover:text-indigo-500 transition-colors text-xs px-1"
          title="Renommer"
        >
          ✎
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(event.id) }}
          className="text-gray-300 hover:text-red-400 transition-colors text-xs px-1"
          title="Supprimer"
        >
          ✕
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-2">
          {event.draws.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Aucun tirage dans cet événement</p>
          ) : (
            <>
              {visibleDraws.map((d) => (
                <DrawHistoryItem key={d.id} draw={d} onDelete={onDeleteDraw} />
              ))}
              <Pagination page={page} total={event.draws.length} pageSize={PAGE_SIZE_EVENT} onChange={setPage} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Standalone draws section ──────────────────────────────────────────────────

function StandaloneDrawsSection({ draws, onDelete }: { draws: WheelDraw[]; onDelete: (id: string) => void }) {
  const [page, setPage] = useState(0)
  const visible = draws.slice(page * PAGE_SIZE_STANDALONE, (page + 1) * PAGE_SIZE_STANDALONE)
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Tirages sans événement</p>
      {visible.map((d) => (
        <DrawHistoryItem key={d.id} draw={d} onDelete={onDelete} />
      ))}
      <Pagination page={page} total={draws.length} pageSize={PAGE_SIZE_STANDALONE} onChange={setPage} />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WheelPage() {
  const { teams, isLoading: teamsLoading } = useTeams()
  const { events, standaloneDraws, isLoading: wheelLoading, createEvent, updateEvent, deleteEvent, createDraw, commitDraw, updateDraw, deleteDraw } = useWheel()

  const [selectedTeam, setSelectedTeam] = useState<DailyTeam | null>(null)
  const [count, setCount] = useState(1)
  const [drawMode, setDrawMode] = useState<DrawMode>('WEIGHTED')
  const [excluded, setExcluded] = useState<string[]>([])
  const [spinning, setSpinning] = useState(false)
  const [slots, setSlots] = useState<string[]>([])
  const [locked, setLocked] = useState(false)
  const [currentDraw, setCurrentDraw] = useState<WheelDraw | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-select first team
  useEffect(() => {
    if (teams.length > 0 && !selectedTeam) setSelectedTeam(teams[0])
  }, [teams, selectedTeam])

  // When team changes, reset exclusions and result
  useEffect(() => {
    setExcluded([])
    setCurrentDraw(null)
    setLocked(false)
    setSlots([])
  }, [selectedTeam?.id])

  const members = selectedTeam?.members.map((m) => m.name) ?? []
  const available = members.filter((n) => !excluded.includes(n))
  const effectiveCount = Math.min(count, available.length)

  const stopAnimation = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  async function handleDraw() {
    if (!selectedTeam || available.length === 0) return
    setError(null)
    setLocked(false)
    setCurrentDraw(null)

    // Start slot animation
    setSpinning(true)
    setSlots(Array(effectiveCount).fill('?'))
    intervalRef.current = setInterval(() => {
      setSlots(
        Array(effectiveCount)
          .fill(null)
          .map(() => available[Math.floor(Math.random() * available.length)])
      )
    }, 80)

    try {
      const draw = await createDraw(selectedTeam.id, effectiveCount, excluded, drawMode)
      // Wait minimum spin duration then reveal
      await new Promise((r) => setTimeout(r, 1500))
      stopAnimation()
      setSlots(draw.results)
      setSpinning(false)
      setLocked(true)
      setCurrentDraw(draw)
      // Only add to history AFTER the reveal animation
      commitDraw(draw)
    } catch (e: unknown) {
      stopAnimation()
      setSpinning(false)
      setError(e instanceof Error ? e.message : 'Erreur lors du tirage')
    }
  }

  function handleRedraw(newExcluded: string[]) {
    setExcluded(newExcluded)
    setCurrentDraw(null)
    setLocked(false)
    setSlots([])
  }

  function clearExclusions() {
    setExcluded([])
    setCurrentDraw(null)
    setLocked(false)
    setSlots([])
  }

  const isLoading = teamsLoading || wheelLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">Chargement…</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.3) rotate(-10deg); opacity: 0; }
          70% { transform: scale(1.1) rotate(2deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">La roue</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Tirage aléatoire depuis vos équipes</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left: Controls + animation ── */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Controls panel */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 flex flex-col gap-5">
              {/* Team selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Équipe</label>
                {teams.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    Aucune équipe. Créez-en une dans <a href="/daily" className="text-indigo-600 hover:underline">Mes dailys</a>.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {teams.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTeam(t)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                          selectedTeam?.id === t.id
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-indigo-400'
                        }`}
                      >
                        {t.name}
                        <span className="ml-1.5 text-xs opacity-70">({t.members.length})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedTeam && (
                <>
                  {/* Count selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nombre à tirer
                      <span className="ml-2 text-xs text-gray-400 font-normal">
                        ({available.length} disponible{available.length !== 1 ? 's' : ''})
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() => setCount(n)}
                          disabled={n > available.length}
                          className={`w-11 h-11 rounded-xl text-sm font-bold border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                            count === n
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-indigo-400'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Excluded pills */}
                  {excluded.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Exclus du prochain tirage
                        </label>
                        <button onClick={clearExclusions} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                          Réinitialiser
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {excluded.map((name) => (
                          <span
                            key={name}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-500 dark:text-gray-400"
                          >
                            <span className="line-through">{name}</span>
                            <button
                              onClick={() => setExcluded((prev) => prev.filter((n) => n !== name))}
                              className="text-gray-400 hover:text-red-400 ml-0.5"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mode toggle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mode de tirage</label>
                    <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setDrawMode('WEIGHTED')}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                          drawMode === 'WEIGHTED'
                            ? 'bg-violet-600 text-white'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        ⚖️ Équilibré
                      </button>
                      <button
                        type="button"
                        onClick={() => setDrawMode('RANDOM')}
                        className={`flex-1 py-2 text-sm font-medium transition-colors border-l border-gray-200 dark:border-gray-700 ${
                          drawMode === 'RANDOM'
                            ? 'bg-amber-500 text-white'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        🎲 Aléatoire pur
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {drawMode === 'WEIGHTED'
                        ? 'Réduit la probabilité des personnes récemment tirées'
                        : 'Chaque personne a exactement la même probabilité'}
                    </p>
                  </div>

                  {/* Draw button */}
                  <button
                    onClick={handleDraw}
                    disabled={spinning || available.length === 0}
                    className={`w-full py-4 rounded-2xl text-white text-lg font-bold shadow-lg hover:opacity-95 disabled:opacity-50 transition-all active:scale-98 ${
                      drawMode === 'WEIGHTED'
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:shadow-violet-200 dark:hover:shadow-violet-900'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-amber-200 dark:hover:shadow-amber-900'
                    }`}
                  >
                    {spinning ? '🎡 Tirage en cours…' : available.length === 0 ? 'Tous exclus · Réinitialisez !' : `🎲 Tirer ${effectiveCount} personne${effectiveCount !== 1 ? 's' : ''}`}
                  </button>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
                  )}
                </>
              )}
            </div>

            {/* Animation area */}
            {(spinning || locked) && slots.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 flex flex-col items-center gap-6">
                <div className="flex flex-wrap justify-center gap-4">
                  {slots.map((name, i) => (
                    <SlotCard
                      key={i}
                      name={name}
                      color={CARD_COLORS[i % CARD_COLORS.length]}
                      locked={locked}
                      index={i}
                    />
                  ))}
                </div>

                {spinning && (
                  <p className="text-sm text-gray-400 animate-pulse">Tirage en cours…</p>
                )}

                {locked && currentDraw && (
                  <div className="w-full max-w-md">
                    <DrawResultPanel
                      draw={currentDraw}
                      events={events}
                      onUpdateDraw={updateDraw}
                      onRedraw={handleRedraw}
                      onCreateEvent={createEvent}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Members grid (team overview) */}
            {selectedTeam && !spinning && !locked && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  {selectedTeam.name} — {selectedTeam.members.length} membres
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedTeam.members.map((m) => (
                    <span
                      key={m.id}
                      className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors cursor-pointer select-none ${
                        excluded.includes(m.name)
                          ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 line-through'
                          : 'bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                      }`}
                      onClick={() =>
                        setExcluded((prev) =>
                          prev.includes(m.name) ? prev.filter((n) => n !== m.name) : [...prev, m.name]
                        )
                      }
                      title={excluded.includes(m.name) ? 'Cliquer pour réinclure' : 'Cliquer pour exclure'}
                    >
                      {m.name}
                    </span>
                  ))}
                </div>
                {selectedTeam.members.length > 0 && (
                  <p className="text-xs text-gray-400 mt-2">Cliquez sur un membre pour l'exclure du tirage</p>
                )}
              </div>
            )}
          </div>

          {/* ── Right: History ── sticky so it never exceeds the left panel's bottom */}
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Historique</h2>

            {events.length === 0 && standaloneDraws.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 text-center">
                <p className="text-gray-400 text-sm">Aucun tirage pour l'instant</p>
              </div>
            ) : (
              <>
                {/* Events */}
                {events.map((event) => (
                  <EventSection
                    key={event.id}
                    event={event}
                    onDelete={deleteEvent}
                    onRename={(id, name) => updateEvent(id, name)}
                    onDeleteDraw={deleteDraw}
                  />
                ))}

                {/* Standalone draws */}
                {standaloneDraws.length > 0 && (
                  <StandaloneDrawsSection draws={standaloneDraws} onDelete={deleteDraw} />
                )}
              </>
            )}

            {/* Create event manually */}
            <CreateEventInline onCreate={createEvent} />
          </div>
        </div>
      </div>
    </>
  )
}

// ── Inline event creator ──────────────────────────────────────────────────────

function CreateEventInline({ onCreate }: { onCreate: (name: string) => Promise<WheelEvent> }) {
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
        className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-semibold text-left"
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
        className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-800 dark:text-white"
      />
      <button
        onClick={handleCreate}
        disabled={saving || !name.trim()}
        className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? '…' : 'OK'}
      </button>
      <button onClick={() => setOpen(false)} className="px-2 py-2 text-gray-400 hover:text-gray-600">✕</button>
    </div>
  )
}
