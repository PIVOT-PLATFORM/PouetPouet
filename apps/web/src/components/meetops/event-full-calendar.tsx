'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { MeetEvent, Meeting } from '@/lib/meetops'

// ── Constantes ────────────────────────────────────────────────────────────────────

const WORK_START = 9
const WORK_END = 18
const PX_PER_MIN_BASE = 40 / 60
const WEEKDAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

type ViewMode = 'month' | 'week' | 'workweek' | 'day' | 'agenda'
const VIEW_LABELS: Record<ViewMode, string> = {
  month: 'Mois', week: 'Semaine', workweek: 'Sem. travail', day: 'Jour', agenda: 'Agenda',
}

interface CalRange { hourStart: number; hourEnd: number; totalMin: number; gridHeight: number; pxPerMin: number; hours: number[] }
function makeRange(compact: boolean): CalRange {
  const hourStart = compact ? 8 : 0; const hourEnd = compact ? 20 : 24
  const totalMin = (hourEnd - hourStart) * 60
  return { hourStart, hourEnd, totalMin, gridHeight: Math.round(totalMin * PX_PER_MIN_BASE), pxPerMin: PX_PER_MIN_BASE, hours: Array.from({ length: hourEnd - hourStart }, (_, i) => hourStart + i) }
}

// ── Utilitaires ───────────────────────────────────────────────────────────────────

function dayKey(d: Date) { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
function mondayOffset(d: Date) { return (d.getDay() + 6) % 7 }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function startOfWeek(d: Date) { return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -mondayOffset(d)) }
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day)
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - y.getTime()) / 86_400_000 + 1) / 7)
}
function timeToTop(startAt: string, hourStart: number, pxPerMin: number) {
  const d = new Date(startAt); return Math.max(0, ((d.getHours() - hourStart) * 60 + d.getMinutes()) * pxPerMin)
}

// ── Interfaces ────────────────────────────────────────────────────────────────────

interface Placed { id: string; title: string; label: string | null; startAt: string; durationMin: number; cancelled: boolean }
interface PlacedLayout extends Placed { col: number; totalCols: number }

function layoutItems(items: Placed[]): PlacedLayout[] {
  if (!items.length) return []
  const sorted = [...items].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))
  const cols: number[] = new Array(sorted.length).fill(0)
  for (let i = 0; i < sorted.length; i++) {
    const si = +new Date(sorted[i].startAt), ei = si + sorted[i].durationMin * 60_000
    const used = new Set<number>()
    for (let j = 0; j < i; j++) {
      const sj = +new Date(sorted[j].startAt), ej = sj + sorted[j].durationMin * 60_000
      if (sj < ei && ej > si) used.add(cols[j])
    }
    let c = 0; while (used.has(c)) c++; cols[i] = c
  }
  return sorted.map((item, i) => {
    const si = +new Date(item.startAt), ei = si + item.durationMin * 60_000
    let max = cols[i]
    for (let j = 0; j < sorted.length; j++) {
      if (j === i) continue
      const sj = +new Date(sorted[j].startAt), ej = sj + sorted[j].durationMin * 60_000
      if (sj < ei && ej > si) max = Math.max(max, cols[j])
    }
    return { ...item, col: cols[i], totalCols: max + 1 }
  })
}

// ── Popup survol ──────────────────────────────────────────────────────────────────

