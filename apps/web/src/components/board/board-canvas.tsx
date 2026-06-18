'use client'

import { useRef, useState, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react'
import type { Card, Frame, BoardField, Connection, VoteSession, ClipboardCard } from '@/hooks/useBoard'
import { groupColor } from '@/hooks/useBoard'
import { BoardCard } from './board-card'
import { FrameItem } from './frame-item'
import { CardDetailModal } from './card-detail-modal'
import { ConnectionLine } from './connection-line'
import { ConnectionToolbar } from './connection-toolbar'
import type { ConnectionPatch } from '@/hooks/useBoard'
import type { ToolMode, StrokeSize } from './floating-toolbar'
import { serializeTable, parseClipboardTable } from '@/lib/table-clipboard'

type ClipCard = ClipboardCard

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
  isReadonly?: boolean
  onAddCard: (x: number, y: number, type?: string, content?: string, color?: string, width?: number, height?: number) => void
  onMoveCard: (id: string, x: number, y: number) => void
  onResizeCard: (id: string, w: number, h: number) => void
  onResizeCardBox: (id: string, box: { posX: number; posY: number; width: number; height: number }) => void
  onUpdateCard: (id: string, content: string) => void
  onRecolorCard: (id: string, color: string) => void
  onDeleteCard: (id: string) => void
  onSelectCards: (ids: Set<string>) => void
  onAddConnection: (fromId: string, toId: string) => void
  onDeleteConnection: (id: string) => void
  onUpdateConnection: (id: string, patch: ConnectionPatch) => void
  onMoveFrame: (id: string, posX: number, posY: number, capturedCards: { id: string; startX: number; startY: number; frameStartX: number; frameStartY: number }[]) => void
  onStartDragFrame: (id: string, capturedCardIds: string[]) => void
  onCommitDragFrame: (id: string) => void
  onResizeFrameBox: (id: string, posX: number, posY: number, w: number, h: number) => void
  onStartResizeFrame: (id: string) => void
  onCommitResizeFrame: (id: string) => void
  onUpdateFrame: (id: string, title: string) => void
  onSetFrameActive: (id: string, active: boolean) => void
  onDeleteFrame: (id: string) => void
  onStartDragCard: (id: string) => void
  onCommitDragCard: (id: string) => void
  onStartResizeCard: (id: string) => void
  onCommitResizeCard: (id: string) => void
  onSetFieldValue: (cardId: string, fieldId: string, value: string) => void
  onClearFieldValue: (cardId: string, fieldId: string) => void
  onExitLinkCardsMode?: () => void
  onPasteCards: (clipboard: ClipCard[], canvasX: number, canvasY: number) => void
  voteSession?: VoteSession | null
  voteCanVote?: boolean
  currentUserId?: string
  onCastVote?: (cardId: string) => void
  onUncastVote?: (cardId: string) => void
  onSetCardLocked?: (id: string, locked: boolean) => void
  consumeAutoEdit?: (cardId: string) => boolean
  remoteEditors?: Map<string, { userId: string; name: string }>
  onEditingChange?: (cardId: string, editing: boolean) => void
  onSetFrameLayer?: (id: string, layer: number) => void
  boardName?: string
  highlightedGroupId?: string | null
  cursors?: Map<string, { name: string; avatar: string | null; x: number; y: number; ts: number }>
  onCursorMove?: (x: number, y: number) => void
  // Aimantation : grille (snap sur multiples de DOT_SPACING) et guides d'alignement
  // intelligents (bords/centres des cartes voisines). Mutuellement exclusifs (grille prioritaire).
  snapToGrid?: boolean
  alignGuides?: boolean
}

export interface BoardCanvasHandle {
  fitToContent: () => void
  exportPdf: () => Promise<void>
  exportImage: () => Promise<void>
}

const MIN_ZOOM = 0.1
const MAX_ZOOM = 3
const DOT_SPACING = 24
const ALIGN_SNAP_PX = 6 // tolérance d'aimantation des guides, en pixels écran
// Below this card count everything is mounted; above it, offscreen cards are
// skipped (virtualization) to keep heavy boards fluid.
const VIRTUALIZE_THRESHOLD = 100

// ── Guides d'alignement intelligents ──────────────────────────────────────────
interface Guide { axis: 'v' | 'h'; pos: number; from: number; to: number }

// Aligne la carte déplacée (position proposée x,y) sur les bords/centres des autres
// cartes, dans une tolérance (coords canvas). Renvoie la position aimantée + les
// lignes-guides à dessiner (au plus une verticale + une horizontale).
function computeAlignment(
  card: { width: number; height: number }, x: number, y: number,
  others: Card[], threshold: number,
): { x: number; y: number; guides: Guide[] } {
  const w = card.width, h = card.height
  const vSelf = [x, x + w / 2, x + w] // gauche, centre, droite
  const hSelf = [y, y + h / 2, y + h] // haut, milieu, bas
  let bestV: { d: number; pos: number; shift: number } | null = null
  let bestH: { d: number; pos: number; shift: number } | null = null
  let vTarget: Card | null = null, hTarget: Card | null = null

  for (const o of others) {
    const vO = [o.posX, o.posX + o.width / 2, o.posX + o.width]
    const hO = [o.posY, o.posY + o.height / 2, o.posY + o.height]
    for (let i = 0; i < 3; i++) {
      for (const ov of vO) {
        const d = Math.abs(vSelf[i] - ov)
        if (d <= threshold && (!bestV || d < bestV.d)) { bestV = { d, pos: ov, shift: ov - vSelf[i] }; vTarget = o }
      }
      for (const oh of hO) {
        const d = Math.abs(hSelf[i] - oh)
        if (d <= threshold && (!bestH || d < bestH.d)) { bestH = { d, pos: oh, shift: oh - hSelf[i] }; hTarget = o }
      }
    }
  }

  const nx = bestV ? x + bestV.shift : x
  const ny = bestH ? y + bestH.shift : y
  const guides: Guide[] = []
  if (bestV && vTarget) guides.push({ axis: 'v', pos: bestV.pos, from: Math.min(ny, vTarget.posY), to: Math.max(ny + h, vTarget.posY + vTarget.height) })
  if (bestH && hTarget) guides.push({ axis: 'h', pos: bestH.pos, from: Math.min(nx, hTarget.posX), to: Math.max(nx + w, hTarget.posX + hTarget.width) })
  return { x: nx, y: ny, guides }
}

