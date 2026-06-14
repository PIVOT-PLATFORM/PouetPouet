'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useMeetCalendar } from '@/hooks/useMeetops'
import { MEETING_STATUS_LABELS } from '@/lib/meetops'
import type { MeetCalendarEvent, MeetingStatus } from '@/lib/meetops'

// ── Types & constantes ──────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week' | 'workweek' | 'day'
const VIEW_LABELS: Record<ViewMode, string> = { month: 'Mois', week: 'Semaine', workweek: 'Sem. travail', day: 'Jour' }
const STATUSES: MeetingStatus[] = ['DRAFT', 'SENT', 'UPDATED', 'CANCELLED']
const NO_LABEL = '—' // clé interne pour « sans étiquette »

interface CalFilter { eventIds: string[] | null; statuses: MeetingStatus[] | null; labels: string[] | null }
interface SavedView { id: string; name: string; viewMode: ViewMode; filter: CalFilter }

const EMPTY_FILTER: CalFilter = { eventIds: null, statuses: null, labels: null }

const WEEKDAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function mondayOffset(d: Date): number { return (d.getDay() + 6) % 7 }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function startOfWeek(d: Date): Date { return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -mondayOffset(d)) }

// ── localStorage (préférences d'affichage, par navigateur) ───────────────────────

const LS_VIEWS = 'meetops_cal_views'
const LS_DEFAULT = 'meetops_cal_default'
function loadViews(): SavedView[] { try { return JSON.parse(localStorage.getItem(LS_VIEWS) || '[]') } catch { return [] } }
function persistViews(v: SavedView[]) { localStorage.setItem(LS_VIEWS, JSON.stringify(v)) }
function loadDefaultId(): string | null { try { return localStorage.getItem(LS_DEFAULT) } catch { return null } }
function persistDefaultId(id: string | null) { if (id) localStorage.setItem(LS_DEFAULT, id); else localStorage.removeItem(LS_DEFAULT) }

interface Placed { eventId: string; eventName: string; color: string; title: string; label: string | null; startAt: string; cancelled: boolean }

// ── Popup de recherche / sélection d'événements ──────────────────────────────────

function EventPickerModal({
  events, selected, onApply, onClose,
}: {
  events: MeetCalendarEvent[]
  selected: string[] | null
  onApply: (ids: string[] | null) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  // null = tous → on matérialise en set de tous les ids pour l'édition.
  const [picked, setPicked] = useState<Set<string>>(() => new Set(selected ?? events.map((e) => e.id)))

  const filtered = events.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()))
  function toggle(id: string) { setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n }) }

  function apply() {
    onApply(picked.size === events.length ? null : [...picked])
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Événements affichés</h3>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" />
            </svg>
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un événement…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <div className="flex gap-3 mt-2 text-xs">
            <button onClick={() => setPicked(new Set(events.map((e) => e.id)))} className="text-primary-600 hover:underline">Tout</button>
            <button onClick={() => setPicked(new Set())} className="text-gray-500 hover:underline">Aucun</button>
            <span className="ml-auto text-gray-400">{picked.size}/{events.length}</span>
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {filtered.map((e) => (
            <li key={e.id}>
              <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-sm">
                <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e.id)} className="accent-primary-600" />
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: e.color }} />
                <span className="truncate text-gray-700 dark:text-gray-200">{e.name}</span>
                <span className="ml-auto text-xs text-gray-400 shrink-0">{e.meetings.length}</span>
              </label>
            </li>
          ))}
          {filtered.length === 0 && <li className="text-sm text-gray-400 px-2 py-4 text-center">Aucun événement.</li>}
        </ul>
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 shrink-0 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">Annuler</button>
          <button onClick={apply} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl">Appliquer</button>
        </div>
      </div>
    </div>
  )
}

// ── Panneau de filtres (statuts + étiquettes) ────────────────────────────────────

