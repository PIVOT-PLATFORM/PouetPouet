'use client'

import { useCallback, useLayoutEffect, useState, type RefObject } from 'react'
import { Trash2 } from 'lucide-react'
import type { PiDependency, PiDependencyStatus } from '@/hooks/usePi'

const OK_COLOR = '#10b981'
const BLOCKED_COLOR = '#ef4444'

interface Arrow {
  dep: PiDependency
  d: string
  mid: { x: number; y: number }
}

// Overlay SVG des flèches de dépendances, positionné dans le wrapper `relative`
// du board (les flèches défilent avec le contenu, zéro recalcul au scroll).
// Ancres = éléments DOM des cartes tickets, positions relatives au wrapper.
// Rouge (bloquant) = plus épais + pointillés, lisible pour les daltoniens.
export function DependencyLayer({ dependencies, anchors, wrapperRef, revision, canEdit, onUpdate, onDelete }: {
  dependencies: PiDependency[]
  anchors: RefObject<Map<string, HTMLElement>>
  wrapperRef: RefObject<HTMLDivElement | null>
  revision: string // signature de placement des tickets : change quand une position a pu bouger
  canEdit: boolean
  onUpdate: (depId: string, patch: { status?: PiDependencyStatus; note?: string | null }) => void
  onDelete: (depId: string) => void
}) {
  const [arrows, setArrows] = useState<Arrow[]>([])
  const [openDepId, setOpenDepId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  const recompute = useCallback(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const wRect = wrapper.getBoundingClientRect()
    const next: Arrow[] = []
    for (const dep of dependencies) {
      const fromEl = anchors.current?.get(dep.fromTicketId)
      const toEl = anchors.current?.get(dep.toTicketId)
      if (!fromEl || !toEl) continue
      const f = fromEl.getBoundingClientRect()
      const t = toEl.getBoundingClientRect()
      // Sortie par le bord latéral le plus proche de la cible, entrée par le bord opposé.
      const leftToRight = f.left + f.width / 2 <= t.left + t.width / 2
      const x1 = (leftToRight ? f.right : f.left) - wRect.left
      const x2 = (leftToRight ? t.left : t.right) - wRect.left
      const y1 = f.top + f.height / 2 - wRect.top
      const y2 = t.top + t.height / 2 - wRect.top
      const dx = Math.max(Math.abs(x2 - x1) / 2, 40) * (leftToRight ? 1 : -1)
      next.push({
        dep,
        d: `M${x1.toFixed(1)},${y1.toFixed(1)} C${(x1 + dx).toFixed(1)},${y1.toFixed(1)} ${(x2 - dx).toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`,
        mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
      })
    }
    setArrows(next)
  }, [dependencies, anchors, wrapperRef])

  useLayoutEffect(() => {
    recompute()
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const observer = new ResizeObserver(recompute)
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [recompute, revision, wrapperRef])

  const openArrow = arrows.find((a) => a.dep.id === openDepId)

  function openPopover(dep: PiDependency) {
    setNoteDraft(dep.note ?? '')
    setOpenDepId(dep.id)
  }

  function saveNote() {
    if (!openArrow) return
    const trimmed = noteDraft.trim()
    if (trimmed !== (openArrow.dep.note ?? '')) onUpdate(openArrow.dep.id, { note: trimmed || null })
  }

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <svg className="w-full h-full overflow-visible">
        <defs>
          <marker id="pi-dep-ok" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 Z" fill={OK_COLOR} />
          </marker>
          <marker id="pi-dep-blocked" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 Z" fill={BLOCKED_COLOR} />
          </marker>
        </defs>
        {arrows.map(({ dep, d }) => {
          const blocked = dep.status === 'BLOCKED'
          return (
            <g key={dep.id}>
              <path
                d={d}
                fill="none"
                stroke={blocked ? BLOCKED_COLOR : OK_COLOR}
                strokeWidth={blocked ? 2.5 : 1.5}
                strokeDasharray={blocked ? '6,4' : undefined}
                markerEnd={`url(#${blocked ? 'pi-dep-blocked' : 'pi-dep-ok'})`}
                opacity={openDepId && openDepId !== dep.id ? 0.3 : 0.9}
              />
              {/* Path invisible élargi pour rendre la flèche cliquable. */}
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                className="cursor-pointer"
                style={{ pointerEvents: 'stroke' }}
                onClick={() => openPopover(dep)}
              >
                <title>{dep.note || (blocked ? 'Dépendance bloquante' : 'Dépendance OK')}</title>
              </path>
            </g>
          )
        })}
      </svg>

      {openArrow && (
        <div
          className="absolute z-30 w-60 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-3 flex flex-col gap-2 pointer-events-auto"
          style={{ left: Math.max(openArrow.mid.x - 120, 4), top: openArrow.mid.y + 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {(['OK', 'BLOCKED'] as const).map((status) => (
                <button
                  key={status}
                  disabled={!canEdit}
                  onClick={() => onUpdate(openArrow.dep.id, { status })}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors disabled:cursor-default
                    ${openArrow.dep.status === status
                      ? status === 'OK' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                >
                  {status === 'OK' ? 'OK' : 'Bloquant'}
                </button>
              ))}
            </div>
            {canEdit && (
              <button
                onClick={() => { onDelete(openArrow.dep.id); setOpenDepId(null) }}
                className="p-1 rounded text-gray-300 hover:text-red-500"
                title="Supprimer la dépendance"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          {canEdit ? (
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={saveNote}
              placeholder="Note (optionnelle)…"
              rows={2}
              maxLength={1000}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none"
            />
          ) : (
            openArrow.dep.note && <p className="text-xs text-gray-500 dark:text-gray-400">{openArrow.dep.note}</p>
          )}
          <button onClick={() => { saveNote(); setOpenDepId(null) }} className="self-end text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Fermer</button>
        </div>
      )}
    </div>
  )
}
