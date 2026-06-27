'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMeetCalendar } from '@/hooks/useMeetops'
import { MEETING_STATUS_LABELS } from '@/lib/meetops'
import type { MeetCalendarEvent, MeetingStatus } from '@/lib/meetops'

// ── Types & constantes ──────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week' | 'workweek' | 'day' | 'agenda'
const VIEW_LABELS: Record<ViewMode, string> = {
  month: 'Mois', week: 'Semaine', workweek: 'Sem. travail', day: 'Jour', agenda: 'Agenda',
}
const STATUSES: MeetingStatus[] = ['DRAFT', 'SENT', 'UPDATED', 'CANCELLED']
const NO_LABEL = '—'

interface CalFilter { eventIds: string[] | null; statuses: MeetingStatus[] | null; labels: string[] | null }
interface SavedView { id: string; name: string; viewMode: ViewMode; filter: CalFilter }

const EMPTY_FILTER: CalFilter = { eventIds: null, statuses: null, labels: null }
const WEEKDAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const WORK_START = 9
const WORK_END = 18
const PX_PER_MIN_BASE = 40 / 60 // 40px par heure, densité constante

interface CalRange {
  hourStart: number
  hourEnd: number
  totalMin: number
  gridHeight: number
  pxPerMin: number
  hours: number[]
}
function makeRange(compact: boolean): CalRange {
  const hourStart = compact ? 8 : 0
  const hourEnd = compact ? 20 : 24
  const totalMin = (hourEnd - hourStart) * 60
  return {
    hourStart, hourEnd, totalMin,
    gridHeight: Math.round(totalMin * PX_PER_MIN_BASE),
    pxPerMin: PX_PER_MIN_BASE,
    hours: Array.from({ length: hourEnd - hourStart }, (_, i) => hourStart + i),
  }
}

// ── Utilitaires ──────────────────────────────────────────────────────────────────

function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function mondayOffset(d: Date): number { return (d.getDay() + 6) % 7 }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function startOfWeek(d: Date): Date { return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -mondayOffset(d)) }

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

function timeToTop(startAt: string, hourStart: number, pxPerMin: number): number {
  const d = new Date(startAt)
  return Math.max(0, ((d.getHours() - hourStart) * 60 + d.getMinutes()) * pxPerMin)
}

const LS_VIEWS = 'meetops_cal_views'
const LS_DEFAULT = 'meetops_cal_default'
function loadViews(): SavedView[] { try { return JSON.parse(localStorage.getItem(LS_VIEWS) || '[]') } catch { return [] } }
function persistViews(v: SavedView[]) { localStorage.setItem(LS_VIEWS, JSON.stringify(v)) }
function loadDefaultId(): string | null { try { return localStorage.getItem(LS_DEFAULT) } catch { return null } }
function persistDefaultId(id: string | null) { if (id) localStorage.setItem(LS_DEFAULT, id); else localStorage.removeItem(LS_DEFAULT) }

// ── Type Meeting enrichi ─────────────────────────────────────────────────────────

interface Placed {
  id: string
  eventId: string
  eventName: string
  color: string
  title: string
  label: string | null
  startAt: string
  durationMin: number
  cancelled: boolean
}

interface PlacedLayout extends Placed { col: number; totalCols: number }

// ── Algorithme de layout anti-chevauchement ───────────────────────────────────────

function layoutItems(items: Placed[]): PlacedLayout[] {
  if (!items.length) return []
  const sorted = [...items].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))
  const cols: number[] = new Array(sorted.length).fill(0)
  for (let i = 0; i < sorted.length; i++) {
    const si = +new Date(sorted[i].startAt)
    const ei = si + sorted[i].durationMin * 60_000
    const used = new Set<number>()
    for (let j = 0; j < i; j++) {
      const sj = +new Date(sorted[j].startAt); const ej = sj + sorted[j].durationMin * 60_000
      if (sj < ei && ej > si) used.add(cols[j])
    }
    let c = 0; while (used.has(c)) c++; cols[i] = c
  }
  return sorted.map((item, i) => {
    const si = +new Date(item.startAt); const ei = si + item.durationMin * 60_000
    let max = cols[i]
    for (let j = 0; j < sorted.length; j++) {
      if (j === i) continue
      const sj = +new Date(sorted[j].startAt); const ej = sj + sorted[j].durationMin * 60_000
      if (sj < ei && ej > si) max = Math.max(max, cols[j])
    }
    return { ...item, col: cols[i], totalCols: max + 1 }
  })
}

// ── Popup survol meeting ─────────────────────────────────────────────────────────

interface PopupState { item: Placed; x: number; y: number }

