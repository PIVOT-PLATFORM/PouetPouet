'use client'

import { useRef, useState, useEffect } from 'react'
import type { Card, Frame, BoardField } from '@/hooks/useBoard'
import { groupColor } from '@/hooks/useBoard'
import { BoardCard } from './board-card'
import { FrameItem } from './frame-item'
import { CardDetailModal } from './card-detail-modal'
import type { ToolMode, StrokeSize } from './floating-toolbar'

interface Props {
  cards: Card[]
  frames: Frame[]
  fields: BoardField[]
  selectedIds: Set<string>
  toolMode: ToolMode
  toolColor: string
  toolStroke: StrokeSize
  toolFill: boolean
  toolOpacity: number
  onAddCard: (x: number, y: number, type?: string, content?: string, color?: string, width?: number, height?: number) => void
  onMoveCard: (id: string, x: number, y: number) => void
  onResizeCard: (id: string, w: number, h: number) => void
  onUpdateCard: (id: string, content: string) => void
  onRecolorCard: (id: string, color: string) => void
  onDeleteCard: (id: string) => void
  onSelectCards: (ids: Set<string>) => void
  onMoveFrame: (id: string, posX: number, posY: number, capturedCards: { id: string; startX: number; startY: number; frameStartX: number; frameStartY: number }[]) => void
  onResizeFrame: (id: string, w: number, h: number) => void
  onUpdateFrame: (id: string, title: string) => void
  onDeleteFrame: (id: string) => void
  onSetFieldValue: (cardId: string, fieldId: string, value: string) => void
  onClearFieldValue: (cardId: string, fieldId: string) => void
}

const MIN_ZOOM = 0.1
const MAX_ZOOM = 3
const DOT_SPACING = 24

