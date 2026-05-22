'use client'

import { useRef, useState, useEffect } from 'react'
import type { Card, Frame, BoardField, Connection } from '@/hooks/useBoard'
import { groupColor } from '@/hooks/useBoard'
import { BoardCard } from './board-card'
import { FrameItem } from './frame-item'
import { CardDetailModal } from './card-detail-modal'
import type { ToolMode, StrokeSize } from './floating-toolbar'

type ClipCard = Pick<Card, 'type' | 'content' | 'color' | 'posX' | 'posY' | 'width' | 'height'>

interface Props {
  cards: Card[]
  connections: Connection[]
  frames: Frame[]
  fields: BoardField[]
  selectedIds: Set<string>
  toolMode: ToolMode
  toolColor: string
  toolStroke: StrokeSize
  toolFill: boolean
  toolOpacity: number
  clipboard: ClipCard[]
  onAddCard: (x: number, y: number, type?: string, content?: string, color?: string, width?: number, height?: number) => void
  onMoveCard: (id: string, x: number, y: number) => void
  onResizeCard: (id: string, w: number, h: number) => void
  onUpdateCard: (id: string, content: string) => void
  onRecolorCard: (id: string, color: string) => void
  onDeleteCard: (id: string) => void
  onSelectCards: (ids: Set<string>) => void
  onAddConnection: (fromId: string, toId: string) => void
  onDeleteConnection: (id: string) => void
  onMoveFrame: (id: string, posX: number, posY: number, capturedCards: { id: string; startX: number; startY: number; frameStartX: number; frameStartY: number }[]) => void
  onResizeFrame: (id: string, w: number, h: number) => void
  onUpdateFrame: (id: string, title: string) => void
  onDeleteFrame: (id: string) => void
  onSetFieldValue: (cardId: string, fieldId: string, value: string) => void
  onClearFieldValue: (cardId: string, fieldId: string) => void
  onExitLinkCardsMode?: () => void
  onPasteCards: (clipboard: ClipCard[], canvasX: number, canvasY: number) => void
}

const MIN_ZOOM = 0.1
const MAX_ZOOM = 3
const DOT_SPACING = 24