function MeetingPopup({ popup, onClose, onNavigate, onMouseEnter, onMouseLeave }: {
  popup: PopupState
  onClose: () => void
  onNavigate: (eventId: string) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const start = new Date(popup.item.startAt)
  const end = new Date(+start + popup.item.durationMin * 60_000)
  const fmt = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const x = typeof window !== 'undefined' ? Math.min(popup.x + 10, window.innerWidth - 264) : popup.x
  const y = typeof window !== 'undefined' ? Math.min(popup.y - 20, window.innerHeight - 210) : popup.y
  return (
    <div className="fixed z-[100] w-60 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3"
      style={{ left: x, top: y }}
      onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
      onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start gap-2 mb-2">
        <span className="w-2.5 h-2.5 rounded-sm mt-0.5 shrink-0" style={{ background: popup.item.color }} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 dark:text-white leading-tight truncate">{popup.item.title}</div>
          <div className="text-xs text-gray-400 truncate">{popup.item.eventName}</div>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 shrink-0 ml-1 p-0.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">
        {fmt(start)} – {fmt(end)}<span className="text-gray-400 ml-1.5">· {popup.item.durationMin} min</span>
      </div>
      {popup.item.label && <span className="inline-block text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full mb-2">{popup.item.label}</span>}
      {popup.item.cancelled && <div className="text-xs text-red-500 mb-2">Annulée</div>}
      <button onClick={() => { onNavigate(popup.item.eventId); onClose() }}
        className="w-full text-xs font-medium py-1.5 bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-950/50 rounded-lg transition-colors">
        Ouvrir l&apos;événement →
      </button>
    </div>
  )
}

// ── Popup création rapide (clic sur créneau vide) ────────────────────────────────

interface QuickCreateState { date: Date; x: number; y: number }

const NEW_EVENT_ID = '__new__'
const NO_EVENT_ID = '__none__'
const SANS_EVENEMENT_NAME = 'Sans événement'

function QuickCreatePopup({ state, events, onSave, onClose }: {
  state: QuickCreateState
  events: MeetCalendarEvent[]
  onSave: (eventId: string | null, newEventName: string | null, title: string, startAt: Date) => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle] = useState('Nouvelle réunion')
  const [eventId, setEventId] = useState(events[0]?.id ?? NO_EVENT_ID)
  const [newEventName, setNewEventName] = useState('')
  const [saving, setSaving] = useState(false)
  const isNew = eventId === NEW_EVENT_ID
  const isNone = eventId === NO_EVENT_ID
  const x = typeof window !== 'undefined' ? Math.min(state.x + 10, window.innerWidth - 280) : state.x
  const y = typeof window !== 'undefined' ? Math.min(state.y - 20, window.innerHeight - 200) : state.y
  const dateLabel = state.date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  const timeLabel = state.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  const canSubmit = title.trim() && (isNew ? newEventName.trim() : true)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    try {
      const resolvedEventId = isNone || isNew ? null : eventId
      const resolvedName = isNone ? SANS_EVENEMENT_NAME : isNew ? newEventName.trim() : null
      await onSave(resolvedEventId, resolvedName, title.trim(), state.date)
      onClose()
    } catch (err) { alert((err as Error).message); setSaving(false) }
  }

  return (
    <div className="fixed z-[100] w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">{dateLabel} · {timeLabel}</span>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 p-0.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de la réunion"
          className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}
          className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400">
          <option value={NO_EVENT_ID}>Sans événement</option>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          <option value={NEW_EVENT_ID}>+ Nouvel événement…</option>
        </select>
        {isNew && (
          <input autoFocus value={newEventName} onChange={(e) => setNewEventName(e.target.value)}
            placeholder="Nom du nouvel événement"
            className="w-full border border-primary-300 dark:border-primary-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400" />
        )}
        <div className="flex justify-end gap-1.5 mt-1">
          <button type="button" onClick={onClose} className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Annuler</button>
          <button type="submit" disabled={saving || !canSubmit}
            className="px-3 py-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg">
            {saving ? '…' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Menu clic-droit ───────────────────────────────────────────────────────────────

interface ContextMenuState { item: Placed; x: number; y: number }

function ContextMenu({ menu, onNavigate, onDuplicate, onDelete, onClose }: {
  menu: ContextMenuState
  onNavigate: (eventId: string) => void
  onDuplicate: (item: Placed) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  useEffect(() => {
    const close = () => onClose()
    window.addEventListener('click', close, { once: true })
    return () => window.removeEventListener('click', close)
  }, [onClose])

  const x = typeof window !== 'undefined' ? Math.min(menu.x, window.innerWidth - 200) : menu.x
  const y = typeof window !== 'undefined' ? Math.min(menu.y, window.innerHeight - 130) : menu.y

  return (
    <div className="fixed z-[101] w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}>
      <button onClick={() => { onNavigate(menu.item.eventId); onClose() }}
        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
        Ouvrir l&apos;événement
      </button>
      <button onClick={() => { onDuplicate(menu.item); onClose() }}
        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
        Dupliquer (+30 min)
      </button>
      <hr className="my-1 border-gray-100 dark:border-gray-800" />
      <button onClick={() => { if (confirm(`Supprimer « ${menu.item.title} » ?`)) { onDelete(menu.item.id); onClose() } }}
        className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
        Supprimer
      </button>
    </div>
  )
}

// ── Modales auxiliaires ──────────────────────────────────────────────────────────

function EventPickerModal({ events, selected, onApply, onClose }: {
  events: MeetCalendarEvent[]; selected: string[] | null
  onApply: (ids: string[] | null) => void; onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Set<string>>(() => new Set(selected ?? events.map((e) => e.id)))
  const filtered = events.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()))
  function toggle(id: string) { setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n }) }
  function apply() { onApply(picked.size === events.length ? null : [...picked]); onClose() }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Événements affichés</h3>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" /></svg>
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
        </ul>
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 shrink-0 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">Annuler</button>
          <button onClick={apply} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl">Appliquer</button>
        </div>
      </div>
    </div>
  )
}