// Returns a referentially-stable function that always calls the latest `fn`.
// Lets BoardCard stay memoized even though parent handlers are recreated on
// every render (and avoids stale closures over changing state).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useStableHandler<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn)
  ref.current = fn
  return useCallback(((...args: Parameters<T>) => ref.current(...args)) as T, [])
}

// Custom cursors (white fill + black outline) so the pointer/hand stay visible on the
// light canvas even when the OS cursor theme is white.
function svgCursor(svg: string, hotX: number, hotY: number, fallback: string) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotX} ${hotY}, ${fallback}`
}
const ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M5 3l14 9-7 1-4 7L5 3z" fill="white" stroke="black" stroke-width="1.6" stroke-linejoin="round"/></svg>`
const HAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24"><path d="M7 11.5V6a1.5 1.5 0 013 0m0 0v-.5a1.5 1.5 0 013 0V6m0 0a1.5 1.5 0 013 0v1.5m0 0a1.5 1.5 0 013 0V14a6 6 0 01-6 6h-2.5a6 6 0 01-4.243-1.757l-3-3a1.5 1.5 0 012.122-2.122L10 14.5" fill="white" stroke="black" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const CURSOR_ARROW = svgCursor(ARROW_SVG, 5, 3, 'default')
const CURSOR_HAND = svgCursor(HAND_SVG, 12, 11, 'grab')