export function BoardCanvas({
  cards, connections, frames, fields, selectedIds, toolMode, toolColor, toolStroke, toolFill, toolOpacity,
  clipboard,
  onAddCard, onMoveCard, onResizeCard, onUpdateCard, onRecolorCard, onDeleteCard,
  onSelectCards, onAddConnection, onDeleteConnection,
  onMoveFrame, onResizeFrame, onUpdateFrame, onDeleteFrame,
  onSetFieldValue, onClearFieldValue, onExitLinkCardsMode, onPasteCards,
}: Props) {
  // ── Refs ────────────────────────────────────────────────────────────────────
  const containerRef    = useRef<HTMLDivElement>(null)
  const canvasRef       = useRef<HTMLDivElement>(null)
  const rbDomRef        = useRef<HTMLDivElement>(null)
  const drawingPathRef  = useRef<SVGPathElement>(null)
  const connectGhostRef = useRef<SVGLineElement>(null)
  const mousePosRef     = useRef({ x: 0, y: 0 })

  // Live viewport — updated every frame via direct DOM manipulation (no React re-render)
  const vpRef = useRef({ x: 0, y: 0, zoom: 1 })
  // React state — synced after interactions end so children receive correct zoom
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 })

  const [detailCardId, setDetailCardId] = useState<string | null>(null)

  // Link popover (URL link)
  const [linkPopover, setLinkPopover] = useState<{ screenX: number; screenY: number; canvasX: number; canvasY: number } | null>(null)
  const [linkUrl, setLinkUrl] = useState('')

  // Click-click card linking
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null)

  // Reset linkSourceId whenever we leave link-cards mode
  useEffect(() => {
    if (toolMode !== 'link-cards' && linkSourceId !== null) setLinkSourceId(null)
  }, [toolMode, linkSourceId])

  // ESC: cancel link-cards source / exit mode
  useEffect(() => {
    if (toolMode !== 'link-cards') return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (linkSourceId !== null) {
        setLinkSourceId(null)
      } else {
        onExitLinkCardsMode?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toolMode, linkSourceId, onExitLinkCardsMode])

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

  // ── Track mouse position in canvas coordinates ───────────────────────────────
  useEffect(() => {
    const el = containerRef.current!
    function onMove(e: MouseEvent) {
      const rect = el.getBoundingClientRect()
      const { x, y, zoom } = vpRef.current
      mousePosRef.current = {
        x: (e.clientX - rect.left - x) / zoom,
        y: (e.clientY - rect.top - y) / zoom,
      }
    }
    el.addEventListener('mousemove', onMove)
    return () => el.removeEventListener('mousemove', onMove)
  }, [])

  // ── Ctrl+V: paste clipboard cards at cursor ───────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!((e.ctrlKey || e.metaKey) && e.key === 'v')) return
      if (clipboard.length === 0) return
      e.preventDefault()
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      onPasteCards(clipboard, mousePosRef.current.x, mousePosRef.current.y)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clipboard, onPasteCards])

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

  // ── Freehand draw (called from canvas or card bubble) ────────────────────────
  function startFreehandDraw(clientX: number, clientY: number) {
    const startP = toCanvas(clientX, clientY)
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
      if (dp) dp.setAttribute('d', 'M' + points.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' L'))
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (dp) dp.style.display = 'none'
      if (points.length < 3) return
      const xs = points.map((p) => p.x), ys = points.map((p) => p.y)
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
  }

  // ── Canvas mouse down ────────────────────────────────────────────────────────
  function handleCanvasMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return

    // Draw mode: work anywhere — cards let the event bubble when drawMode=true
    if (toolMode === 'draw') {
      e.preventDefault()
      startFreehandDraw(e.clientX, e.clientY)
      return
    }

    // Other modes: only handle direct clicks on canvas background
    if ((e.target as HTMLElement) !== e.currentTarget) return

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
    if (toolMode === 'select' || toolMode === 'draw' || toolMode === 'link-cards') return

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

  // ── Button zoom (toward canvas center) ──────────────────────────────────────
  function handleZoomBy(factor: number) {
    const { x, y, zoom } = vpRef.current
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const mx = rect.width / 2
    const my = rect.height / 2
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor))
    applyTransform({
      x: mx - (mx - x) * (newZoom / zoom),
      y: my - (my - y) * (newZoom / zoom),
      zoom: newZoom,
    })
    setViewport({ ...vpRef.current })
  }

  function handleZoomReset() {
    const { x, y, zoom } = vpRef.current
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const mx = rect.width / 2
    const my = rect.height / 2
    applyTransform({
      x: mx - (mx - x) * (1 / zoom),
      y: my - (my - y) * (1 / zoom),
      zoom: 1,
    })
    setViewport({ ...vpRef.current })
  }

  // ── Link confirmation ────────────────────────────────────────────────────────
  function confirmLink() {
    if (!linkPopover || !linkUrl.trim()) { setLinkPopover(null); setLinkUrl(''); return }
    const url = linkUrl.trim().startsWith('http') ? linkUrl.trim() : `https://${linkUrl.trim()}`
    onAddCard(linkPopover.canvasX, linkPopover.canvasY, 'LINK', url, '#EFF6FF', 200, 80)
    setLinkPopover(null)
    setLinkUrl('')
  }

  // ── Connection drag (from card handle) ───────────────────────────────────────
  function handleStartConnect(cardId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const card = cards.find((c) => c.id === cardId)
    if (!card) return
    const startX = card.posX + card.width / 2
    const startY = card.posY + card.height / 2

    const ghost = connectGhostRef.current
    if (ghost) {
      ghost.setAttribute('x1', String(startX))
      ghost.setAttribute('y1', String(startY))
      ghost.setAttribute('x2', String(startX))
      ghost.setAttribute('y2', String(startY))
      ghost.style.display = ''
    }

    function onMove(ev: MouseEvent) {
      const p = toCanvas(ev.clientX, ev.clientY)
      if (ghost) {
        ghost.setAttribute('x2', String(p.x))
        ghost.setAttribute('y2', String(p.y))
      }
    }

    function onUp(ev: MouseEvent) {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (ghost) ghost.style.display = 'none'

      const target = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const targetCardEl = target?.closest('[data-card-id]') as HTMLElement | null
      const targetId = targetCardEl?.dataset.cardId
      if (targetId && targetId !== cardId) {
        onAddConnection(cardId, targetId)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Link-cards: per-card click (called by the per-card overlay) ──────────────
  function handleLinkCardClick(cardId: string) {
    if (linkSourceId === null) {
      setLinkSourceId(cardId)
    } else if (linkSourceId === cardId) {
      setLinkSourceId(null)
    } else {
      onAddConnection(linkSourceId, cardId)
      setLinkSourceId(null)
    }
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

  const canvasCursor =
    toolMode === 'draw' ? 'crosshair' :
    toolMode === 'link-cards' ? 'crosshair' :
    toolMode !== 'select' ? 'cell' :
    'default'

  const sourceCard = linkSourceId ? cards.find((c) => c.id === linkSourceId) : null

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

          {/* SVG: connections + connect ghost + source highlight (below cards) */}
          <svg
            style={{ position: 'absolute', left: -100000, top: -100000, width: 200000, height: 200000, overflow: 'visible', pointerEvents: 'none' }}
            viewBox="-100000 -100000 200000 200000"
          >
            {connections.map((conn) => {
              const from = cards.find((c) => c.id === conn.fromId)
              const to = cards.find((c) => c.id === conn.toId)
              if (!from || !to) return null
              return (
                <ConnectionLine
                  key={conn.id}
                  id={conn.id}
                  x1={from.posX + from.width / 2}
                  y1={from.posY + from.height / 2}
                  x2={to.posX + to.width / 2}
                  y2={to.posY + to.height / 2}
                  onDelete={onDeleteConnection}
                />
              )
            })}
            <line ref={connectGhostRef} stroke="#6366f1" strokeWidth={2} strokeDasharray="6 4" strokeLinecap="round" style={{ display: 'none', pointerEvents: 'none' }} />
            {sourceCard && (
              <rect
                x={sourceCard.posX - 4}
                y={sourceCard.posY - 4}
                width={sourceCard.width + 8}
                height={sourceCard.height + 8}
                rx={14}
                fill="none"
                stroke="#6366f1"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                style={{ pointerEvents: 'none' }}
              >
                <animate attributeName="stroke-dashoffset" from="0" to="20" dur="0.6s" repeatCount="indefinite" />
              </rect>
            )}
          </svg>

          {/* Rubber band */}
          <div
            ref={rbDomRef}
            style={{ position: 'absolute', display: 'none', border: '1px solid #818cf8', background: 'rgba(99,102,241,0.08)', borderRadius: 3, pointerEvents: 'none' }}
          />

          {/* Non-DRAW cards first, then DRAW cards on top */}
          {[...cards.filter((c) => c.type !== 'DRAW'), ...cards.filter((c) => c.type === 'DRAW')].map((card) => (
            <BoardCard
              key={card.id}
              card={card}
              fields={fields}
              zoom={zoom}
              isSelected={selectedIds.has(card.id)}
              groupColor={card.groupId ? groupColor(card.groupId) : undefined}
              drawMode={toolMode === 'draw'}
              onMove={onMoveCard}
              onUpdate={onUpdateCard}
              onRecolor={onRecolorCard}
              onDelete={onDeleteCard}
              onResize={onResizeCard}
              onSelect={handleSelect}
              onOpenDetail={setDetailCardId}
              onStartConnect={toolMode === 'select' ? handleStartConnect : undefined}
              linkCardsMode={toolMode === 'link-cards'}
              isLinkSource={linkSourceId === card.id}
              onLinkCardsClick={toolMode === 'link-cards' ? handleLinkCardClick : undefined}
            />
          ))}

          {/* Draw mode overlay — sits above all cards, catches mousedown anywhere */}
          {toolMode === 'draw' && (
            <div
              style={{ position: 'absolute', left: -100000, top: -100000, width: 200000, height: 200000, zIndex: 150, cursor: 'crosshair' }}
              onMouseDown={(e) => {
                if (e.button !== 0) return
                e.preventDefault()
                e.stopPropagation()
                startFreehandDraw(e.clientX, e.clientY)
              }}
            />
          )}

          {/* Drawing preview SVG — above the overlay (zIndex 200) */}
          <svg
            style={{ position: 'absolute', left: -100000, top: -100000, width: 200000, height: 200000, overflow: 'visible', pointerEvents: 'none', zIndex: 200 }}
            viewBox="-100000 -100000 200000 200000"
          >
            <path ref={drawingPathRef} fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'none', pointerEvents: 'none' }} />
          </svg>
        </div>

        {/* Link-cards mode banner */}
        {toolMode === 'link-cards' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-3 pointer-events-none z-[60]">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="5" cy="12" r="2.5" />
              <circle cx="19" cy="12" r="2.5" />
              <path strokeLinecap="round" d="M7.5 12h9" />
            </svg>
            <span className="font-medium">
              {linkSourceId === null ? 'Cliquez la première carte' : 'Cliquez la deuxième carte'}
            </span>
            <span className="text-xs text-indigo-200">Échap pour quitter</span>
          </div>
        )}

        {/* Zoom controls */}
        <div className="absolute bottom-4 right-6 flex items-center bg-white/95 border border-gray-200 rounded-lg shadow select-none text-xs font-mono text-gray-600">
          <button
            title="Dézoomer (−)"
            onClick={() => handleZoomBy(1 / 1.25)}
            className="px-2 py-1.5 hover:bg-gray-100 rounded-l-lg transition-colors leading-none"
          >−</button>
          <button
            title="Réinitialiser le zoom (100%)"
            onClick={handleZoomReset}
            className="px-2 py-1.5 hover:bg-gray-100 transition-colors leading-none min-w-[3.5rem] text-center"
          >{Math.round(zoom * 100)}%</button>
          <button
            title="Zoomer (+)"
            onClick={() => handleZoomBy(1.25)}
            className="px-2 py-1.5 hover:bg-gray-100 rounded-r-lg transition-colors leading-none"
          >+</button>
        </div>
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

// ── Connection line with hover-delete ─────────────────────────────────────────
function ConnectionLine({ id, x1, y1, x2, y2, onDelete }: {
  id: string; x1: number; y1: number; x2: number; y2: number; onDelete: (id: string) => void
}) {
  const [hover, setHover] = useState(false)
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return (
    <g onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {/* Wide invisible hit-area */}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={16} style={{ pointerEvents: 'stroke', cursor: 'pointer' }} />
      {/* Visible line */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={hover ? '#6366f1' : '#9ca3af'}
        strokeWidth={hover ? 2.5 : 2}
        strokeLinecap="round"
        style={{ pointerEvents: 'none' }}
      />
      {hover && (
        <g style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onDelete(id) }}>
          <circle cx={mx} cy={my} r={10} fill="white" stroke="#ef4444" strokeWidth={1.5} />
          <path
            d={`M${mx - 3.5},${my - 3.5} L${mx + 3.5},${my + 3.5} M${mx + 3.5},${my - 3.5} L${mx - 3.5},${my + 3.5}`}
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  )
}