function FilterPanel({ allLabels, filter, onChange, onClose }: {
  allLabels: string[]; filter: CalFilter
  onChange: (f: CalFilter) => void; onClose: () => void
}) {
  function toggleStatus(s: MeetingStatus) {
    const cur = filter.statuses ?? STATUSES
    const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]
    onChange({ ...filter, statuses: next.length === STATUSES.length ? null : next })
  }
  function toggleLabel(l: string) {
    const all = allLabels; const cur = filter.labels ?? all
    const next = cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]
    onChange({ ...filter, labels: next.length === all.length ? null : next })
  }
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
            <input type="checkbox" checked={!filter.statuses || filter.statuses.includes(s)} onChange={() => toggleStatus(s)} className="accent-primary-600" />
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
                <input type="checkbox" checked={!filter.labels || filter.labels.includes(l)} onChange={() => toggleLabel(l)} className="accent-primary-600" />
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

// ── Grille horaire ────────────────────────────────────────────────────────────────

interface TimeGridHandlers {
  now: Date
  nowKey: string
  selectedId: string | null
  resizePreview: { id: string; duration: number } | null
  onMeetingEnter: (item: Placed, e: React.MouseEvent) => void
  onMeetingLeave: () => void
  onMeetingClick: (id: string) => void
  onMeetingDrop: (meetingId: string, newStartAt: Date) => void
  onMeetingContextMenu: (item: Placed, e: React.MouseEvent) => void
  onSlotClick: (date: Date, pos: { x: number; y: number }) => void
  onResizeStart: (id: string, startY: number, origDuration: number) => void
}