export const BoardCanvas = forwardRef<BoardCanvasHandle, Props>(function BoardCanvas({
  cards, connections, frames, fields, selectedIds, toolMode, toolColor, toolStroke, toolFill, toolOpacity,
  clipboard, isReadonly,
  onAddCard, onMoveCard, onResizeCard, onResizeCardBox, onUpdateCard, onRecolorCard, onDeleteCard,
  onStartDragCard, onCommitDragCard, onStartResizeCard, onCommitResizeCard,
  onSelectCards, onAddConnection, onDeleteConnection, onUpdateConnection,
  onMoveFrame, onStartDragFrame, onCommitDragFrame,
  onResizeFrameBox, onStartResizeFrame, onCommitResizeFrame,
  onUpdateFrame, onSetFrameActive, onDeleteFrame,
  onSetFieldValue, onClearFieldValue, onExitLinkCardsMode, onPasteCards,
  voteSession, voteCanVote = true, currentUserId, onCastVote, onUncastVote, onSetCardLocked, consumeAutoEdit, remoteEditors, onEditingChange,
  onSetFrameLayer,
  boardName, highlightedGroupId,
  cursors, onCursorMove,
  snapToGrid = false, alignGuides: alignGuidesEnabled = true,
}: Props, ref) {
  // ── Refs ────────────────────────────────────────────────────────────────────
  const containerRef     = useRef<HTMLDivElement>(null)
  const canvasRef        = useRef<HTMLDivElement>(null)
  const rbDomRef         = useRef<HTMLDivElement>(null)
  const drawingPathRef   = useRef<SVGPathElement>(null)
  const connectGhostRef  = useRef<SVGLineElement>(null)
  const connectionsSvgRef = useRef<SVGSVGElement>(null)
  const mousePosRef      = useRef({ x: 0, y: 0 })
  const didAutoFitRef    = useRef(false)

  // Live viewport — updated every frame via direct DOM manipulation (no React re-render)
  const vpRef = useRef({ x: 0, y: 0, zoom: 1 })
  // React state — synced after interactions end so children receive correct zoom
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 })
  // Board content stays hidden until the opening auto-fit has settled, so the user
  // never sees the pre-fit/settling zoom changes — it just fades in already framed.
  const [viewReady, setViewReady] = useState(false)

  const [detailCardId, setDetailCardId] = useState<string | null>(null)

  // Hold Space to temporarily pan with left-drag, whatever the active tool.
  const [spaceHeld, setSpaceHeld] = useState(false)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      const t = e.target as HTMLElement
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable) return
      e.preventDefault()
      setSpaceHeld(true)
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    function reset() { setSpaceHeld(false) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', reset)
    }
  }, [])

  // Link popover (URL link)
  const [linkPopover, setLinkPopover] = useState<{ screenX: number; screenY: number; canvasX: number; canvasY: number } | null>(null)
  const [linkUrl, setLinkUrl] = useState('')

  // Click-click card linking
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null)

  // Selected connection (shows the contextual connection toolbar)
  const [selectedConnId, setSelectedConnId] = useState<string | null>(null)
  function handleSelectConnection(id: string) {
    setSelectedConnId(id)
    onSelectCards(new Set())
  }
  // Escape clears the connection selection (ignored while typing the label).
  useEffect(() => {
    if (!selectedConnId) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      const t = e.target as HTMLElement
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return
      setSelectedConnId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedConnId])
  // #111 — changer d'outil ferme la barre contextuelle de connexion (sa palette de
  // couleur incluse), comme la sélection de cartes est vidée au changement d'outil.
  useEffect(() => {
    setSelectedConnId(null)
  }, [toolMode])

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
  // will-change: transform is only set while a pan/zoom gesture is running.
  // Left on permanently, the browser keeps a rasterized texture of the canvas
  // and rescales that bitmap — blurry when zoomed out. Dropping the hint after
  // the gesture forces a crisp re-rasterization at the final scale.
  const wcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function bumpWillChange() {
    if (canvasRef.current) canvasRef.current.style.willChange = 'transform'
    if (wcTimerRef.current) clearTimeout(wcTimerRef.current)
    wcTimerRef.current = setTimeout(() => {
      if (canvasRef.current) canvasRef.current.style.willChange = 'auto'
    }, 250)
  }

  function applyTransform(vp: { x: number; y: number; zoom: number }) {
    vpRef.current = vp
    bumpWillChange()
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

  // Drag the viewport — shared by the middle-mouse button and the hand/pan tool.
  function startPan(clientX: number, clientY: number) {
    const el = containerRef.current
    if (!el) return
    const ox = clientX - vpRef.current.x
    const oy = clientY - vpRef.current.y
    el.style.cursor = CURSOR_HAND
    // Throttled state sync so virtualization mounts incoming cards during the
    // pan instead of only at mouseup.
    let lastSync = 0
    function onMove(ev: MouseEvent) {
      applyTransform({ ...vpRef.current, x: ev.clientX - ox, y: ev.clientY - oy })
      const now = performance.now()
      if (now - lastSync > 150) {
        lastSync = now
        setViewport({ ...vpRef.current })
      }
    }
    function onUp() {
      el!.style.cursor = ''
      setViewport({ ...vpRef.current })
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Middle-mouse pan ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current!
    function onDown(e: MouseEvent) {
      if (e.button !== 1) return
      e.preventDefault()
      startPan(e.clientX, e.clientY)
    }
    el.addEventListener('mousedown', onDown)
    return () => el.removeEventListener('mousedown', onDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Scroll-wheel zoom (toward cursor) ────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current!
    let timer: ReturnType<typeof setTimeout>
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const { x, y, zoom } = vpRef.current
      // Trackpad pinch (and Ctrl/⌘+wheel) sends a much larger per-event delta than a
      // mouse-wheel notch, so it gets its own base step. Exponential stepping keeps the
      // zoom geometric and can never overshoot into negative scale on a hard pinch.
      const base = e.ctrlKey || e.metaKey ? 0.01 : 0.0008
      // Above 100% the same ratio feels too fast, so we damp the step the further we zoom in.
      const damp = zoom > 1 ? 1 / Math.sqrt(zoom) : 1
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * Math.exp(-e.deltaY * base * damp)))
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
  const onCursorMoveRef = useRef(onCursorMove)
  onCursorMoveRef.current = onCursorMove
  useEffect(() => {
    const el = containerRef.current!
    function onMove(e: MouseEvent) {
      const rect = el.getBoundingClientRect()
      const { x, y, zoom } = vpRef.current
      const cx = (e.clientX - rect.left - x) / zoom
      const cy = (e.clientY - rect.top - y) / zoom
      mousePosRef.current = { x: cx, y: cy }
      onCursorMoveRef.current?.(cx, cy)
    }
    el.addEventListener('mousemove', onMove)
    return () => el.removeEventListener('mousemove', onMove)
  }, [])

  // ── Ctrl+V: paste clipboard cards at cursor ───────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isReadonly) return
      if (!((e.ctrlKey || e.metaKey) && e.key === 'v')) return
      if (clipboard.length === 0) return
      e.preventDefault()
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      onPasteCards(clipboard, mousePosRef.current.x, mousePosRef.current.y)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clipboard, isReadonly, onPasteCards])

  // ── Paste from system clipboard (text or image) ─────────────────────────────
  // Refs gardent les valeurs courantes sans ré-attacher le listener window à
  // chaque rendu (sinon une mutation de carte ré-abonne 'paste' en permanence).
  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds
  const cardsRef = useRef(cards)
  cardsRef.current = cards
  const onUpdateCardRef = useRef(onUpdateCard)
  onUpdateCardRef.current = onUpdateCard
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (isReadonly) return
      // Board clipboard takes priority — if it has content, Ctrl+V is handled by keydown
      if (clipboard.length > 0) return
      const active = document.activeElement
      const inEditable = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active as HTMLElement)?.isContentEditable

      // Collage de données tabulaires multi-cellules dans une cellule de TABLE
      // focalisée : on remplit la grille au lieu de laisser le collage natif
      // tout déverser dans la seule cellule active.
      if (inEditable && active instanceof HTMLElement) {
        const host = active.closest('[data-card-id]')
        const id = host?.getAttribute('data-card-id')
        const target = id ? cardsRef.current.find((c) => c.id === id) : undefined
        if (target?.type === 'TABLE') {
          const rows = parseClipboardTable(
            e.clipboardData?.getData('text/html'),
            e.clipboardData?.getData('text/plain'),
          )
          if (rows && (rows.length > 1 || rows[0].length > 1)) {
            e.preventDefault()
            active.blur()
            onUpdateCardRef.current(target.id, serializeTable(rows))
            return
          }
        }
      }
      if (inEditable) return

      const items = e.clipboardData?.items
      if (!items) return

      // Image takes priority
      for (const item of Array.from(items)) {
        if (!item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue
        e.preventDefault()
        const reader = new FileReader()
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string
          const img = new Image()
          img.onload = () => {
            const MAX_W = 700, MAX_H = 600
            const ratio = Math.min(MAX_W / img.naturalWidth, MAX_H / img.naturalHeight, 1)
            const w = Math.round(img.naturalWidth * ratio)
            const h = Math.round(img.naturalHeight * ratio)
            const pos = mousePosRef.current
            onAddCard(pos.x - w / 2, pos.y - h / 2, 'IMAGE', dataUrl, 'transparent', w, h)
          }
          img.src = dataUrl
        }
        reader.readAsDataURL(file)
        return
      }

      // Tabular data (Excel / Google Sheets / web tables) → TABLE card
      const html = e.clipboardData?.getData('text/html')
      const rawText = e.clipboardData?.getData('text/plain')
      const tableRows = parseClipboardTable(html, rawText)
      if (tableRows) {
        e.preventDefault()
        // Si une (et une seule) carte TABLE est sélectionnée → on la remplit au
        // lieu d'en créer une nouvelle.
        const sel = selectedIdsRef.current
        if (sel.size === 1) {
          const id = [...sel][0]
          const target = cardsRef.current.find((c) => c.id === id)
          if (target?.type === 'TABLE') {
            onUpdateCardRef.current(id, serializeTable(tableRows))
            return
          }
        }
        const cols = tableRows[0].length
        const w = Math.min(720, Math.max(180, cols * 120))
        const h = Math.min(600, 16 + tableRows.length * 30)
        const pos = mousePosRef.current
        onAddCard(pos.x - w / 2, pos.y - h / 2, 'TABLE', serializeTable(tableRows), '#E0E7FF', w, h)
        return
      }

      // Plain text
      const text = rawText?.trim()
      if (!text) return
      e.preventDefault()
      const pos = mousePosRef.current
      onAddCard(pos.x - 96, pos.y - 64, 'TEXT', text)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [isReadonly, onAddCard, clipboard])

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
    setSelectedConnId(null)
    if (isReadonly) return

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
    if (isReadonly) return
    if ((e.target as HTMLElement) !== e.currentTarget) return
    if (toolMode === 'select' || toolMode === 'draw' || toolMode === 'link-cards') return

    const p = toCanvas(e.clientX, e.clientY)

    if (toolMode === 'text') {
      onAddCard(p.x - 80, p.y - 14, 'LABEL', '', '#374151', 160, 28)
    } else if (toolMode === 'sticky') {
      onAddCard(p.x - 96, p.y - 64, 'TEXT', '', toolColor)
    } else if (toolMode === 'table') {
      onAddCard(p.x - 180, p.y - 60, 'TABLE', serializeTable([['', '', ''], ['', '', ''], ['', '', '']]), '#E0E7FF', 360, 124)
    } else if (toolMode === 'rect' || toolMode === 'circle' || toolMode === 'diamond' || toolMode === 'triangle' || toolMode === 'line' || toolMode === 'star') {
      onAddCard(p.x - 75, p.y - 75, 'SHAPE', `${toolMode}|${toolStroke}|${toolFill}|${toolOpacity}`, toolColor, 150, 150)
    } else if (toolMode === 'link') {
      setLinkPopover({ screenX: e.clientX, screenY: e.clientY, canvasX: p.x - 100, canvasY: p.y - 36 })
    }
  }

  // ── Double-click: create text card (select mode only) ───────────────────────
  function handleCanvasDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (isReadonly) return
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

  // ── Fit / auto-center ─────────────────────────────────────────────────────────
  // Bounding box (canvas coords) of a set of positioned items, or null when empty.
  function boundsOf(items: { posX: number; posY: number; width: number; height: number }[]) {
    if (items.length === 0) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const it of items) {
      minX = Math.min(minX, it.posX)
      minY = Math.min(minY, it.posY)
      maxX = Math.max(maxX, it.posX + it.width)
      maxY = Math.max(maxY, it.posY + it.height)
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
  }

  // Center a canvas-space box in the viewport, scaled to fit with padding.
  function fitBox(box: { minX: number; minY: number; w: number; h: number } | null, maxZoom = 1) {
    const el = containerRef.current
    if (!el || !box || box.w <= 0 || box.h <= 0) return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const pad = 64
    const fit = Math.min((rect.width - pad * 2) / box.w, (rect.height - pad * 2) / box.h)
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(fit, maxZoom)))
    const cx = box.minX + box.w / 2
    const cy = box.minY + box.h / 2
    applyTransform({ x: rect.width / 2 - cx * zoom, y: rect.height / 2 - cy * zoom, zoom })
    setViewport({ ...vpRef.current })
  }

  // Frame down to all content; never zooms past 100% so a small board stays readable.
  function fitToContent() {
    fitBox(boundsOf([...cards, ...frames]), 1)
  }

  // Frame the current selection; may zoom in (up to 150%) to fill the viewport.
  function fitToSelection() {
    fitBox(boundsOf(cards.filter((c) => selectedIds.has(c.id))), 1.5)
  }

  // "Ajuster" button: zoom to the selection if there is one, otherwise to all content.
  function handleFit() {
    if (selectedIds.size > 0) fitToSelection()
    else fitToContent()
  }

  // Disarm auto-fit shortly after mount: if the board is still empty by then, a card the
  // user adds later shouldn't yank the viewport. Only an initial load fits automatically.
  useEffect(() => {
    const t = setTimeout(() => { didAutoFitRef.current = true }, 2000)
    return () => clearTimeout(t)
  }, [])

  // Auto-center on the whole board the first time content is available, landing on
  // the exact same view as the "fit" button. The initial layout can take a few frames
  // to settle (and transiently mis-measure the container), so we re-fit as it settles
  // — on every container resize and once more after a short grace delay — all while
  // the content is hidden, then fade it in. The user never sees the zoom adjusting:
  // the board simply appears already framed, identical to a manual fit.
  useEffect(() => {
    if (didAutoFitRef.current) { setViewReady(true); return }
    const el = containerRef.current
    if ((cards.length === 0 && frames.length === 0) || !el) {
      // Nothing to frame — reveal so an empty board (and later-added cards) stay visible.
      setViewReady(true)
      return
    }

    let raf = 0
    const fit = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => requestAnimationFrame(() => { if (!didAutoFitRef.current) fitToContent() }))
    }
    fit()                                              // first frame
    const ro = new ResizeObserver(fit)                 // re-fit as the container settles/resizes
    ro.observe(el)
    const reveal = setTimeout(() => setViewReady(true), 220) // fade in once settled

    return () => { cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(reveal) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length, frames.length])

  // ── Shared DOM-capture helper (board → HTMLCanvasElement) ────────────────────
  async function withCapture<T>(fn: (shot: HTMLCanvasElement) => Promise<T>): Promise<T | undefined> {
    const canvasEl = canvasRef.current
    const svg = connectionsSvgRef.current
    if (!canvasEl) return
    const box = boundsOf([...cards, ...frames])
    if (!box) return

    // modern-screenshot renders via SVG foreignObject — Tailwind oklch() works fine.
    const { domToCanvas } = await import('modern-screenshot')

    const savedTransform = canvasEl.style.transform
    const savedWidth     = canvasEl.style.width
    const savedHeight    = canvasEl.style.height
    const savedOverflow  = canvasEl.style.overflow
    const savedSvg = svg
      ? { left: svg.style.left, top: svg.style.top, width: svg.style.width, height: svg.style.height, viewBox: svg.getAttribute('viewBox') }
      : null

    if (svg) {
      svg.style.left   = `${box.minX}px`
      svg.style.top    = `${box.minY}px`
      svg.style.width  = `${box.w}px`
      svg.style.height = `${box.h}px`
      svg.setAttribute('viewBox', `${box.minX} ${box.minY} ${box.w} ${box.h}`)
    }
    // NOTE: overflow stays 'visible'. The captured node is offset via transform so the
    // target rect's top-left sits at the node origin; modern-screenshot's SVG viewport
    // (viewBox 0 0 box.w box.h) then clips in OUTPUT space. Using overflow:hidden here
    // would instead clip children in the node's LOCAL (pre-transform) space — dropping
    // everything whose posX exceeds box.w, i.e. a blank export whenever box.minX > 0.
    canvasEl.style.transform = `translate(${-box.minX}px, ${-box.minY}px)`
    canvasEl.style.width     = `${box.w}px`
    canvasEl.style.height    = `${box.h}px`
    canvasEl.style.overflow  = 'visible'

    const scale = Math.min(2, Math.max(0.5, 4000 / Math.max(box.w, box.h)))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))

    try {
      const shot = await domToCanvas(canvasEl, {
        width: box.w, height: box.h, scale,
        backgroundColor: '#ffffff',
        filter: (node) => !(node instanceof HTMLElement && node.dataset.exportIgnore === 'true'),
      })
      return await fn(shot)
    } finally {
      if (svg && savedSvg) {
        svg.style.left   = savedSvg.left
        svg.style.top    = savedSvg.top
        svg.style.width  = savedSvg.width
        svg.style.height = savedSvg.height
        if (savedSvg.viewBox) svg.setAttribute('viewBox', savedSvg.viewBox)
      }
      canvasEl.style.transform = savedTransform
      canvasEl.style.width     = savedWidth
      canvasEl.style.height    = savedHeight
      canvasEl.style.overflow  = savedOverflow
      applyTransform({ ...vpRef.current })
    }
  }

  // ── PDF export ───────────────────────────────────────────────────────────────
  async function exportPdf() {
    const { jsPDF } = await import('jspdf')
    await withCapture(async (shot) => {
      const orientation = shot.width >= shot.height ? 'landscape' : 'portrait'
      const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' })
      const pw = pdf.internal.pageSize.getWidth()
      const ph = pdf.internal.pageSize.getHeight()
      const margin = 24
      const aspect = shot.width / shot.height
      let iw = pw - margin * 2
      let ih = iw / aspect
      if (ih > ph - margin * 2) { ih = ph - margin * 2; iw = ih * aspect }
      pdf.addImage(shot.toDataURL('image/png'), 'PNG', (pw - iw) / 2, (ph - ih) / 2, iw, ih)
      pdf.save(`${(boardName || 'board').replace(/[^\w-]+/g, '_')}.pdf`)
    })
  }

  // ── Image export (PNG) ───────────────────────────────────────────────────────
  async function exportImage() {
    await withCapture(async (shot) => {
      const a = document.createElement('a')
      a.download = `${(boardName || 'board').replace(/[^\w-]+/g, '_')}.png`
      a.href = shot.toDataURL('image/png')
      a.click()
    })
  }

  useImperativeHandle(ref, () => ({ fitToContent, exportPdf, exportImage }))

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
    if (isReadonly) return
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
  function handleLinkCardClick(cardId: string, additive: boolean) {
    if (isReadonly) return
    if (linkSourceId === null) {
      setLinkSourceId(cardId)
    } else if (linkSourceId === cardId) {
      setLinkSourceId(null)
    } else {
      onAddConnection(linkSourceId, cardId)
      // Ctrl/Cmd+click keeps the source selected to fan out to several cards.
      if (!additive) setLinkSourceId(null)
    }
  }

  function handleSelect(id: string, add: boolean) {
    setSelectedConnId(null)
    if (add) {
      const next = new Set(selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      onSelectCards(next)
    } else {
      onSelectCards(new Set([id]))
    }
  }

  const zoom = viewport.zoom

  // ── Perf: O(1) card lookups + stable handler identities + virtualization ─────
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const detailCard = detailCardId ? cardById.get(detailCardId) ?? null : null

  // Stable identities so the memoized BoardCard skips re-renders: without this,
  // every parent render recreates the handlers and defeats React.memo.
  // Guides d'alignement transitoires (dessinés pendant le drag d'une carte).
  const [guides, setGuides] = useState<Guide[]>([])
  const guidesRef = useRef<Guide[]>([])
  const publishGuides = (g: Guide[]) => { guidesRef.current = g; setGuides(g) }
  const clearGuides = () => { if (guidesRef.current.length) publishGuides([]) }

  // Intercepte le déplacement des cartes pour aimanter (grille ou alignement) avant
  // de propager. Écho partiel : la carte/le store mergent par id.
  const hMoveCard = useStableHandler((id: string, x: number, y: number) => {
    const c = cardById.get(id)
    if (!c) { onMoveCard(id, x, y); return }
    if (snapToGrid) {
      clearGuides()
      onMoveCard(id, Math.round(x / DOT_SPACING) * DOT_SPACING, Math.round(y / DOT_SPACING) * DOT_SPACING)
      return
    }
    if (alignGuidesEnabled && selectedIds.size <= 1) {
      const targets = cards.filter((t) => t.id !== id && t.type !== 'DRAW')
      const r = computeAlignment(c, x, y, targets, ALIGN_SNAP_PX / zoom)
      publishGuides(r.guides)
      onMoveCard(id, r.x, r.y)
      return
    }
    clearGuides()
    onMoveCard(id, x, y)
  })
  const hStartDragCard  = useStableHandler(onStartDragCard)
  const hCommitDragCard = useStableHandler((id: string) => { clearGuides(); onCommitDragCard(id) })
  const hUpdateCard     = useStableHandler(onUpdateCard)
  const hRecolorCard    = useStableHandler(onRecolorCard)
  const hDeleteCard     = useStableHandler(onDeleteCard)
  const hResizeCard     = useStableHandler(onResizeCard)
  const hResizeCardBox  = useStableHandler(onResizeCardBox)
  const hStartResize    = useStableHandler(onStartResizeCard)
  const hCommitResize   = useStableHandler(onCommitResizeCard)
  const hSetCardLocked  = useStableHandler((id: string, locked: boolean) => onSetCardLocked?.(id, locked))
  const hSelect         = useStableHandler(handleSelect)
  const hStartConnect   = useStableHandler(handleStartConnect)
  const hLinkCardsClick = useStableHandler(handleLinkCardClick)
  const hOpenDetail     = useStableHandler((id: string) => setDetailCardId(id))

  // Container size for the visibility window (virtualization).
  const [containerSize, setContainerSize] = useState({ w: 1920, h: 1080 })
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContainerSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Cards intersecting the viewport, expanded by one screen on each side so
  // panning reveals already-mounted cards. null = no virtualization (small board).
  const visibleIds = useMemo(() => {
    if (cards.length <= VIRTUALIZE_THRESHOLD) return null
    const { x, y, zoom: z } = viewport
    const vw = containerSize.w / z
    const vh = containerSize.h / z
    const x0 = -x / z - vw, y0 = -y / z - vh
    const x1 = -x / z + vw * 2, y1 = -y / z + vh * 2
    const ids = new Set<string>()
    for (const c of cards) {
      if (c.posX + c.width >= x0 && c.posX <= x1 && c.posY + c.height >= y0 && c.posY <= y1) ids.add(c.id)
    }
    return ids
  }, [cards, viewport, containerSize])

  // ── Layer rendering helpers ───────────────────────────────────────────────────
  function renderFramesForLayer(layer: number) {
    return frames.filter((f) => (f.layer ?? 1) === layer).map((frame) => (
      <FrameItem
        key={frame.id}
        frame={frame}
        cards={cards}
        zoom={zoom}
        isReadonly={isReadonly}
        onMove={onMoveFrame}
        onStartDrag={onStartDragFrame}
        onCommitDrag={onCommitDragFrame}
        onResizeBox={onResizeFrameBox}
        onStartResize={onStartResizeFrame}
        onCommitResize={onCommitResizeFrame}
        onUpdate={onUpdateFrame}
        onSetActive={onSetFrameActive}
        onDelete={onDeleteFrame}
        onSetLayer={onSetFrameLayer}
      />
    ))
  }

  function renderCardsForLayer(layer: number) {
    // Selected cards stay mounted even offscreen (keeps drag/edit state alive).
    const inWindow = (c: Card) => visibleIds === null || visibleIds.has(c.id) || selectedIds.has(c.id)
    const pool = [
      ...cards.filter((c) => c.type !== 'DRAW' && (c.layer ?? 1) === layer && inWindow(c)),
      ...cards.filter((c) => c.type === 'DRAW' && (c.layer ?? 1) === layer && inWindow(c)),
    ]
    return pool.map((card) => {
      const dimmed = !!highlightedGroupId && card.groupId !== highlightedGroupId
      return (
        <div key={card.id} style={{ opacity: dimmed ? 0.12 : 1, transition: 'opacity 0.2s', pointerEvents: dimmed ? 'none' : undefined }}>
          <BoardCard
            card={card}
            fields={fields}
            zoom={zoom}
            isSelected={selectedIds.has(card.id)}
            isMultiSelect={selectedIds.size > 1}
            groupColor={card.groupId ? (card.groupColor ?? groupColor(card.groupId)) : undefined}
            drawMode={toolMode === 'draw'}
            isReadonly={isReadonly}
            onMove={hMoveCard}
            onStartDrag={hStartDragCard}
            onCommitDrag={hCommitDragCard}
            onUpdate={hUpdateCard}
            onRecolor={hRecolorCard}
            onDelete={hDeleteCard}
            onResize={hResizeCard}
            onResizeBox={hResizeCardBox}
            onStartResize={hStartResize}
            onCommitResize={hCommitResize}
            onSelect={hSelect}
            onOpenDetail={hOpenDetail}
            onStartConnect={toolMode === 'select' ? hStartConnect : undefined}
            onSetLocked={hSetCardLocked}
            linkCardsMode={toolMode === 'link-cards'}
            isLinkSource={linkSourceId === card.id}
            onLinkCardsClick={toolMode === 'link-cards' ? hLinkCardsClick : undefined}
            consumeAutoEdit={consumeAutoEdit}
            remoteEditor={remoteEditors?.get(card.id) ?? null}
            onEditingChange={onEditingChange}
          />
        </div>
      )
    })
  }
  // Dot-grid metrics derived from the synced viewport state, so a React re-render
  // never resets the grid to an unzoomed/misaligned value behind applyTransform.
  const dotD = DOT_SPACING * viewport.zoom

  const canvasCursor =
    spaceHeld ? CURSOR_HAND :
    isReadonly ? CURSOR_ARROW :
    toolMode === 'pan' ? CURSOR_HAND :
    toolMode === 'draw' ? 'crosshair' :
    toolMode === 'link-cards' ? 'crosshair' :
    toolMode !== 'select' ? 'cell' :
    CURSOR_ARROW

  const sourceCard = linkSourceId ? cardById.get(linkSourceId) : null

  // Selected connection + its contextual toolbar position (viewport/fixed coords).
  const selConn = selectedConnId ? connections.find((c) => c.id === selectedConnId) : null
  const selConnFrom = selConn ? cardById.get(selConn.fromId) : null
  const selConnTo = selConn ? cardById.get(selConn.toId) : null
  let connToolbarPos: { left: number; top: number } | null = null
  if (selConn && selConnFrom && selConnTo && containerRef.current) {
    const rect = containerRef.current.getBoundingClientRect()
    const mcx = ((selConnFrom.posX + selConnFrom.width / 2) + (selConnTo.posX + selConnTo.width / 2)) / 2
    const mcy = ((selConnFrom.posY + selConnFrom.height / 2) + (selConnTo.posY + selConnTo.height / 2)) / 2
    connToolbarPos = { left: rect.left + viewport.x + mcx * viewport.zoom, top: rect.top + viewport.y + mcy * viewport.zoom }
  }

  return (
    <>
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden select-none"
        style={{
          // Grille active → quadrillage de lignes (repère d'aimantation) ; sinon points.
          backgroundImage: snapToGrid
            ? 'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)'
            : 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
          backgroundSize: `${dotD}px ${dotD}px`,
          backgroundPosition: `${viewport.x % dotD}px ${viewport.y % dotD}px`,
          cursor: canvasCursor,
        }}
        onMouseDown={handleCanvasMouseDown}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
      >
        {/* ── Transformed infinite canvas ── */}
        <div
          ref={canvasRef}
          style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', opacity: viewReady ? 1 : 0, transition: 'opacity 0.2s ease' }}
        >
          {/* ── Layer 0: Background ── */}
          {renderFramesForLayer(0)}
          {renderCardsForLayer(0)}

          {/* ── Layer 1: Main (default) — connections stay here ── */}
          {renderFramesForLayer(1)}

          {/* SVG: connections + connect ghost + source highlight */}
          <svg
            ref={connectionsSvgRef}
            style={{ position: 'absolute', left: -100000, top: -100000, width: 200000, height: 200000, overflow: 'visible', pointerEvents: 'none' }}
            viewBox="-100000 -100000 200000 200000"
          >
            {connections.map((conn) => {
              const from = cardById.get(conn.fromId)
              const to = cardById.get(conn.toId)
              if (!from || !to) return null
              // During group focus, dim links unless both endpoints are in the group.
              const dimmed = !!highlightedGroupId && !(from.groupId === highlightedGroupId && to.groupId === highlightedGroupId)
              return (
                <g key={conn.id} style={{ opacity: dimmed ? 0.12 : 1, transition: 'opacity 0.2s', pointerEvents: dimmed ? 'none' : undefined }}>
                  <ConnectionLine
                    conn={conn}
                    from={from}
                    to={to}
                    selected={selectedConnId === conn.id}
                    interactive={!isReadonly}
                    onSelect={handleSelectConnection}
                  />
                </g>
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

            {/* Remote cursors — rendered in canvas space so they move with the viewport.
                Stale cursors (>5s without update) are hidden — user left the window. */}
            {cursors && Array.from(cursors.entries()).filter(([uid, c]) => uid !== currentUserId && Date.now() - c.ts < 5000).map(([uid, c]) => (
              <g key={uid} style={{ pointerEvents: 'none' }}>
                <path d="M0,0 L0,16 L4.5,12.5 L7,18 L9,17 L6.5,11.5 L11,11.5 Z" fill="white" stroke={`hsl(${(uid.charCodeAt(0) * 47) % 360},70%,45%)`} strokeWidth="1.5" transform={`translate(${c.x}, ${c.y})`} />
                <rect x={c.x + 13} y={c.y + 3} width={c.name.length * 6.5 + 8} height={18} rx={4} fill={`hsl(${(uid.charCodeAt(0) * 47) % 360},70%,45%)`} />
                <text x={c.x + 17} y={c.y + 15} fontSize={11} fill="white" fontFamily="system-ui, sans-serif" style={{ userSelect: 'none' }}>{c.name}</text>
              </g>
            ))}
          </svg>

          {/* Rubber band */}
          <div
            ref={rbDomRef}
            style={{ position: 'absolute', display: 'none', border: '1px solid #818cf8', background: 'rgba(99,102,241,0.08)', borderRadius: 3, pointerEvents: 'none' }}
          />

          {renderCardsForLayer(1)}

          {/* ── Layer 2: Foreground ── */}
          {renderFramesForLayer(2)}
          {renderCardsForLayer(2)}

          {/* Guides d'alignement (pendant le drag d'une carte) — rose, fins quel que soit le zoom */}
          {guides.map((g, i) => (
            <div
              key={i}
              className="absolute pointer-events-none"
              style={g.axis === 'v'
                ? { left: g.pos, top: g.from, width: 1 / zoom, height: g.to - g.from, background: '#ec4899', zIndex: 60 }
                : { left: g.from, top: g.pos, height: 1 / zoom, width: g.to - g.from, background: '#ec4899', zIndex: 60 }}
            />
          ))}

          {/* Vote badges overlay */}
          {/* Formes et dessins exclus du vote : décoratifs, pas du contenu votable */}
          {voteSession && cards.filter((c) => c.type !== 'DRAW' && c.type !== 'SHAPE' && (visibleIds === null || visibleIds.has(c.id))).map((card) => {
            const cardVotes = voteSession.votes.filter((v) => v.cardId === card.id)
            const myVotesOnCard = cardVotes.filter((v) => v.userId === currentUserId).length
            const totalVotes = cardVotes.length
            const isEligible = currentUserId ? voteSession.voterIds.includes(currentUserId) : false
            const myTotalVotes = voteSession.votes.filter((v) => v.userId === currentUserId).length
            const canVoteMore = myTotalVotes < voteSession.votesPerPerson
            const isActive = voteSession.status === 'ACTIVE'

            if (totalVotes === 0 && !isEligible) return null

            return (
              <div
                key={`vote-${card.id}`}
                className="absolute pointer-events-none"
                style={{ left: card.posX, top: card.posY, width: card.width, height: card.height, zIndex: 50 }}
              >
                <div
                  className={`absolute ${isReadonly ? 'top-1.5' : 'top-7'} right-1.5 flex items-center gap-1 pointer-events-auto`}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  {totalVotes > 0 && (
                    <div className="flex items-center gap-0.5 bg-secondary-500 text-white rounded-full px-2 py-0.5 shadow-md">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                      </svg>
                      <span className="text-[10px] font-bold tabular-nums">{totalVotes}</span>
                    </div>
                  )}
                  {isEligible && isActive && (
                    voteCanVote ? (
                      myVotesOnCard > 0 ? (
                        <button
                          onClick={() => onUncastVote?.(card.id)}
                          className="flex items-center gap-0.5 bg-secondary-100 hover:bg-secondary-200 text-secondary-700 rounded-full px-1.5 py-0.5 shadow-sm transition-colors"
                          title="Retirer un vote"
                        >
                          <span className="text-[10px] font-bold">−{myVotesOnCard}</span>
                        </button>
                      ) : canVoteMore ? (
                        <button
                          onClick={() => onCastVote?.(card.id)}
                          className="flex items-center gap-0.5 bg-white hover:bg-secondary-50 text-secondary-500 border border-secondary-200 rounded-full px-1.5 py-0.5 shadow-sm transition-colors"
                          title="Voter pour ce post-it"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      ) : null
                    ) : (
                      <div
                        className="flex items-center gap-0.5 bg-gray-100 text-gray-400 rounded-full px-1.5 py-0.5 shadow-sm cursor-not-allowed"
                        title="Le temps de vote est écoulé"
                      >
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-5V7" />
                        </svg>
                      </div>
                    )
                  )}
                </div>
              </div>
            )
          })}

          {/* Draw mode overlay — sits above all cards, catches mousedown anywhere
              (suppressed while Space is held so the pan overlay takes over) */}
          {toolMode === 'draw' && !spaceHeld && (
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

          {/* Pan overlay — left-drag pans the board (hand tool, or while Space is held) */}
          {(toolMode === 'pan' || spaceHeld) && (
            <div
              style={{ position: 'absolute', left: -100000, top: -100000, width: 200000, height: 200000, zIndex: 160, cursor: CURSOR_HAND }}
              onMouseDown={(e) => {
                if (e.button !== 0) return
                e.preventDefault()
                e.stopPropagation()
                startPan(e.clientX, e.clientY)
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
          <div data-export-ignore="true" className="absolute top-3 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-3 pointer-events-none z-[60]">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="5" cy="12" r="2.5" />
              <circle cx="19" cy="12" r="2.5" />
              <path strokeLinecap="round" d="M7.5 12h9" />
            </svg>
            <span className="font-medium">
              {linkSourceId === null ? 'Cliquez la carte source' : 'Cliquez une carte à relier'}
            </span>
            <span className="text-xs text-primary-200">
              {linkSourceId === null ? 'Échap pour quitter' : 'Ctrl+clic : relier plusieurs · Échap'}
            </span>
          </div>
        )}

        {/* Zoom controls */}
        <div data-export-ignore="true" className="absolute bottom-4 right-6 flex items-center bg-white/95 border border-gray-200 rounded-lg shadow select-none text-xs font-mono text-gray-600">
          <button
            title={selectedIds.size > 0 ? 'Ajuster à la sélection' : 'Ajuster le board à l\'écran'}
            onClick={handleFit}
            className="px-2 py-1.5 hover:bg-gray-100 rounded-l-lg transition-colors leading-none border-r border-gray-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2m8-16h2a2 2 0 012 2v2m-4 12h2a2 2 0 002-2v-2" />
            </svg>
          </button>
          <button
            title="Dézoomer (−)"
            onClick={() => handleZoomBy(1 / 1.25)}
            className="px-2 py-1.5 hover:bg-gray-100 transition-colors leading-none"
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

      {/* ── Connection contextual toolbar ── */}
      {!isReadonly && selConn && connToolbarPos && (
        <div
          style={{ position: 'fixed', left: connToolbarPos.left, top: connToolbarPos.top, transform: 'translate(-50%, calc(-100% - 14px))', zIndex: 46 }}
        >
          <ConnectionToolbar
            conn={selConn}
            onUpdate={(patch) => onUpdateConnection(selConn.id, patch)}
            onDelete={() => { onDeleteConnection(selConn.id); setSelectedConnId(null) }}
          />
        </div>
      )}

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
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
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
              className="text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors font-medium"
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
})