function FilterPanel({
  allLabels, filter, onChange, onClose,
}: {
  allLabels: string[]
  filter: CalFilter
  onChange: (f: CalFilter) => void
  onClose: () => void
}) {
  function toggleStatus(s: MeetingStatus) {
    const cur = filter.statuses ?? STATUSES
    const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]
    onChange({ ...filter, statuses: next.length === STATUSES.length ? null : next })
  }
  function toggleLabel(l: string) {
    const all = allLabels
    const cur = filter.labels ?? all
    const next = cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]
    onChange({ ...filter, labels: next.length === all.length ? null : next })
  }
  const statusOn = (s: MeetingStatus) => !filter.statuses || filter.statuses.includes(s)
  const labelOn = (l: string) => !filter.labels || filter.labels.includes(l)

  return (
    <div className="absolute right-0 top-full mt-2 z-40 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Filtres</h4>
        <button onClick={() => onChange({ ...filter, statuses: null, labels: null })} className="text-xs text-gray-400 hover:text-gray-600">Réinitialiser</button>
      </div>
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mt-2 mb-1">Statut</p>
      <div className="flex flex-col gap-1">
        {STATUSES.map((s) => (
          <label key={s} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
            <input type="checkbox" checked={statusOn(s)} onChange={() => toggleStatus(s)} className="accent-primary-600" />
            {MEETING_STATUS_LABELS[s]}
          </label>
        ))}
      </div>
      {allLabels.length > 0 && (
        <>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mt-3 mb-1">Étiquette</p>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {allLabels.map((l) => (
              <label key={l} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                <input type="checkbox" checked={labelOn(l)} onChange={() => toggleLabel(l)} className="accent-primary-600" />
                {l === NO_LABEL ? <span className="text-gray-400">Sans étiquette</span> : l}
              </label>
            ))}
          </div>
        </>
      )}
      <button onClick={onClose} className="mt-3 w-full text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 py-1.5 rounded-lg">Fermer</button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────────