export function BoardCanvas({
  cards, frames, fields, selectedIds, toolMode, toolColor, toolStroke, toolFill, toolOpacity,
  onAddCard, onMoveCard, onResizeCard, onUpdateCard, onRecolorCard, onDeleteCard,
  onSelectCards,
  onMoveFrame, onResizeFrame, onUpdateFrame, onDeleteFrame,
  onSetFieldValue, onClearFieldValue,
}: Props) {
  // ── Refs ────────────────────────────────────────────────────────────────────
  const containerRef   = useRef<HTMLDivElement>(null)
  const canvasRef      = useRef<HTMLDivElement>(null)
  const rbDomRef       = useRef<HTMLDivElement>(null)
  const drawingPathRef = useRef<SVGPathElement>(null)

  // Live viewport — updated every frame via direct DOM manipulation (no React re-render)
  const vpRef = useRef({ x: 0, y: 0, zoom: 1 })
  // React state — synced after interactions end so children receive correct zoom
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 })

  const [detailCardId, setDetailCardId] = useState<string | null>(null)

  // Link popover
  const [linkPopover, setLinkPopover] = useState<{ screenX: number; screenY: number; canvasX: number; canvasY: number } | null>(null)
  const [linkUrl, setLinkUrl] = useState('')

  // ── DOM helpers ──────────────────────────────────────────────────────────────
  function applyTransform(vp: { x: number; y: number; zoom: number }) {
    vpRef.current = vp
    if (canvasRef.current) {
      canvasRef.current.style.transform = `translate3d(${vp.x}px,${vp.y}px,0) scale(${vp.zoom})`
    }
    if (containerRef.current) {
      const d = DOT_SPACING * vp.zoom
      containerRef.current.style.backgroundSize = `${d}px ${d}px`
      containerRef.current.style.backgroundPosition = `${vp.x % d}px ${vp.y % d}px`
    }
  }

  function toCanvas(clientX: number, clientY: number) {
    const rect = containerRef.current!.getBoundingClientRect()
    const { x, y, zoom } = vpRef.current
    return { x: (clientX - rect.left - x) / zoom, y: (clientY - rect.top - y) / zoom }
  }

  // ── Middle-mouse pan ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current!
    function onDown(e: MouseEvent) {
      if (e.button !== 1) return
      e.preventDefault()
      const ox = e.clientX - vpRef.current.x
      const oy = e.clientY - vpRef.current.y
      el.style.cursor = 'grabbing'
      function onMove(ev: MouseEvent) {
        applyTransform({ ...vpRef.current, x: ev.clientX - ox, y: ev.clientY - oy })
      }
      function onUp() {
        el.style.cursor = ''
        setViewport({ ...vpRef.current })
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }
    el.addEventListener('mousedown', onDown)
    return () => el.removeEventListener('mousedown', onDown)
  }, [])

  // ── Scroll-wheel zoom (toward cursor) ────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current!
    let timer: ReturnType<typeof setTimeout>
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const { x, y, zoom } = vpRef.current
      const factor = e.ctrlKey ? 0.01 : 0.0008
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (1 - e.deltaY * factor)))
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      applyTransform({
        x: mx - (mx - x) * (newZoom / zoom),
        y: my - (my - y) * (newZoom / zoom),
        zoom: newZoom,
      })
      clearTimeout(timer)
      timer = setTimeout(() => setViewport({ ...vpRef.current }), 80)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => { el.removeEventListener('wheel', onWheel); clearTimeout(timer) }
  }, [])

  // ── Paste image ──────────────────────────────────────────────────────────────
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (!item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue
        const reader = new FileReader()
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string
          const el = containerRef.current!
          const rect = el.getBoundingClientRect()
          const center = toCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2)
          onAddCard(center.x - 150, center.y - 100, 'IMAGE', dataUrl)
        }
        reader.readAsDataURL(file)
        break
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [onAddCard])

  // ── Canvas mouse down ────────────────────────────────────────────────────────
  function handleCanvasMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0 || (e.target as HTMLElement) !== e.currentTarget) return

    // ── Freehand draw mode ──
    if (toolMode === 'draw') {
      e.preventDefault()
      const startP = toCanvas(e.clientX, e.clientY)
      const points: Array<{ x: number; y: number }> = [startP]

      const dp = drawingPathRef.current
      if (dp) {
        dp.setAttribute('d', `M${startP.x.toFixed(1)},${startP.y.toFixed(1)}`)
        dp.setAttribute('stroke', toolColor)
        dp.style.display = ''
      }

      function onMove(ev: MouseEvent) {
        const p = toCanvas(ev.clientX, ev.clientY)
        const last = points[points.length - 1]
        if (Math.hypot(p.x - last.x, p.y - last.y) < 2 / vpRef.current.zoom) return
        points.push(p)
        if (dp) {
          dp.setAttribute('d', 'M' + points.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' L'))
        }
      }

      function onUp() {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        if (dp) dp.style.display = 'none'
        if (points.length < 3) return

        const xs = points.map((p) => p.x)
        const ys = points.map((p) => p.y)
        const minX = Math.min(...xs), minY = Math.min(...ys)
        const maxX = Math.max(...xs), maxY = Math.max(...ys)
        const pad = 8
        const w = Math.max(60, maxX - minX + pad * 2)
        const h = Math.max(60, maxY - minY + pad * 2)
        const d = 'M' + points.map((pt) => `${(pt.x - minX + pad).toFixed(1)},${(pt.y - minY + pad).toFixed(1)}`).join(' L')
        onAddCard(minX - pad, minY - pad, 'DRAW', d, toolColor, w, h)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      return
    }

    // Non-select modes: single-click handled by onClick, skip rubber band
    if (toolMode !== 'select') return

    // ── Rubber band selection ──
    const origin = toCanvas(e.clientX, e.clientY)
    let rb: { x: number; y: number; w: number; h: number } | null = null

    function onMove(ev: MouseEvent) {
      const p = toCanvas(ev.clientX, ev.clientY)
      rb = { x: Math.min(origin.x, p.x), y: Math.min(origin.y, p.y), w: Math.abs(p.x - origin.x), h: Math.abs(p.y - origin.y) }
      const el = rbDomRef.current
      if (el) {
        if (rb.w > 3 || rb.h > 3) {
          el.style.display = 'block'
          el.style.left = `${rb.x}px`; el.style.top = `${rb.y}px`
          el.style.width = `${rb.w}px`; el.style.height = `${rb.h}px`
        } else { el.style.display = 'none' }
      }
    }
    function onUp() {
      if (rbDomRef.current) rbDomRef.current.style.display = 'none'
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (rb && (rb.w > 5 || rb.h > 5)) {
        onSelectCards(new Set(cards.filter((c) =>
          c.posX + c.width > rb!.x && c.posX < rb!.x + rb!.w &&
          c.posY + c.height > rb!.y && c.posY < rb!.y + rb!.h
        ).map((c) => c.id)))
      } else {
        onSelectCards(new Set())
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Canvas click (for tool placement) ───────────────────────────────────────
  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement) !== e.currentTarget) return
    if (toolMode === 'select' || toolMode === 'draw') return

    const p = toCanvas(e.clientX, e.clientY)

    if (toolMode === 'text') {
      onAddCard(p.x - 80, p.y - 14, 'LABEL', '', '#374151', 160, 28)
    } else if (toolMode === 'sticky') {
      onAddCard(p.x - 96, p.y - 64, 'TEXT', '', toolColor)
    } else if (toolMode === 'rect' || toolMode === 'circle' || toolMode === 'diamond' || toolMode === 'triangle') {
      onAddCard(p.x - 75, p.y - 75, 'SHAPE', `${toolMode}|${toolStroke}|${toolFill}|${toolOpacity}`, toolColor, 150, 150)
    } else if (toolMode === 'link') {
      setLinkPopover({ screenX: e.clientX, screenY: e.clientY, canvasX: p.x - 100, canvasY: p.y - 36 })
    }
  }

  // ── Double-click: create text card (select mode only) ───────────────────────
  function handleCanvasDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (toolMode !== 'select') return
    if ((e.target as HTMLElement) !== e.currentTarget) return
    const p = toCanvas(e.clientX, e.clientY)
    onAddCard(p.x - 96, p.y - 64)
  }

  // ── Link confirmation ────────────────────────────────────────────────────────
  function confirmLink() {
    if (!linkPopover || !linkUrl.trim()) { setLinkPopover(null); setLinkUrl(''); return }
    const url = linkUrl.trim().startsWith('http') ? linkUrl.trim() : `https://${linkUrl.trim()}`
    onAddCard(linkPopover.canvasX, linkPopover.canvasY, 'LINK', url, '#EFF6FF', 200, 80)
    setLinkPopover(null)
    setLinkUrl('')
  }

  function handleSelect(id: string, add: boolean) {
    if (add) {
      const next = new Set(selectedIds)
      next.has(id) ? next.delete(id) : next.add(id)
      onSelectCards(next)
    } else {
      onSelectCards(new Set([id]))
    }
  }

  const detailCard = detailCardId ? cards.find((c) => c.id === detailCardId) ?? null : null
  const zoom = viewport.zoom

  const canvasCursor = toolMode === 'draw' ? 'crosshair' : toolMode !== 'select' ? 'cell' : 'default'

  return (
    <>
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden select-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
          backgroundSize: `${DOT_SPACING}px ${DOT_SPACING}px`,
          cursor: canvasCursor,
        }}
        onMouseDown={handleCanvasMouseDown}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
      >
        {/* ── Transformed infinite canvas ── */}
        <div
          ref={canvasRef}
          style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', willChange: 'transform' }}
        >
          {frames.map((frame) => (
            <FrameItem
              key={frame.id}
              frame={frame}
              cards={cards}
              zoom={zoom}
              onMove={onMoveFrame}
              onResize={onResizeFrame}
              onUpdate={onUpdateFrame}
              onDelete={onDeleteFrame}
            />
          ))}

          {/* SVG: drawing path only */}
          <svg style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'visible', pointerEvents: 'none' }}>
            <path ref={drawingPathRef} fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'none' }} />
          </svg>

          {/* Rubber band */}
          <div
            ref={rbDomRef}
            style={{ position: 'absolute', display: 'none', border: '1px solid #818cf8', background: 'rgba(99,102,241,0.08)', borderRadius: 3, pointerEvents: 'none' }}
          />

          {cards.map((card) => (
            <BoardCard
              key={card.id}
              card={card}
              fields={fields}
              zoom={zoom}
              isSelected={selectedIds.has(card.id)}
              groupColor={card.groupId ? groupColor(card.groupId) : undefined}
              onMove={onMoveCard}
              onUpdate={onUpdateCard}
              onRecolor={onRecolorCard}
              onDelete={onDeleteCard}
              onResize={onResizeCard}
              onSelect={handleSelect}
              onOpenDetail={setDetailCardId}
            />
          ))}
        </div>

        {/* Zoom indicator */}
        {Math.abs(zoom - 1) > 0.05 && (
          <div className="absolute bottom-4 right-6 text-xs font-mono text-gray-400 bg-white/80 dark:bg-gray-900/80 px-2 py-1 rounded-lg shadow pointer-events-none select-none">
            {Math.round(zoom * 100)}%
          </div>
        )}
      </div>

      {/* ── Link URL popover ── */}
      {linkPopover && (
        <div
          style={{ position: 'fixed', left: linkPopover.screenX - 8, top: linkPopover.screenY - 8, zIndex: 200 }}
          className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 flex flex-col gap-3 w-72"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className="text-sm font-semibold text-gray-800">Ajouter un lien</p>
          <input
            autoFocus
            type="url"
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmLink()
              if (e.key === 'Escape') { setLinkPopover(null); setLinkUrl('') }
            }}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setLinkPopover(null); setLinkUrl('') }}
              className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={confirmLink}
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}

      {detailCard && (
        <CardDetailModal
          card={detailCard}
          fields={fields}
          onUpdateCard={onUpdateCard}
          onRecolorCard={onRecolorCard}
          onSetFieldValue={onSetFieldValue}
          onClearFieldValue={onClearFieldValue}
          onClose={() => setDetailCardId(null)}
        />
      )}
    </>
  )
}
