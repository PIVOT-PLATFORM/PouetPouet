'use client'

import { useRef, useState, useLayoutEffect, useMemo } from 'react'
import type { RoadmapItem, RoadmapScale } from '@/hooks/useRoadmap'
import { CATEGORIES, RISKS, barBackground, textOn } from './roadmap-constants'
import {
  getCols, colWidth, timelineWidth, dateToX, parseDate, formatDate, frDate,
} from '@/lib/roadmap-timeline'

const ROW_H = 52
const BAR_H = 30
const HEADER_H = 52
const DAY = 86400000

interface Props {
  startDate: string
  endDate: string
  scale: RoadmapScale
  items: RoadmapItem[] // déjà ordonnés
  showDeps: boolean
  onItemClick: (item: RoadmapItem) => void
}

export function RoadmapTimeline({ startDate, endDate, scale, items, showDeps, onItemClick }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(1000)
  const [cursorDays, setCursorDays] = useState<number | null>(null)
  const [tip, setTip] = useState<{ item: RoadmapItem; x: number; y: number } | null>(null)

  const start = useMemo(() => parseDate(startDate), [startDate])
  const end = useMemo(() => parseDate(endDate), [endDate])
  const cols = useMemo(() => getCols(start, end, scale), [start, end, scale])
  const cw = colWidth(cols, scale, available)
  const tw = timelineWidth(cols, cw)
  const today = new Date()

  // Mesure de la largeur disponible (remplissage du viewport).
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const measure = () => setAvailable(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY))
  const todayInRange = today >= start && today <= end
  const todayX = todayInRange ? dateToX(today, start, end, tw) : 0

  const effectiveCursorDays = cursorDays ?? (todayInRange ? Math.round((today.getTime() - start.getTime()) / DAY) : 0)
  const cursorDate = new Date(start.getTime() + effectiveCursorDays * DAY)
  const cursorX = dateToX(cursorDate, start, end, tw)

  const bodyHeight = items.length * ROW_H

  // Flèches de dépendances : de la fin du prérequis (ligne i) au début de l'item (ligne j).
  const rowIndex = new Map(items.map((it, i) => [it.id, i]))
  const depPaths: string[] = []
  if (showDeps) {
    items.forEach((item, j) => {
      const toY = j * ROW_H + ROW_H / 2
      const toX = dateToX(parseDate(item.startDate), start, end, tw)
      item.deps.forEach((depId) => {
        const i = rowIndex.get(depId)
        if (i === undefined) return
        const dep = items[i]
        const fromY = i * ROW_H + ROW_H / 2
        const fromX = dateToX(parseDate(dep.endDate), start, end, tw)
        const mx = (fromX + toX) / 2
        depPaths.push(`M${fromX.toFixed(1)},${fromY.toFixed(1)} C${mx.toFixed(1)},${fromY.toFixed(1)} ${mx.toFixed(1)},${toY.toFixed(1)} ${toX.toFixed(1)},${toY.toFixed(1)}`)
      })
    })
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div ref={bodyRef} className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-900">
        <div className="relative" style={{ width: tw, minWidth: '100%' }}>
          {/* En-tête colonnes (sticky) */}
          <div className="sticky top-0 z-20 flex bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700" style={{ height: HEADER_H }}>
            {cols.map((col, i) => {
              const isToday = today >= col.start && today <= col.end
              return (
                <div key={i} className={`flex flex-col justify-center px-3 overflow-hidden border-l first:border-l-0 border-gray-200 dark:border-gray-700 ${isToday ? 'bg-primary-50 dark:bg-primary-950' : ''}`} style={{ width: cw }}>
                  <span className={`font-mono text-xs font-semibold truncate ${isToday ? 'text-primary-600 dark:text-primary-300' : 'text-gray-600 dark:text-gray-300'}`}>{col.label}</span>
                  {col.sub && <span className="font-mono text-[9px] text-gray-400 mt-0.5">{col.sub}</span>}
                </div>
              )
            })}
          </div>

          {/* Corps : lignes de barres */}
          <div className="relative" style={{ height: bodyHeight }}>
            {/* Lignes de grille verticales */}
            {cols.map((_, i) => (
              <div key={i} className="absolute top-0 bottom-0 border-l border-gray-100 dark:border-gray-800 pointer-events-none" style={{ left: i * cw }} />
            ))}

            {/* Marqueur aujourd'hui */}
            {todayInRange && (
              <div className="absolute top-0 bottom-0 w-px bg-red-400/70 pointer-events-none z-10" style={{ left: todayX }} />
            )}

            {/* Curseur temporel */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/80 pointer-events-none z-10" style={{ left: cursorX }} />

            {/* Barres */}
            {items.map((item, j) => {
              const x1 = dateToX(parseDate(item.startDate), start, end, tw)
              const x2 = dateToX(parseDate(item.endDate), start, end, tw)
              const bw = Math.max(x2 - x1, 22)
              const cats = item.categories.length ? item.categories : (['dev'] as const)
              const catLabel = cats.map((k) => CATEGORIES[k]?.label ?? k).join('·')
              const bg = barBackground(item.categories)
              const fg = cats.length === 1 ? textOn(CATEGORIES[cats[0]].color) : '#fff'
              const wide = bw >= 60
              return (
                <div key={item.id} className="absolute" style={{ top: j * ROW_H, left: 0, right: 0, height: ROW_H }}>
                  <button
                    type="button"
                    onClick={() => onItemClick(item)}
                    onMouseEnter={(e) => setTip({ item, x: e.clientX, y: e.clientY })}
                    onMouseMove={(e) => setTip({ item, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setTip(null)}
                    className={`absolute flex items-center gap-1.5 px-2 rounded-md shadow-sm hover:brightness-105 hover:shadow-md transition-all overflow-hidden ${item.prio === 'must' ? 'ring-2 ring-amber-300' : ''}`}
                    style={{ left: x1, width: bw, top: (ROW_H - BAR_H) / 2, height: BAR_H, background: bg, color: fg }}
                  >
                    {item.prio === 'must' && <span className="text-amber-300 text-sm leading-none shrink-0 drop-shadow">★</span>}
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: RISKS[item.risk].color }} />
                    {wide && <span className="text-[11px] font-bold truncate flex-1 text-left leading-tight">{item.name}</span>}
                    {wide && <span className="text-[9px] font-extrabold uppercase tracking-wide opacity-70 shrink-0">{catLabel}</span>}
                  </button>
                </div>
              )
            })}

            {/* Flèches de dépendances */}
            {showDeps && depPaths.length > 0 && (
              <svg className="absolute inset-0 pointer-events-none z-10 overflow-visible" width={tw} height={bodyHeight}>
                <defs>
                  <marker id="rm-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0,8 3,0 6" fill="#f59e0b" />
                  </marker>
                </defs>
                {depPaths.map((d, i) => (
                  <path key={i} d={d} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5,3" markerEnd="url(#rm-arrow)" />
                ))}
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Barre du curseur temporel */}
      <div className="flex items-center gap-3 mt-3 px-1">
        <span className="text-sm shrink-0">⚓</span>
        <input
          type="range"
          min={0}
          max={totalDays}
          value={effectiveCursorDays}
          onChange={(e) => setCursorDays(Number(e.target.value))}
          className="flex-1 accent-red-500 cursor-pointer"
        />
        <span className="font-mono text-xs font-bold text-red-500 min-w-[90px] text-right">{frDate(formatDate(cursorDate))}</span>
      </div>

      {/* Tooltip */}
      {tip && (
        <div className="fixed z-50 pointer-events-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-3 py-2.5 max-w-[260px]"
          style={{ left: Math.min(tip.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 270), top: tip.y - 10 }}>
          <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">{tip.item.name}</p>
          {tip.item.biz && <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-1.5">{tip.item.biz}</p>}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] text-gray-400">{tip.item.startDate} → {tip.item.endDate}</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: RISKS[tip.item.risk].color + '22', color: RISKS[tip.item.risk].color }}>{RISKS[tip.item.risk].label}</span>
            {tip.item.prio === 'must' && <span className="text-[10px] font-bold text-amber-500">★ Must</span>}
          </div>
        </div>
      )}
    </div>
  )
}
