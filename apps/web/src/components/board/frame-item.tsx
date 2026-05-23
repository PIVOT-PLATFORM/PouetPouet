'use client'

import { useState, useRef } from 'react'
import type { Frame, Card } from '@/hooks/useBoard'

interface Props {
  frame: Frame
  cards: Card[]
  zoom?: number
  isReadonly?: boolean
  onMove: (id: string, posX: number, posY: number, capturedCards: { id: string; startX: number; startY: number; frameStartX: number; frameStartY: number }[]) => void
  onStartDrag?: (id: string, capturedCardIds: string[]) => void
  onCommitDrag?: (id: string) => void
  onResize: (id: string, width: number, height: number) => void
  onStartResize?: (id: string) => void
  onCommitResize?: (id: string) => void
  onUpdate: (id: string, title: string) => void
  onDelete: (id: string) => void
}

export function FrameItem({ frame, cards, zoom = 1, isReadonly, onMove, onStartDrag, onCommitDrag, onResize, onStartResize, onCommitResize, onUpdate, onDelete }: Props) {
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

    // Capture cards whose center is inside the frame
    capturedRef.current = cards
      .filter((c) => {
        const cx = c.posX + c.width / 2
        const cy = c.posY + c.height / 2
        return cx >= frame.posX && cx <= frame.posX + frame.width && cy >= frame.posY && cy <= frame.posY + frame.height
      })
      .map((c) => ({ id: c.id, startX: c.posX, startY: c.posY, frameStartX: startFrameX, frameStartY: startFrameY }))

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

  function handleResizeMouseDown(e: React.MouseEvent) {
    if (isReadonly) return
    e.preventDefault()
    e.stopPropagation()
    onStartResize?.(frame.id)
    const startX = e.clientX
    const startY = e.clientY
    const startW = frame.width
    const startH = frame.height

    function onMouseMove(ev: MouseEvent) {
      const w = Math.max(150, startW + (ev.clientX - startX) / zoom)
      const h = Math.max(100, startH + (ev.clientY - startY) / zoom)
      onResize(frame.id, w, h)
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
      {/* Frame body */}
      <div
        className="w-full h-full rounded-2xl border-2 border-dashed"
        style={{ background: frame.color, borderColor: 'rgba(99,102,241,0.35)', cursor: isReadonly ? 'default' : 'move' }}
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

      {/* Resize handle */}
      {!isReadonly && (
        <div
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-0 group-hover/frame:opacity-60 transition-opacity flex items-center justify-center"
          onMouseDown={handleResizeMouseDown}
        >
          <svg className="w-3 h-3 text-indigo-400" viewBox="0 0 10 10" fill="currentColor">
            <path d="M9 5L5 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      )}
    </div>
  )
}