function MeetingPopup({ item, pos, color, onClose, onMouseEnter, onMouseLeave }: {
  item: Placed; pos: { x: number; y: number }; color: string
  onClose: () => void; onMouseEnter: () => void; onMouseLeave: () => void
}) {
  const start = new Date(item.startAt), end = new Date(+start + item.durationMin * 60_000)
  const fmt = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const x = Math.min(pos.x + 10, window.innerWidth - 240), y = Math.min(pos.y - 20, window.innerHeight - 160)
  return (
    <div className="fixed z-[100] w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3"
      style={{ left: x, top: y }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start gap-2 mb-1.5">
        <span className="w-2 h-2 rounded-sm mt-1 shrink-0" style={{ background: color }} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate text-gray-900 dark:text-white">{item.title}</div>
          <div className="text-xs text-gray-400">{fmt(start)} – {fmt(end)} · {item.durationMin} min</div>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 shrink-0 p-0.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      {item.label && <span className="inline-block text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">{item.label}</span>}
      {item.cancelled && <div className="text-xs text-red-500 mt-1">Annulée</div>}
    </div>
  )
}

// ── Popup création rapide ─────────────────────────────────────────────────────────

function QuickCreatePopup({ date, pos, onSave, onClose }: {
  date: Date; pos: { x: number; y: number }
  onSave: (title: string, startAt: Date) => Promise<void>; onClose: () => void
}) {
  const [title, setTitle] = useState('Nouvelle réunion')
  const [saving, setSaving] = useState(false)
  const x = Math.min(pos.x + 10, window.innerWidth - 260), y = Math.min(pos.y - 20, window.innerHeight - 150)
  const dateLabel = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  const timeLabel = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!title.trim()) return; setSaving(true)
    try { await onSave(title.trim(), date); onClose() }
    catch (err) { alert((err as Error).message); setSaving(false) }
  }
  return (
    <div className="fixed z-[100] w-60 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3"
      style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">{dateLabel} · {timeLabel}</span>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 p-0.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre"
          className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
        <div className="flex justify-end gap-1.5">
          <button type="button" onClick={onClose} className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Annuler</button>
          <button type="submit" disabled={saving || !title.trim()} className="px-3 py-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg">{saving ? '…' : 'Créer'}</button>
        </div>
      </form>
    </div>
  )
}

// ── Menu clic-droit ───────────────────────────────────────────────────────────────

function ContextMenu({ item, pos, onDuplicate, onDelete, onClose }: {
  item: Placed; pos: { x: number; y: number }
  onDuplicate: (item: Placed) => void; onDelete: (id: string) => void; onClose: () => void
}) {
  useEffect(() => { const c = () => onClose(); window.addEventListener('click', c, { once: true }); return () => window.removeEventListener('click', c) }, [onClose])
  const x = Math.min(pos.x, window.innerWidth - 180), y = Math.min(pos.y, window.innerHeight - 110)
  return (
    <div className="fixed z-[101] w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => { onDuplicate(item); onClose() }} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">Dupliquer (+30 min)</button>
      <hr className="my-1 border-gray-100 dark:border-gray-800" />
      <button onClick={() => { if (confirm(`Supprimer « ${item.title} » ?`)) { onDelete(item.id); onClose() } }} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">Supprimer</button>
    </div>
  )
}

// ── TimeGrid ──────────────────────────────────────────────────────────────────────

interface PopupState { item: Placed; x: number; y: number }
interface QuickState { date: Date; x: number; y: number }
interface CtxState { item: Placed; x: number; y: number }

interface GridHandlers {
  now: Date; nowKey: string; color: string
  selectedId: string | null; resizePreview: { id: string; duration: number } | null
  onEnter: (item: Placed, e: React.MouseEvent) => void; onLeave: () => void
  onClick: (id: string) => void
  onDrop: (id: string, newStart: Date) => void
  onContextMenu: (item: Placed, e: React.MouseEvent) => void
  onSlotClick: (date: Date, pos: { x: number; y: number }) => void
  onResizeStart: (id: string, startY: number, origDuration: number) => void
}