function TimeGrid({ columnDays, byDay, todayKey, viewMode, calRange, handlers }: {
  columnDays: Date[]
  byDay: Map<string, Placed[]>
  todayKey: string
  viewMode: ViewMode
  calRange: CalRange
  handlers: TimeGridHandlers
}) {
  const { hourStart, hourEnd, totalMin, gridHeight, pxPerMin, hours } = calRange
  const gridCols = viewMode === 'day' ? 'grid-cols-1' : viewMode === 'workweek' ? 'grid-cols-5' : 'grid-cols-7'
  const [dropInfo, setDropInfo] = useState<{ key: string; top: number } | null>(null)

  const { now, nowKey, selectedId, resizePreview, onMeetingEnter, onMeetingLeave, onMeetingClick,
    onMeetingDrop, onMeetingContextMenu, onSlotClick, onResizeStart } = handlers

  const nowTop = timeToTop(now.toISOString(), hourStart, pxPerMin)

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, d: Date) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const y = Math.max(0, e.clientY - rect.top)
    const snapped = Math.min(Math.round((y / gridHeight * totalMin) / 15) * 15, totalMin - 15)
    setDropInfo({ key: dayKey(d), top: (snapped / totalMin) * gridHeight })
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, d: Date) {
    e.preventDefault()
    setDropInfo(null)
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain')) as { id: string; offsetY: number }
      const rect = e.currentTarget.getBoundingClientRect()
      const y = Math.max(0, e.clientY - rect.top - data.offsetY)
      const snapped = Math.max(0, Math.min(totalMin - 30, Math.round((y / gridHeight * totalMin) / 15) * 15))
      const minuteOfDay = hourStart * 60 + snapped
      onMeetingDrop(data.id, new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0))
    } catch { /* drag data invalide */ }
  }

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, d: Date) {
    if ((e.target as HTMLElement).closest('[data-meeting]')) return
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const y = Math.max(0, e.clientY - rect.top)
    const snapped = Math.max(0, Math.min(totalMin - 30, Math.round((y / gridHeight * totalMin) / 15) * 15))
    const minuteOfDay = hourStart * 60 + snapped
    onSlotClick(new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0), { x: e.clientX, y: e.clientY })
  }

  // Bannière all-day : réunions hors de la plage visible
  const allDayByDay = useMemo(() => {
    const map = new Map<string, Placed[]>()
    for (const [key, items] of byDay.entries()) {
      const ad = items.filter((it) => { const h = new Date(it.startAt).getHours(); return h < hourStart || h >= hourEnd })
      if (ad.length) map.set(key, ad)
    }
    return map
  }, [byDay, hourStart, hourEnd])

  const hasAllDay = columnDays.some((d) => (allDayByDay.get(dayKey(d)) ?? []).length > 0)

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
      {/* En-têtes jours */}
      <div className={`grid ${gridCols} border-b border-gray-100 dark:border-gray-800 ml-10`}>
        {columnDays.map((d, i) => {
          const key = dayKey(d)
          const isToday = key === todayKey
          return (
            <div key={i} className={`text-center py-2 border-l border-gray-100 dark:border-gray-800 ${isToday ? 'text-primary-600' : 'text-gray-500 dark:text-gray-400'}`}>
              <div className="text-[11px] uppercase tracking-wide">{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
              <div className={`text-base ${isToday ? 'font-bold' : 'font-semibold'}`}>{d.getDate()}</div>
            </div>
          )
        })}
      </div>

      {/* Bannière all-day (réunions hors plage horaire) */}
      {hasAllDay && (
        <div className={`grid ${gridCols} border-b border-gray-100 dark:border-gray-800 ml-10`}>
          {columnDays.map((d, i) => {
            const key = dayKey(d)
            const items = allDayByDay.get(key) ?? []
            return (
              <div key={i} className="border-l border-gray-100 dark:border-gray-800 p-0.5 min-h-[24px]">
                {items.map((it, j) => (
                  <div key={j}
                    className="text-[10px] rounded px-1 truncate text-white mb-0.5 cursor-pointer"
                    style={{ background: it.color }}
                    onMouseEnter={(e) => onMeetingEnter(it, e)}
                    onMouseLeave={onMeetingLeave}
                    onClick={(e) => { e.stopPropagation(); onMeetingClick(it.id) }}>
                    {it.title}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Corps */}
      <div className="flex">
        {/* Étiquettes heures */}
        <div className="w-10 shrink-0 relative select-none" style={{ height: gridHeight }}>
          {hours.map((h) => (
            <div key={h} className="absolute w-full text-right pr-2 text-[10px] text-gray-400 -translate-y-2"
              style={{ top: (h - hourStart) * 60 * pxPerMin }}>{h}h</div>
          ))}
        </div>

        {/* Colonnes jours */}
        <div className={`flex-1 grid ${gridCols}`}>
          {columnDays.map((d, i) => {
            const key = dayKey(d)
            const items = byDay.get(key) ?? []
            const visible = items.filter((it) => { const h = new Date(it.startAt).getHours(); return h >= hourStart && h < hourEnd })
            const laid = layoutItems(visible)
            const isToday = key === todayKey

            return (
              <div key={i}
                className="relative border-l border-gray-100 dark:border-gray-800 cursor-crosshair overflow-hidden"
                style={{ height: gridHeight }}
                onClick={(e) => handleColumnClick(e, d)}
                onDragOver={(e) => handleDragOver(e, d)}
                onDragLeave={() => setDropInfo(null)}
                onDrop={(e) => handleDrop(e, d)}>

                {/* Hors-horaires (avant 9h / après 18h) */}
                <div className="absolute left-0 right-0 bg-gray-50/70 dark:bg-gray-800/30 pointer-events-none"
                  style={{ top: 0, height: Math.max(0, WORK_START - hourStart) * 60 * pxPerMin }} />
                <div className="absolute left-0 right-0 bg-gray-50/70 dark:bg-gray-800/30 pointer-events-none"
                  style={{ top: (WORK_END - hourStart) * 60 * pxPerMin, height: Math.max(0, hourEnd - WORK_END) * 60 * pxPerMin }} />

                {/* Lignes heures + demi-heures */}
                {hours.map((h) => (
                  <div key={h} className="absolute w-full border-t border-gray-100 dark:border-gray-800"
                    style={{ top: (h - hourStart) * 60 * pxPerMin }} />
                ))}
                {hours.slice(0, -1).map((h) => (
                  <div key={`${h}.5`} className="absolute w-full border-t border-gray-50 dark:border-gray-800/50"
                    style={{ top: (h - hourStart + 0.5) * 60 * pxPerMin }} />
                ))}

                {/* Heure courante */}
                {isToday && nowTop >= 0 && nowTop <= gridHeight && (
                  <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                    style={{ top: nowTop, transform: 'translateY(-50%)' }}>
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]" />
                    <div className="flex-1 h-[1.5px] bg-red-500" />
                  </div>
                )}

                {/* Indicateur de drop */}
                {dropInfo?.key === key && (
                  <div className="absolute left-0 right-0 h-0.5 bg-primary-400 z-10 pointer-events-none" style={{ top: dropInfo.top }}>
                    <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-primary-400" />
                  </div>
                )}

                {/* Meetings */}
                {laid.map((it, j) => {
                  const effectiveDuration = resizePreview?.id === it.id ? resizePreview.duration : it.durationMin
                  const top = timeToTop(it.startAt, hourStart, pxPerMin)
                  const height = Math.max(18, effectiveDuration * pxPerMin - 2)
                  const time = new Date(it.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  const colW = 100 / it.totalCols
                  const GAP = 1.5
                  return (
                    <div key={j} data-meeting="true"
                      draggable
                      onDragStart={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        e.dataTransfer.setData('text/plain', JSON.stringify({ id: it.id, offsetY: e.clientY - rect.top }))
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onMouseEnter={(e) => onMeetingEnter(it, e)}
                      onMouseLeave={onMeetingLeave}
                      onClick={(e) => { e.stopPropagation(); onMeetingClick(it.id) }}
                      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onMeetingContextMenu(it, e) }}
                      className={[
                        'absolute rounded px-1 overflow-hidden text-white text-[10px]',
                        'cursor-pointer select-none transition-[filter,outline]',
                        it.cancelled ? 'opacity-50 line-through' : 'hover:brightness-90',
                        selectedId === it.id ? 'outline outline-2 outline-white outline-offset-1' : '',
                      ].join(' ')}
                      style={{ top, height, left: `${it.col * colW + GAP}%`, width: `${colW - GAP * 2}%`, background: it.color }}>
                      <div className="font-semibold leading-tight truncate">{time}</div>
                      {height > 28 && <div className="truncate leading-tight opacity-90">{it.title}</div>}
                      {/* Handle de resize */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-white/30 transition-colors"
                        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onResizeStart(it.id, e.clientY, effectiveDuration) }}
                        onDragStart={(e) => e.preventDefault()}
                        data-meeting="true"
                      />
                    </div>
                  )
                })}

                {visible.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-200 dark:text-gray-700 pointer-events-none">—</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────────

export default function MeetopsCalendarPage() {
  const { events, isLoading, createEvent, updateMeeting, createMeeting, deleteMeeting } = useMeetCalendar()
  const router = useRouter()

  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const [compactHours, setCompactHours] = useState(false)
  const calRange = useMemo(() => makeRange(compactHours), [compactHours])
  const [filter, setFilter] = useState<CalFilter>(EMPTY_FILTER)
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [defaultId, setDefaultId] = useState<string | null>(null)
  const [appliedId, setAppliedId] = useState<string | null>(null)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [popup, setPopup] = useState<PopupState | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [quickCreate, setQuickCreate] = useState<QuickCreateState | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [now, setNow] = useState(() => new Date())
  const nowKey = dayKey(now)

  // Refs stables pour les raccourcis clavier
  const viewModeRef = useRef(viewMode)
  viewModeRef.current = viewMode
  const anchorRef = useRef(anchor)
  anchorRef.current = anchor

  // Hover popup timer
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function showPopup(item: Placed, e: React.MouseEvent) {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setPopup({ item, x: e.clientX, y: e.clientY })
  }
  function scheduleHide() { hideTimerRef.current = setTimeout(() => setPopup(null), 200) }
  function cancelHide() { if (hideTimerRef.current) clearTimeout(hideTimerRef.current) }

  // Resize
  const resizeRef = useRef<{ id: string; startY: number; origDuration: number } | null>(null)
  const [resizePreview, setResizePreview] = useState<{ id: string; duration: number } | null>(null)

  function handleResizeStart(id: string, startY: number, origDuration: number) {
    resizeRef.current = { id, startY, origDuration }
    function onMove(e: MouseEvent) {
      if (!resizeRef.current) return
      const dy = e.clientY - resizeRef.current.startY
      const deltaMins = Math.round((dy / calRange.pxPerMin) / 15) * 15
      setResizePreview({ id: resizeRef.current.id, duration: Math.max(15, resizeRef.current.origDuration + deltaMins) })
    }
    async function onUp(e: MouseEvent) {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (!resizeRef.current) return
      const dy = e.clientY - resizeRef.current.startY
      const deltaMins = Math.round((dy / calRange.pxPerMin) / 15) * 15
      const newDuration = Math.max(15, resizeRef.current.origDuration + deltaMins)
      const { id, origDuration } = resizeRef.current
      resizeRef.current = null
      setResizePreview(null)
      if (newDuration !== origDuration) {
        try { await updateMeeting(id, { durationMin: newDuration }) } catch (err) { alert((err as Error).message) }
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Heure courante (toutes les minutes)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Préférences sauvegardées
  useEffect(() => {
    const views = loadViews(); const def = loadDefaultId()
    setSavedViews(views); setDefaultId(def)
    const d = views.find((v) => v.id === def)
    if (d) { setViewMode(d.viewMode); setFilter(d.filter); setAppliedId(d.id) }
  }, [])

  // Raccourcis clavier
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      const mode = viewModeRef.current; const anch = anchorRef.current
      if (e.key === 'ArrowLeft') {
        if (mode === 'month') setAnchor(new Date(anch.getFullYear(), anch.getMonth() - 1, 1))
        else if (mode === 'day') setAnchor(addDays(anch, -1))
        else if (mode !== 'agenda') setAnchor(addDays(anch, -7))
      } else if (e.key === 'ArrowRight') {
        if (mode === 'month') setAnchor(new Date(anch.getFullYear(), anch.getMonth() + 1, 1))
        else if (mode === 'day') setAnchor(addDays(anch, 1))
        else if (mode !== 'agenda') setAnchor(addDays(anch, 7))
      } else if (e.key === 't' || e.key === 'h') { setAnchor(new Date()) }
      else if (e.key === '1') setViewMode('month')
      else if (e.key === '2') setViewMode('week')
      else if (e.key === '3') setViewMode('workweek')
      else if (e.key === '4') setViewMode('day')
      else if (e.key === '5') setViewMode('agenda')
      else if (e.key === 'Escape') { setSelectedId(null); setPopup(null); setContextMenu(null); setQuickCreate(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const allLabels = useMemo(() => {
    const set = new Set<string>()
    for (const e of events) for (const m of e.meetings) set.add(m.label || NO_LABEL)
    return [...set].sort()
  }, [events])

  function meetingVisible(eventId: string, m: MeetCalendarEvent['meetings'][number], evName: string): boolean {
    if (filter.eventIds && !filter.eventIds.includes(eventId)) return false
    if (filter.statuses && !filter.statuses.includes(m.status)) return false
    if (filter.labels && !filter.labels.includes(m.label || NO_LABEL)) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      if (!m.title.toLowerCase().includes(q) && !evName.toLowerCase().includes(q)) return false
    }
    return true
  }

  const byDay = useMemo(() => {
    const map = new Map<string, Placed[]>()
    for (const ev of events) {
      for (const m of ev.meetings) {
        if (!meetingVisible(ev.id, m, ev.name)) continue
        const key = dayKey(new Date(m.startAt))
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push({
          id: m.id, eventId: ev.id, eventName: ev.name, color: ev.color,
          title: m.title, label: m.label, startAt: m.startAt,
          durationMin: m.durationMin, cancelled: m.status === 'CANCELLED',
        })
      }
    }
    for (const list of map.values()) list.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, filter, searchQuery])

  const todayKey = dayKey(new Date())

  function shift(dir: number) {
    if (viewMode === 'month') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1))
    else if (viewMode === 'day') setAnchor(addDays(anchor, dir))
    else setAnchor(addDays(anchor, dir * 7))
  }

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
    if (viewMode === 'agenda') return 'Toutes les réunions'
    const days = columnDays; const a = days[0], b = days[days.length - 1]
    if (!a || !b) return ''
    const week = getISOWeek(a)
    return `${a.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${b.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} · Sem. ${week}`
  }, [viewMode, anchor, columnDays])

  function applyView(v: SavedView) { setViewMode(v.viewMode); setFilter(v.filter); setAppliedId(v.id); setSavedOpen(false) }
  function saveCurrent() {
    const name = prompt('Nom du filtre enregistré :', ''); if (!name?.trim()) return
    const v: SavedView = { id: `${Date.now()}`, name: name.trim(), viewMode, filter }
    const next = [...savedViews, v]; setSavedViews(next); persistViews(next); setAppliedId(v.id)
  }
  function deleteView(id: string) {
    const next = savedViews.filter((v) => v.id !== id); setSavedViews(next); persistViews(next)
    if (defaultId === id) { setDefaultId(null); persistDefaultId(null) }
    if (appliedId === id) setAppliedId(null)
  }
  function toggleDefault(id: string) { const next = defaultId === id ? null : id; setDefaultId(next); persistDefaultId(next) }

  const activeFilterCount = (filter.eventIds ? 1 : 0) + (filter.statuses ? 1 : 0) + (filter.labels ? 1 : 0)
  const visibleEvents = events.filter((e) => !filter.eventIds || filter.eventIds.includes(e.id))

  async function handleSlotClick(date: Date, pos: { x: number; y: number }) {
    if (events.length === 0) return
    setQuickCreate({ date, x: pos.x, y: pos.y })
  }

  async function handleMeetingDrop(meetingId: string, newStartAt: Date) {
    try { await updateMeeting(meetingId, { startAt: newStartAt.toISOString() }) }
    catch (err) { alert((err as Error).message) }
  }

  async function handleQuickSave(eventId: string | null, newEventName: string | null, title: string, startAt: Date) {
    let finalEventId = eventId
    if (!finalEventId && newEventName) {
      if (newEventName === SANS_EVENEMENT_NAME) {
        // Réutilise l'événement "Sans événement" s'il existe déjà
        finalEventId = events.find((e) => e.name === SANS_EVENEMENT_NAME)?.id
          ?? await createEvent({ name: SANS_EVENEMENT_NAME })
      } else {
        finalEventId = await createEvent({ name: newEventName })
      }
    }
    if (!finalEventId) return
    await createMeeting(finalEventId, { title, startAt: startAt.toISOString(), durationMin: 60 })
  }

  async function handleDuplicate(item: Placed) {
    const newStart = new Date(+new Date(item.startAt) + 30 * 60_000)
    try { await createMeeting(item.eventId, { title: `${item.title} (copie)`, startAt: newStart.toISOString(), durationMin: item.durationMin }) }
    catch (err) { alert((err as Error).message) }
  }

  async function handleDelete(meetingId: string) {
    try { await deleteMeeting(meetingId) }
    catch (err) { alert((err as Error).message) }
  }

  function renderChips(items: Placed[], max: number) {
    return (
      <>
        {items.slice(0, max).map((it, j) => {
          const time = new Date(it.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          return (
            <div key={j}
              className={[
                'text-[10px] leading-tight rounded px-1 py-0.5 truncate cursor-pointer',
                'hover:brightness-90 transition-[filter,outline]',
                it.cancelled ? 'line-through opacity-60' : '',
                selectedId === it.id ? 'outline outline-2 outline-white outline-offset-1' : '',
              ].join(' ')}
              style={{ background: it.color, color: '#fff' }}
              onMouseEnter={(e) => showPopup(it, e)} onMouseLeave={scheduleHide}
              onClick={(e) => { e.stopPropagation(); setSelectedId((p) => p === it.id ? null : it.id) }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ item: it, x: e.clientX, y: e.clientY }) }}>
              {time} {it.title}
            </div>
          )
        })}
        {items.length > max && <div className="text-[10px] text-gray-400 pl-1">+{items.length - max}</div>}
      </>
    )
  }

  // Vue Agenda : toutes les réunions triées chronologiquement
  const agendaItems = useMemo(() => {
    const all: (Placed & { date: Date })[] = []
    for (const [, items] of byDay.entries()) {
      for (const it of items) all.push({ ...it, date: new Date(it.startAt) })
    }
    return all.sort((a, b) => +a.date - +b.date)
  }, [byDay])

  const agendaByDay = useMemo(() => {
    const map = new Map<string, typeof agendaItems>()
    for (const m of agendaItems) {
      const key = dayKey(m.date)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(m)
    }
    return map
  }, [agendaItems])

  const timeGridHandlers: TimeGridHandlers = {
    now, nowKey, selectedId, resizePreview,
    onMeetingEnter: showPopup, onMeetingLeave: scheduleHide,
    onMeetingClick: (id) => setSelectedId((p) => p === id ? null : id),
    onMeetingDrop: handleMeetingDrop,
    onMeetingContextMenu: (item, e) => { e.preventDefault(); setContextMenu({ item, x: e.clientX, y: e.clientY }) },
    onSlotClick: handleSlotClick,
    onResizeStart: handleResizeStart,
  }

  return (
    <div className="flex flex-col gap-5" onClick={() => { setSelectedId(null); setQuickCreate(null); setFilterOpen(false); setSavedOpen(false) }}>
      <div>
        <Link href="/meetops" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>MeetOps
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mt-2">📆 Calendrier global</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Vue consolidée de toutes vos réunions MeetOps, tous événements confondus.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Chargement…</p>
      ) : (
        <>
          {/* Barre d'outils */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${viewMode === v ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => shift(-1)} className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30" disabled={viewMode === 'agenda'}>‹</button>
              <button onClick={() => setAnchor(new Date())} className="px-2 h-8 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Aujourd&apos;hui</button>
              <button onClick={() => shift(1)} className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30" disabled={viewMode === 'agenda'}>›</button>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{rangeLabel}</span>
            <div className="ml-auto flex items-center gap-2">
              {searchOpen ? (
                <div className="relative flex items-center gap-1">
                  <svg className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" /></svg>
                  <input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => { if (!searchQuery) setSearchOpen(false) }} placeholder="Rechercher…"
                    className="pl-9 pr-3 py-1.5 rounded-xl border border-primary-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 w-44 dark:bg-gray-900 dark:text-white dark:border-primary-700" />
                  <button onClick={() => { setSearchOpen(false); setSearchQuery('') }} className="text-gray-400 hover:text-gray-600 px-1">✕</button>
                </div>
              ) : (
                <button onClick={() => setSearchOpen(true)}
                  className={`text-sm font-medium border rounded-lg px-3 py-1.5 ${searchQuery ? 'border-primary-400 text-primary-600' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" /></svg>
                </button>
              )}
              {['week', 'workweek', 'day'].includes(viewMode) && (
                <button onClick={() => setCompactHours((c) => !c)}
                  title={compactHours ? 'Afficher la journée complète (0h–24h)' : 'Afficher uniquement les horaires de travail (8h–20h)'}
                  className={`text-sm font-medium border rounded-lg px-3 py-1.5 transition-colors ${
                    compactHours
                      ? 'border-primary-400 text-primary-600 dark:text-primary-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  {compactHours ? '8h–20h' : '0h–24h'}
                </button>
              )}
              <button onClick={() => setPickerOpen(true)}
                className="text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-3 py-1.5">
                Événements{filter.eventIds ? ` (${filter.eventIds.length})` : ''}
              </button>
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setFilterOpen((o) => !o)}
                  className={`text-sm font-medium border rounded-lg px-3 py-1.5 ${activeFilterCount ? 'border-primary-400 text-primary-600' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  Filtres{activeFilterCount ? ` (${activeFilterCount})` : ''}
                </button>
                {filterOpen && <FilterPanel allLabels={allLabels} filter={filter} onChange={setFilter} onClose={() => setFilterOpen(false)} />}
              </div>
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setSavedOpen((o) => !o)}
                  className="text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-3 py-1.5">★ Vues</button>
                {savedOpen && (
                  <div className="absolute right-0 top-full mt-2 z-40 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-3" onClick={(e) => e.stopPropagation()}>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Filtres enregistrés</h4>
                    {savedViews.length === 0 ? <p className="text-xs text-gray-400 py-2">Aucun filtre enregistré.</p> : (
                      <ul className="flex flex-col gap-0.5 max-h-60 overflow-y-auto">
                        {savedViews.map((v) => (
                          <li key={v.id} className={`flex items-center gap-1 rounded-lg px-2 py-1.5 ${appliedId === v.id ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                            <button onClick={() => applyView(v)} className="flex-1 text-left text-sm text-gray-700 dark:text-gray-200 truncate">
                              {v.name} <span className="text-xs text-gray-400">· {VIEW_LABELS[v.viewMode]}</span>
                            </button>
                            <button onClick={() => toggleDefault(v.id)} className={`px-1 ${defaultId === v.id ? 'text-amber-400' : 'text-gray-300 hover:text-amber-400'}`}>★</button>
                            <button onClick={() => deleteView(v.id)} className="px-1 text-gray-300 hover:text-red-500">✕</button>
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
            {visibleEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: e.color }} />{e.name}
              </div>
            ))}
          </div>

          {/* Vue Mois */}
          {viewMode === 'month' && (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
              <div className="grid grid-cols-7 gap-px mb-px">
                {WEEKDAY_HEADERS.map((d) => <div key={d} className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wide py-1">{d}</div>)}
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

          {/* Vues Semaine / Jour */}
          {(viewMode === 'week' || viewMode === 'workweek' || viewMode === 'day') && (
            <TimeGrid columnDays={columnDays} byDay={byDay} todayKey={todayKey} viewMode={viewMode} calRange={calRange} handlers={timeGridHandlers} />
          )}

          {/* Vue Agenda */}
          {viewMode === 'agenda' && (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl divide-y divide-gray-100 dark:divide-gray-800">
              {agendaItems.length === 0 ? (
                <div className="p-12 text-center text-sm text-gray-400">Aucune réunion à afficher.</div>
              ) : (
                [...agendaByDay.entries()].map(([key, items]) => {
                  const d = new Date(key + 'T12:00:00')
                  const isToday = key === todayKey
                  return (
                    <div key={key} className="flex gap-4 p-4">
                      <div className={`w-14 shrink-0 text-right ${isToday ? 'text-primary-600 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                        <div className="text-[11px] uppercase tracking-wide">{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                        <div className="text-xl font-semibold leading-tight">{d.getDate()}</div>
                        <div className="text-[11px]">{d.toLocaleDateString('fr-FR', { month: 'short' })}</div>
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        {items.map((it, j) => {
                          const start = new Date(it.startAt)
                          const end = new Date(+start + it.durationMin * 60_000)
                          const fmt = (x: Date) => x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                          return (
                            <div key={j}
                              className={[
                                'flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer',
                                'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                                it.cancelled ? 'opacity-50 line-through' : '',
                                selectedId === it.id ? 'ring-1 ring-primary-400' : '',
                              ].join(' ')}
                              onMouseEnter={(e) => showPopup(it, e)} onMouseLeave={scheduleHide}
                              onClick={(e) => { e.stopPropagation(); setSelectedId((p) => p === it.id ? null : it.id) }}
                              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ item: it, x: e.clientX, y: e.clientY }) }}>
                              <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: it.color }} />
                              <div className="text-xs text-gray-400 w-28 shrink-0">{fmt(start)} – {fmt(end)}</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate text-gray-900 dark:text-white">{it.title}</div>
                                <div className="text-xs text-gray-400 truncate">{it.eventName}{it.label ? ` · ${it.label}` : ''}</div>
                              </div>
                              <div className="text-xs text-gray-300 dark:text-gray-600 shrink-0">{it.durationMin} min</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </>
      )}

      {pickerOpen && (
        <EventPickerModal events={events} selected={filter.eventIds}
          onApply={(ids) => setFilter((f) => ({ ...f, eventIds: ids }))} onClose={() => setPickerOpen(false)} />
      )}

      {popup && (
        <MeetingPopup popup={popup} onClose={() => setPopup(null)}
          onNavigate={(id) => router.push(`/meetops/${id}`)}
          onMouseEnter={cancelHide} onMouseLeave={scheduleHide} />
      )}

      {quickCreate && (
        <QuickCreatePopup state={quickCreate} events={visibleEvents.length > 0 ? visibleEvents : events}
          onSave={handleQuickSave} onClose={() => setQuickCreate(null)} />
      )}

      {contextMenu && (
        <ContextMenu menu={contextMenu}
          onNavigate={(id) => router.push(`/meetops/${id}`)}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onClose={() => setContextMenu(null)} />
      )}
    </div>
  )
}
