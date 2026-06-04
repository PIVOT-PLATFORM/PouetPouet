'use client'

import { useState, useRef } from 'react'
import type { Frame, Card } from '@/hooks/useBoard'
import { BorderResizeHandles, type ResizeDir } from './board-card-parts'

const FRAME_MIN_W = 150
const FRAME_MIN_H = 100

interface Props {
  frame: Frame
  cards: Card[]
  zoom?: number
  isReadonly?: boolean
  onMove: (id: string, posX: number, posY: number, capturedCards: { id: string; startX: number; startY: number; frameStartX: number; frameStartY: number }[]) => void
  onStartDrag?: (id: string, capturedCardIds: string[]) => void
  onCommitDrag?: (id: string) => void
  onResizeBox: (id: string, posX: number, posY: number, width: number, height: number) => void
  onStartResize?: (id: string) => void
  onCommitResize?: (id: string) => void
  onUpdate: (id: string, title: string) => void
  onSetActive: (id: string, active: boolean) => void
  onDelete: (id: string) => void
  onSetLayer?: (id: string, layer: number) => void
}

export function FrameItem({ frame, cards, zoom = 1, isReadonly, onMove, onStartDrag, onCommitDrag, onResizeBox, onStartResize, onCommitResize, onUpdate, onSetActive, onDelete, onSetLayer }: Props) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [title, setTitle] = useState(frame.title)
  const capturedRef = useRef<{ id: string; startX: number; startY: number; frameStartX: number; frameStartY: number }[]>([])

  function handleMouseDown(e: React.MouseEvent) {
    if (isEditingTitle) return
    if (isReadonly) return
    e.preventDefault()
    e.stopPropagation()

    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const startFrameX = frame.posX
    const startFrameY = frame.posY

    // Only an ACTIVE frame carries its contents. Inactive frames move alone and
    // capture nothing. Among captured cards, locked ones always stay put.
    // If a captured card belongs to a group, all unlocked group members travel
    // with it even if they sit outside the frame bounds.
    capturedRef.current = frame.active
      ? (() => {
          const inside = cards.filter((c) => {
            if (c.locked) return false
            const cx = c.posX + c.width / 2
            const cy = c.posY + c.height / 2
            return cx >= frame.posX && cx <= frame.posX + frame.width && cy >= frame.posY && cy <= frame.posY + frame.height
          })
          const capturedIds = new Set(inside.map((c) => c.id))
          const groupIds = new Set(inside.map((c) => c.groupId).filter(Boolean) as string[])
          if (groupIds.size > 0) {
            cards.forEach((c) => {
              if (!c.locked && c.groupId && groupIds.has(c.groupId) && !capturedIds.has(c.id))
                capturedIds.add(c.id)
            })
          }
          return cards
            .filter((c) => capturedIds.has(c.id))
            .map((c) => ({ id: c.id, startX: c.posX, startY: c.posY, frameStartX: startFrameX, frameStartY: startFrameY }))
        })()
      : []

    onStartDrag?.(frame.id, capturedRef.current.map((c) => c.id))

    function onMouseMove(ev: MouseEvent) {
      const dx = (ev.clientX - startMouseX) / zoom
      const dy = (ev.clientY - startMouseY) / zoom
      onMove(frame.id, startFrameX + dx, startFrameY + dy, capturedRef.current)
    }

    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      onCommitDrag?.(frame.id)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function handleResizeMouseDown(e: React.MouseEvent, dir: ResizeDir = 'se') {
    if (isReadonly) return
    e.preventDefault()
    e.stopPropagation()
    onStartResize?.(frame.id)
    const sx = e.clientX, sy = e.clientY
    const s = { x: frame.posX, y: frame.posY, w: frame.width, h: frame.height }

    function onMouseMove(ev: MouseEvent) {
      const dx = (ev.clientX - sx) / zoom
      const dy = (ev.clientY - sy) / zoom
      let { x, y, w, h } = s
      if (dir.includes('e')) w = s.w + dx
      if (dir.includes('s')) h = s.h + dy
      if (dir.includes('w')) { w = s.w - dx; x = s.x + dx }
      if (dir.includes('n')) { h = s.h - dy; y = s.y + dy }
      // Clamp to the minimum while keeping the anchored (opposite) edge fixed.
      if (w < FRAME_MIN_W) { if (dir.includes('w')) x = s.x + (s.w - FRAME_MIN_W); w = FRAME_MIN_W }
      if (h < FRAME_MIN_H) { if (dir.includes('n')) y = s.y + (s.h - FRAME_MIN_H); h = FRAME_MIN_H }
      onResizeBox(frame.id, x, y, w, h)
    }

    function onMouseUp() {
      onCommitResize?.(frame.id)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function handleTitleBlur() {
    setIsEditingTitle(false)
    onUpdate(frame.id, title)
  }

  return (
    <div
      className="absolute group/frame select-none"
      style={{ left: frame.posX, top: frame.posY, width: frame.width, height: frame.height }}
    >
      {/* Frame body — active frames get a solid, stronger border to signal they carry content */}
      <div
        className={`w-full h-full rounded-2xl border-2 ${frame.active ? 'border-solid' : 'border-dashed'}`}
        style={{
          background: frame.color,
          borderColor: frame.active ? 'rgba(99,102,241,0.7)' : 'rgba(99,102,241,0.35)',
          cursor: isReadonly ? 'default' : 'move',
        }}
        onMouseDown={handleMouseDown}
      />

      {/* Title bar */}
      <div
        className="absolute -top-7 left-0 flex items-center gap-1"
        onMouseDown={handleMouseDown}
      >
        {isEditingTitle ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') handleTitleBlur() }}
            onMouseDown={(e) => e.stopPropagation()}
            className="text-xs font-semibold text-indigo-700 bg-white border border-indigo-300 rounded px-2 py-0.5 focus:outline-none w-32"
          />
        ) : (
          <span
            className="text-xs font-semibold text-indigo-600 bg-white/80 rounded px-2 py-0.5 cursor-text hover:bg-white transition-colors"
            onDoubleClick={(e) => { e.stopPropagation(); if (!isReadonly) setIsEditingTitle(true) }}
          >
            {title}
          </span>
        )}

        {/* Active toggle — when active, the frame carries its unlocked contents on move */}
        {!isReadonly && (
          <button
            className={`transition-all w-5 h-5 rounded-full flex items-center justify-center ${
              frame.active
                ? 'bg-indigo-600 text-white opacity-100'
                : 'bg-white text-gray-400 opacity-0 group-hover/frame:opacity-100 hover:text-indigo-600'
            }`}
            title={frame.active ? 'Cadre actif : déplace son contenu. Cliquer pour désactiver.' : 'Cadre inactif : se déplace seul. Cliquer pour activer.'}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onSetActive(frame.id, !frame.active) }}
          >
            {/* frame-holds-content glyph: outer frame + inner block (filled when active) */}
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <rect x="8.5" y="8.5" width="7" height="7" rx="2" fill={frame.active ? 'currentColor' : 'none'} stroke="none" />
            </svg>
          </button>
        )}

        {/* Layer controls */}
        {!isReadonly && onSetLayer && (
          <div className="opacity-0 group-hover/frame:opacity-100 transition-opacity flex items-center rounded-full bg-white overflow-hidden border border-gray-200">
            {([0, 1, 2] as const).map((l) => (
              <button
                key={l}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onSetLayer(frame.id, l) }}
                title={l === 0 ? 'Arrière-plan' : l === 1 ? 'Plan principal' : 'Avant-plan'}
                className={`w-5 h-5 flex items-center justify-center transition-colors ${(frame.layer ?? 1) === l ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-indigo-600'}`}
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {l === 0 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />}
                  {l === 1 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14" />}
                  {l === 2 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />}
                </svg>
              </button>
            ))}
          </div>
        )}

        {/* Delete button */}
        {!isReadonly && (
          <button
            className="opacity-0 group-hover/frame:opacity-100 transition-opacity w-5 h-5 rounded-full bg-white flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(frame.id) }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Invisible border zones for resizing from any edge or corner — no visible handle */}
      {!isReadonly && (
        <BorderResizeHandles onStart={handleResizeMouseDown} />
      )}
    </div>
  )
}