function TimeGrid({ columnDays, byDay, todayKey, viewMode, calRange, color, handlers }: {
  columnDays: Date[]; byDay: Map<string, Placed[]>; todayKey: string
  viewMode: ViewMode; calRange: CalRange; color: string; handlers: GridHandlers
}) {
  const { hourStart, hourEnd, totalMin, gridHeight, pxPerMin, hours } = calRange
  const { now, nowKey, selectedId, resizePreview, onEnter, onLeave, onClick, onDrop, onContextMenu, onSlotClick, onResizeStart } = handlers
  const gridCols = viewMode === 'day' ? 'grid-cols-1' : viewMode === 'workweek' ? 'grid-cols-5' : 'grid-cols-7'
  const [dropInfo, setDropInfo] = useState<{ key: string; top: number } | null>(null)
  const nowTop = timeToTop(now.toISOString(), hourStart, pxPerMin)

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, d: Date) {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const snapped = Math.min(Math.round((Math.max(0, e.clientY - rect.top) / gridHeight * totalMin) / 15) * 15, totalMin - 15)
    setDropInfo({ key: dayKey(d), top: (snapped / totalMin) * gridHeight })
  }
  function handleDrop(e: React.DragEvent<HTMLDivElement>, d: Date) {
    e.preventDefault(); setDropInfo(null)
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain')) as { id: string; offsetY: number }
      const y = Math.max(0, e.clientY - e.currentTarget.getBoundingClientRect().top - data.offsetY)
      const snapped = Math.max(0, Math.min(totalMin - 30, Math.round((y / gridHeight * totalMin) / 15) * 15))
      const min = hourStart * 60 + snapped
      onDrop(data.id, new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(min / 60), min % 60, 0, 0))
    } catch { /* ignore */ }
  }
  function handleColClick(e: React.MouseEvent<HTMLDivElement>, d: Date) {
    if ((e.target as HTMLElement).closest('[data-meeting]')) return
    e.stopPropagation()
    const y = Math.max(0, e.clientY - e.currentTarget.getBoundingClientRect().top)
    const snapped = Math.max(0, Math.min(totalMin - 30, Math.round((y / gridHeight * totalMin) / 15) * 15))
    const min = hourStart * 60 + snapped
    onSlotClick(new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(min / 60), min % 60, 0, 0), { x: e.clientX, y: e.clientY })
  }

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
      <div className={`grid ${gridCols} border-b border-gray-100 dark:border-gray-800 ml-10`}>
        {columnDays.map((d, i) => {
          const key = dayKey(d); const isToday = key === todayKey
          return (
            <div key={i} className={`text-center py-2 border-l border-gray-100 dark:border-gray-800 ${isToday ? 'text-primary-600' : 'text-gray-500 dark:text-gray-400'}`}>
              <div className="text-[11px] uppercase tracking-wide">{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
              <div className={`text-base ${isToday ? 'font-bold' : 'font-semibold'}`}>{d.getDate()}</div>
            </div>
          )
        })}
      </div>
      {hasAllDay && (
        <div className={`grid ${gridCols} border-b border-gray-100 dark:border-gray-800 ml-10`}>
          {columnDays.map((d, i) => {
            const items = allDayByDay.get(dayKey(d)) ?? []
            return (
              <div key={i} className="border-l border-gray-100 dark:border-gray-800 p-0.5 min-h-[24px]">
                {items.map((it, j) => (
                  <div key={j} className="text-[10px] rounded px-1 truncate text-white mb-0.5 cursor-pointer" style={{ background: color }}
                    onMouseEnter={(e) => onEnter(it, e)} onMouseLeave={onLeave} onClick={(e) => { e.stopPropagation(); onClick(it.id) }}>{it.title}</div>
                ))}
              </div>
            )
          })}
        </div>
      )}
      <div className="flex">
        <div className="w-10 shrink-0 relative select-none" style={{ height: gridHeight }}>
          {hours.map((h) => (
            <div key={h} className="absolute w-full text-right pr-2 text-[10px] text-gray-400 -translate-y-2" style={{ top: (h - hourStart) * 60 * pxPerMin }}>{h}h</div>
          ))}
        </div>
        <div className={`flex-1 grid ${gridCols}`}>
          {columnDays.map((d, i) => {
            const key = dayKey(d)
            const visible = (byDay.get(key) ?? []).filter((it) => { const h = new Date(it.startAt).getHours(); return h >= hourStart && h < hourEnd })
            const laid = layoutItems(visible)
            const isToday = key === todayKey
            return (
              <div key={i} className="relative border-l border-gray-100 dark:border-gray-800 cursor-crosshair overflow-hidden"
                style={{ height: gridHeight }}
                onClick={(e) => handleColClick(e, d)}
                onDragOver={(e) => handleDragOver(e, d)} onDragLeave={() => setDropInfo(null)} onDrop={(e) => handleDrop(e, d)}>
                <div className="absolute left-0 right-0 bg-gray-50/70 dark:bg-gray-800/30 pointer-events-none"
                  style={{ top: 0, height: Math.max(0, WORK_START - hourStart) * 60 * pxPerMin }} />
                <div className="absolute left-0 right-0 bg-gray-50/70 dark:bg-gray-800/30 pointer-events-none"
                  style={{ top: (WORK_END - hourStart) * 60 * pxPerMin, height: Math.max(0, hourEnd - WORK_END) * 60 * pxPerMin }} />
                {hours.map((h) => (
                  <div key={h} className="absolute w-full border-t border-gray-100 dark:border-gray-800" style={{ top: (h - hourStart) * 60 * pxPerMin }} />
                ))}
                {hours.slice(0, -1).map((h) => (
                  <div key={`${h}.5`} className="absolute w-full border-t border-gray-50 dark:border-gray-800/50" style={{ top: (h - hourStart + 0.5) * 60 * pxPerMin }} />
                ))}
                {isToday && nowTop >= 0 && nowTop <= gridHeight && (
                  <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: nowTop, transform: 'translateY(-50%)' }}>
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]" />
                    <div className="flex-1 h-[1.5px] bg-red-500" />
                  </div>
                )}
                {dropInfo?.key === key && (
                  <div className="absolute left-0 right-0 h-0.5 bg-primary-400 z-10 pointer-events-none" style={{ top: dropInfo.top }}>
                    <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-primary-400" />
                  </div>
                )}
                {laid.map((it, j) => {
                  const effDur = resizePreview?.id === it.id ? resizePreview.duration : it.durationMin
                  const top = timeToTop(it.startAt, hourStart, pxPerMin)
                  const height = Math.max(18, effDur * pxPerMin - 2)
                  const time = new Date(it.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  const colW = 100 / it.totalCols; const GAP = 1.5
                  return (
                    <div key={j} data-meeting="true" draggable
                      onDragStart={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        e.dataTransfer.setData('text/plain', JSON.stringify({ id: it.id, offsetY: e.clientY - rect.top }))
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onMouseEnter={(e) => onEnter(it, e)} onMouseLeave={onLeave}
                      onClick={(e) => { e.stopPropagation(); onClick(it.id) }}
                      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(it, e) }}
                      className={[
                        'absolute rounded px-1 overflow-hidden text-white text-[10px] cursor-pointer select-none transition-[filter,outline]',
                        it.cancelled ? 'opacity-50 line-through' : 'hover:brightness-90',
                        selectedId === it.id ? 'outline outline-2 outline-white outline-offset-1' : '',
                      ].join(' ')}
                      style={{ top, height, left: `${it.col * colW + GAP}%`, width: `${colW - GAP * 2}%`, background: color }}>
                      <div className="font-semibold leading-tight truncate">{time}</div>
                      {height > 28 && <div className="truncate leading-tight opacity-90">{it.title}</div>}
                      <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-white/30 transition-colors"
                        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onResizeStart(it.id, e.clientY, effDur) }}
                        onDragStart={(e) => e.preventDefault()} data-meeting="true" />
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

// ── Composant principal ───────────────────────────────────────────────────────────

export function EventFullCalendar({ event, onUpdate, onAdd, onDelete }: {
  event: MeetEvent
  onUpdate: (meetingId: string, patch: { startAt?: string; durationMin?: number }) => Promise<void>
  onAdd: (input: { title?: string; startAt: string; durationMin?: number }) => Promise<void>
  onDelete: (meetingId: string) => Promise<void>
}) {
  const color = event.color

  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [anchor, setAnchor] = useState<Date>(() => {
    const firstMeeting = [...event.meetings].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))[0]
    return firstMeeting ? new Date(firstMeeting.startAt) : new Date()
  })
  const [compactHours, setCompactHours] = useState(false)
  const calRange = useMemo(() => makeRange(compactHours), [compactHours])
  const [now, setNow] = useState(() => new Date())
  const nowKey = dayKey(now)
  const todayKey = dayKey(new Date())

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [popup, setPopup] = useState<PopupState | null>(null)
  const [quickCreate, setQuickCreate] = useState<QuickState | null>(null)
  const [contextMenu, setContextMenu] = useState<CtxState | null>(null)
  const [resizePreview, setResizePreview] = useState<{ id: string; duration: number } | null>(null)
  const resizeRef = useRef<{ id: string; startY: number; origDuration: number } | null>(null)

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function showPopup(item: Placed, e: React.MouseEvent) { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); setPopup({ item, x: e.clientX, y: e.clientY }) }
  function scheduleHide() { hideTimerRef.current = setTimeout(() => setPopup(null), 200) }
  function cancelHide() { if (hideTimerRef.current) clearTimeout(hideTimerRef.current) }

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t) }, [])

  const viewModeRef = useRef(viewMode); viewModeRef.current = viewMode
  const anchorRef = useRef(anchor); anchorRef.current = anchor
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      const m = viewModeRef.current, a = anchorRef.current
      if (e.key === 'ArrowLeft') { if (m === 'month') setAnchor(new Date(a.getFullYear(), a.getMonth() - 1, 1)); else if (m === 'day') setAnchor(addDays(a, -1)); else if (m !== 'agenda') setAnchor(addDays(a, -7)) }
      else if (e.key === 'ArrowRight') { if (m === 'month') setAnchor(new Date(a.getFullYear(), a.getMonth() + 1, 1)); else if (m === 'day') setAnchor(addDays(a, 1)); else if (m !== 'agenda') setAnchor(addDays(a, 7)) }
      else if (e.key === 't') setAnchor(new Date())
      else if (e.key === '1') setViewMode('month'); else if (e.key === '2') setViewMode('week')
      else if (e.key === '3') setViewMode('workweek'); else if (e.key === '4') setViewMode('day'); else if (e.key === '5') setViewMode('agenda')
      else if (e.key === 'Escape') { setSelectedId(null); setPopup(null); setContextMenu(null); setQuickCreate(null) }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleResizeStart(id: string, startY: number, origDuration: number) {
    resizeRef.current = { id, startY, origDuration }
    function onMove(e: MouseEvent) {
      if (!resizeRef.current) return
      const deltaMins = Math.round(((e.clientY - resizeRef.current.startY) / calRange.pxPerMin) / 15) * 15
      setResizePreview({ id: resizeRef.current.id, duration: Math.max(15, resizeRef.current.origDuration + deltaMins) })
    }
    async function onUp(e: MouseEvent) {
      document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp)
      if (!resizeRef.current) return
      const deltaMins = Math.round(((e.clientY - resizeRef.current.startY) / calRange.pxPerMin) / 15) * 15
      const newDuration = Math.max(15, resizeRef.current.origDuration + deltaMins)
      const { id, origDuration } = resizeRef.current; resizeRef.current = null; setResizePreview(null)
      if (newDuration !== origDuration) try { await onUpdate(id, { durationMin: newDuration }) } catch (err) { alert((err as Error).message) }
    }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }

  const byDay = useMemo(() => {
    const map = new Map<string, Placed[]>()
    for (const m of event.meetings) {
      const key = dayKey(new Date(m.startAt))
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push({ id: m.id, title: m.title, label: m.label, startAt: m.startAt, durationMin: m.durationMin, cancelled: m.status === 'CANCELLED' })
    }
    for (const list of map.values()) list.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))
    return map
  }, [event.meetings])

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
    const ms = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const gs = addDays(ms, -mondayOffset(ms))
    return Array.from({ length: 42 }, (_, i) => addDays(gs, i))
  }, [viewMode, anchor])

  const rangeLabel = useMemo(() => {
    if (viewMode === 'month') return anchor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    if (viewMode === 'day') return anchor.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    if (viewMode === 'agenda') return 'Toutes les réunions'
    const a = columnDays[0], b = columnDays[columnDays.length - 1]
    if (!a || !b) return ''
    return `${a.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${b.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} · Sem. ${getISOWeek(a)}`
  }, [viewMode, anchor, columnDays])

  const agendaItems = useMemo(() => {
    const all: (Placed & { date: Date })[] = []
    for (const [, items] of byDay.entries()) for (const it of items) all.push({ ...it, date: new Date(it.startAt) })
    return all.sort((a, b) => +a.date - +b.date)
  }, [byDay])

  const agendaByDay = useMemo(() => {
    const map = new Map<string, typeof agendaItems>()
    for (const m of agendaItems) { const k = dayKey(m.date); if (!map.has(k)) map.set(k, []); map.get(k)!.push(m) }
    return map
  }, [agendaItems])

  async function handleDrop(id: string, newStart: Date) {
    try { await onUpdate(id, { startAt: newStart.toISOString() }) } catch (err) { alert((err as Error).message) }
  }

  async function handleQuickSave(title: string, startAt: Date) {
    await onAdd({ title, startAt: startAt.toISOString(), durationMin: 60 })
  }

  async function handleDuplicate(item: Placed) {
    const newStart = new Date(+new Date(item.startAt) + 30 * 60_000)
    try { await onAdd({ title: `${item.title} (copie)`, startAt: newStart.toISOString(), durationMin: item.durationMin }) }
    catch (err) { alert((err as Error).message) }
  }

  async function handleDelete(id: string) {
    try { await onDelete(id) } catch (err) { alert((err as Error).message) }
  }

  function renderChips(items: Placed[], max: number) {
    return (
      <>
        {items.slice(0, max).map((it, j) => {
          const time = new Date(it.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          return (
            <div key={j}
              className={['text-[10px] leading-tight rounded px-1 py-0.5 truncate cursor-pointer hover:brightness-90 transition-[filter]', it.cancelled ? 'line-through opacity-60' : '', selectedId === it.id ? 'outline outline-2 outline-white outline-offset-1' : ''].join(' ')}
              style={{ background: color, color: '#fff' }}
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

  const gridHandlers: GridHandlers = {
    now, nowKey, color, selectedId, resizePreview,
    onEnter: showPopup, onLeave: scheduleHide,
    onClick: (id) => setSelectedId((p) => p === id ? null : id),
    onDrop: handleDrop,
    onContextMenu: (item, e) => { e.preventDefault(); setContextMenu({ item, x: e.clientX, y: e.clientY }) },
    onSlotClick: (date, pos) => setQuickCreate({ date, x: pos.x, y: pos.y }),
    onResizeStart: handleResizeStart,
  }

  return (
    <div className="flex flex-col gap-4" onClick={() => { setSelectedId(null); setQuickCreate(null) }}>
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
          <button onClick={() => shift(-1)} disabled={viewMode === 'agenda'} className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30">‹</button>
          <button onClick={() => setAnchor(new Date())} className="px-2 h-8 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Aujourd&apos;hui</button>
          <button onClick={() => shift(1)} disabled={viewMode === 'agenda'} className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30">›</button>
        </div>
        <span className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{rangeLabel}</span>
        {['week', 'workweek', 'day'].includes(viewMode) && (
          <button onClick={() => setCompactHours((c) => !c)}
            className={`ml-auto text-sm font-medium border rounded-lg px-3 py-1.5 transition-colors ${compactHours ? 'border-primary-400 text-primary-600 dark:text-primary-400' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            {compactHours ? '8h–20h' : '0h–24h'}
          </button>
        )}
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
              const key = dayKey(d); const items = byDay.get(key) ?? []
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

      {/* Vues grille */}
      {(viewMode === 'week' || viewMode === 'workweek' || viewMode === 'day') && (
        <TimeGrid columnDays={columnDays} byDay={byDay} todayKey={todayKey} viewMode={viewMode} calRange={calRange} color={color} handlers={gridHandlers} />
      )}

      {/* Vue Agenda */}
      {viewMode === 'agenda' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl divide-y divide-gray-100 dark:divide-gray-800">
          {agendaItems.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">Aucune réunion à afficher.</div>
          ) : (
            [...agendaByDay.entries()].map(([key, items]) => {
              const d = new Date(key + 'T12:00:00'); const isToday = key === todayKey
              return (
                <div key={key} className="flex gap-4 p-4">
                  <div className={`w-14 shrink-0 text-right ${isToday ? 'text-primary-600 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                    <div className="text-[11px] uppercase tracking-wide">{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                    <div className="text-xl font-semibold leading-tight">{d.getDate()}</div>
                    <div className="text-[11px]">{d.toLocaleDateString('fr-FR', { month: 'short' })}</div>
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    {items.map((it, j) => {
                      const start = new Date(it.startAt), end = new Date(+start + it.durationMin * 60_000)
                      const fmt = (x: Date) => x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                      return (
                        <div key={j}
                          className={['flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors', it.cancelled ? 'opacity-50 line-through' : '', selectedId === it.id ? 'ring-1 ring-primary-400' : ''].join(' ')}
                          onMouseEnter={(e) => showPopup(it, e)} onMouseLeave={scheduleHide}
                          onClick={(e) => { e.stopPropagation(); setSelectedId((p) => p === it.id ? null : it.id) }}
                          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ item: it, x: e.clientX, y: e.clientY }) }}>
                          <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: color }} />
                          <div className="text-xs text-gray-400 w-28 shrink-0">{fmt(start)} – {fmt(end)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate text-gray-900 dark:text-white">{it.title}</div>
                            {it.label && <div className="text-xs text-gray-400 truncate">{it.label}</div>}
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

      {/* Popups */}
      {popup && (
        <MeetingPopup item={popup.item} pos={{ x: popup.x, y: popup.y }} color={color}
          onClose={() => setPopup(null)} onMouseEnter={cancelHide} onMouseLeave={scheduleHide} />
      )}
      {quickCreate && (
        <QuickCreatePopup date={quickCreate.date} pos={{ x: quickCreate.x, y: quickCreate.y }}
          onSave={handleQuickSave} onClose={() => setQuickCreate(null)} />
      )}
      {contextMenu && (
        <ContextMenu item={contextMenu.item} pos={{ x: contextMenu.x, y: contextMenu.y }}
          onDuplicate={handleDuplicate} onDelete={handleDelete} onClose={() => setContextMenu(null)} />
      )}
    </div>
  )
}
