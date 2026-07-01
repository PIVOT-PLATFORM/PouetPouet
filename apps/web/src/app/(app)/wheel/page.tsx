'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useTeams } from '@/hooks/useDaily'
import { useWheel } from '@/hooks/useWheel'
import type { WheelDraw, DrawMode } from '@/hooks/useWheel'
import type { DailyTeam } from '@/hooks/useDaily'
import { SlotCard, DrawResultPanel, CreateEventInline } from '@/components/wheel/wheel-panels'
import { EventSection, StandaloneDrawsSection } from '@/components/wheel/wheel-history'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { Shuffle } from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_COLORS = [
  'from-primary-500 to-secondary-600',
  'from-pink-500 to-rose-600',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-600',
  'from-sky-400 to-blue-600',
  'from-violet-500 to-fuchsia-600',
]


// ── Main page ─────────────────────────────────────────────────────────────────

export default function WheelPage() {
  useFlagGuard('module.wheel')
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2"><Shuffle size={28} style={{ color: '#ec4899' }} />La roue</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Tirage aléatoire depuis vos équipes</p>
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
                  <p className="text-sm text-gray-500">
                    Aucune équipe. Créez-en une dans <Link href="/daily" className="text-primary-700 underline hover:text-primary-900">Mes dailys</Link>.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {teams.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTeam(t)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                          selectedTeam?.id === t.id
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400'
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
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400'
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
                        <button onClick={clearExclusions} className="text-xs text-primary-600 hover:text-primary-800 font-medium">
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
                    <p className="text-xs text-gray-500 mt-1.5">
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
                        ? 'bg-gradient-to-r from-violet-600 to-primary-600 hover:shadow-violet-200 dark:hover:shadow-violet-900'
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
                      onUpdateDraw={async (id, patch) => { await updateDraw(id, patch) }}
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
                          : 'bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300'
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
                  <p className="text-xs text-gray-500 mt-2">Cliquez sur un membre pour l'exclure du tirage</p>
                )}
              </div>
            )}
          </div>

          {/* ── Right: History ── sticky so it never exceeds the left panel's bottom */}
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Historique</h2>

            {events.length === 0 && standaloneDraws.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 text-center">
                <p className="text-gray-500 text-sm">Aucun tirage pour l'instant</p>
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