export default function MeetopsCalendarPage() {
  const { events, isLoading } = useMeetCalendar()

  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const [filter, setFilter] = useState<CalFilter>(EMPTY_FILTER)
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [defaultId, setDefaultId] = useState<string | null>(null)
  const [appliedId, setAppliedId] = useState<string | null>(null)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)

  // Chargement des préférences + application du filtre par défaut (une fois).
  useEffect(() => {
    const views = loadViews()
    const def = loadDefaultId()
    setSavedViews(views)
    setDefaultId(def)
    const d = views.find((v) => v.id === def)
    if (d) { setViewMode(d.viewMode); setFilter(d.filter); setAppliedId(d.id) }
  }, [])

  const allLabels = useMemo(() => {
    const set = new Set<string>()
    for (const e of events) for (const m of e.meetings) set.add(m.label || NO_LABEL)
    return [...set].sort()
  }, [events])

  function meetingVisible(eventId: string, m: MeetCalendarEvent['meetings'][number]): boolean {
    if (filter.eventIds && !filter.eventIds.includes(eventId)) return false
    if (filter.statuses && !filter.statuses.includes(m.status)) return false
    if (filter.labels && !filter.labels.includes(m.label || NO_LABEL)) return false
    return true
  }

  const byDay = useMemo(() => {
    const map = new Map<string, Placed[]>()
    for (const ev of events) {
      for (const m of ev.meetings) {
        if (!meetingVisible(ev.id, m)) continue
        const key = dayKey(new Date(m.startAt))
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push({ eventId: ev.id, eventName: ev.name, color: ev.color, title: m.title, label: m.label, startAt: m.startAt, cancelled: m.status === 'CANCELLED' })
      }
    }
    for (const list of map.values()) list.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, filter])

  const todayKey = dayKey(new Date())

  // Navigation adaptée au mode.
  function shift(dir: number) {
    if (viewMode === 'month') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1))
    else if (viewMode === 'day') setAnchor(addDays(anchor, dir))
    else setAnchor(addDays(anchor, dir * 7))
  }

  // Colonnes pour les vues jour / semaine.
  const columnDays = useMemo(() => {
    if (viewMode === 'day') return [new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())]
    if (viewMode === 'week') return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i))
    if (viewMode === 'workweek') return Array.from({ length: 5 }, (_, i) => addDays(startOfWeek(anchor), i))
    return []
  }, [viewMode, anchor])

  const monthCells = useMemo(() => {
    if (viewMode !== 'month') return []
    const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const gridStart = addDays(monthStart, -mondayOffset(monthStart))
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  }, [viewMode, anchor])

  const rangeLabel = useMemo(() => {
    if (viewMode === 'month') return anchor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    if (viewMode === 'day') return anchor.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const days = columnDays
    const a = days[0], b = days[days.length - 1]
    if (!a || !b) return ''
    return `${a.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${b.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }, [viewMode, anchor, columnDays])

  // ── Gestion des filtres enregistrés ──
  function applyView(v: SavedView) { setViewMode(v.viewMode); setFilter(v.filter); setAppliedId(v.id); setSavedOpen(false) }
  function saveCurrent() {
    const name = prompt('Nom du filtre enregistré :', '')
    if (!name?.trim()) return
    const v: SavedView = { id: `${Date.now()}`, name: name.trim(), viewMode, filter }
    const next = [...savedViews, v]
    setSavedViews(next); persistViews(next); setAppliedId(v.id)
  }
  function deleteView(id: string) {
    const next = savedViews.filter((v) => v.id !== id)
    setSavedViews(next); persistViews(next)
    if (defaultId === id) { setDefaultId(null); persistDefaultId(null) }
    if (appliedId === id) setAppliedId(null)
  }
  function toggleDefault(id: string) {
    const next = defaultId === id ? null : id
    setDefaultId(next); persistDefaultId(next)
  }

  const activeFilterCount = (filter.eventIds ? 1 : 0) + (filter.statuses ? 1 : 0) + (filter.labels ? 1 : 0)

  function renderChips(items: Placed[], max: number) {
    return (
      <>
        {items.slice(0, max).map((it, j) => {
          const time = new Date(it.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          return (
            <div key={j} title={`${it.eventName} — ${it.title}${it.label ? ` [${it.label}]` : ''} (${time})`}
              className={`text-[10px] leading-tight rounded px-1 py-0.5 truncate ${it.cancelled ? 'line-through opacity-60' : ''}`}
              style={{ background: it.color, color: '#fff' }}>
              {time} {it.title}
            </div>
          )
        })}
        {items.length > max && <div className="text-[10px] text-gray-400 pl-1">+{items.length - max}</div>}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/meetops" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">← MeetOps</Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mt-2">📆 Calendrier global</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Toutes tes réunions, filtrables et superposées.</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Chargement…</p>
      ) : (
        <>
          {/* Barre d'outils */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Modes d'affichage */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${viewMode === v ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <button onClick={() => shift(-1)} className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" title="Précédent">‹</button>
              <button onClick={() => setAnchor(new Date())} className="px-2 h-8 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Aujourd&apos;hui</button>
              <button onClick={() => shift(1)} className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" title="Suivant">›</button>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{rangeLabel}</span>

            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setPickerOpen(true)}
                className="text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-3 py-1.5">
                Événements{filter.eventIds ? ` (${filter.eventIds.length})` : ''}
              </button>

              <div className="relative">
                <button onClick={() => setFilterOpen((o) => !o)}
                  className={`text-sm font-medium border rounded-lg px-3 py-1.5 ${activeFilterCount ? 'border-primary-400 text-primary-600' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  Filtres{activeFilterCount ? ` (${activeFilterCount})` : ''}
                </button>
                {filterOpen && <FilterPanel allLabels={allLabels} filter={filter} onChange={setFilter} onClose={() => setFilterOpen(false)} />}
              </div>

              <div className="relative">
                <button onClick={() => setSavedOpen((o) => !o)}
                  className="text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-3 py-1.5">
                  ★ Vues
                </button>
                {savedOpen && (
                  <div className="absolute right-0 top-full mt-2 z-40 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Filtres enregistrés</h4>
                    </div>
                    {savedViews.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">Aucun filtre enregistré.</p>
                    ) : (
                      <ul className="flex flex-col gap-0.5 max-h-60 overflow-y-auto">
                        {savedViews.map((v) => (
                          <li key={v.id} className={`flex items-center gap-1 rounded-lg px-2 py-1.5 ${appliedId === v.id ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                            <button onClick={() => applyView(v)} className="flex-1 text-left text-sm text-gray-700 dark:text-gray-200 truncate">
                              {v.name} <span className="text-xs text-gray-400">· {VIEW_LABELS[v.viewMode]}</span>
                            </button>
                            <button onClick={() => toggleDefault(v.id)} title={defaultId === v.id ? 'Filtre par défaut' : 'Définir par défaut'}
                              className={`px-1 ${defaultId === v.id ? 'text-amber-400' : 'text-gray-300 hover:text-amber-400'}`}>★</button>
                            <button onClick={() => deleteView(v.id)} title="Supprimer" className="px-1 text-gray-300 hover:text-red-500">✕</button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button onClick={saveCurrent} className="mt-2 w-full text-sm font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-gray-800 py-1.5 rounded-lg">
                      💾 Enregistrer la vue actuelle
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Légende événements */}
          <div className="flex flex-wrap gap-3">
            {events.filter((e) => !filter.eventIds || filter.eventIds.includes(e.id)).map((e) => (
              <div key={e.id} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: e.color }} />
                {e.name}
              </div>
            ))}
          </div>

          {/* Vue Mois */}
          {viewMode === 'month' && (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
              <div className="grid grid-cols-7 gap-px mb-px">
                {WEEKDAY_HEADERS.map((d) => (
                  <div key={d} className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wide py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                {monthCells.map((d, i) => {
                  const inMonth = d.getMonth() === anchor.getMonth()
                  const key = dayKey(d)
                  const items = byDay.get(key) ?? []
                  return (
                    <div key={i} className={`min-h-[84px] p-1.5 bg-white dark:bg-gray-900 ${inMonth ? '' : 'opacity-40'}`}>
                      <div className={`text-[11px] mb-1 ${key === todayKey ? 'font-bold text-primary-600' : 'text-gray-400'}`}>{d.getDate()}</div>
                      <div className="flex flex-col gap-0.5">{renderChips(items, 3)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Vues Jour / Semaine / Semaine travail (colonnes par jour) */}
          {viewMode !== 'month' && (
            <div className={`grid gap-2 ${viewMode === 'day' ? 'grid-cols-1' : viewMode === 'workweek' ? 'grid-cols-5' : 'grid-cols-7'}`}>
              {columnDays.map((d, i) => {
                const key = dayKey(d)
                const items = byDay.get(key) ?? []
                return (
                  <div key={i} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-3 min-h-[16rem]">
                    <div className={`text-center pb-2 mb-2 border-b border-gray-100 dark:border-gray-800 ${key === todayKey ? 'text-primary-600' : 'text-gray-500 dark:text-gray-400'}`}>
                      <div className="text-[11px] uppercase tracking-wide">{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                      <div className={`text-lg ${key === todayKey ? 'font-bold' : 'font-semibold'}`}>{d.getDate()}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {items.length === 0
                        ? <p className="text-xs text-gray-300 dark:text-gray-600 text-center py-2">—</p>
                        : items.map((it, j) => {
                          const time = new Date(it.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                          return (
                            <div key={j} title={`${it.eventName}${it.label ? ` [${it.label}]` : ''}`}
                              className={`rounded-lg px-2 py-1.5 text-xs ${it.cancelled ? 'line-through opacity-60' : ''}`}
                              style={{ background: it.color, color: '#fff' }}>
                              <div className="font-semibold">{time}</div>
                              <div className="truncate">{it.title}</div>
                              <div className="truncate opacity-80 text-[10px]">{it.eventName}</div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {pickerOpen && (
        <EventPickerModal events={events} selected={filter.eventIds}
          onApply={(ids) => setFilter((f) => ({ ...f, eventIds: ids }))} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  )
}
