'use client'

import { useState, useRef, useEffect, useLayoutEffect, forwardRef } from 'react'
import { ColorPicker } from '@/components/ui/color-picker'
import { DEFAULT_CARD_COLOR, DEFAULT_SHAPE_COLOR } from '@/lib/colors'
import { useFlag } from '@/store/flags'

export type ToolMode = 'select' | 'pan' | 'text' | 'sticky' | 'table' | 'rect' | 'circle' | 'diamond' | 'triangle' | 'line' | 'star' | 'draw' | 'link' | 'link-cards'
export type StrokeSize = 'thin' | 'medium' | 'thick'

interface Props {
  toolMode: ToolMode
  toolColor: string
  toolStroke: StrokeSize
  toolFill: boolean
  toolOpacity: number
  minTop?: number
  onToolChange: (tool: ToolMode, color?: string, stroke?: StrokeSize, fill?: boolean, opacity?: number) => void
  onAddFrame?: () => void
  frameLimitReached?: boolean
  // #109 — fonctionnalité « dessin » désactivable dans les paramètres du board.
  drawingEnabled?: boolean
  // Aimantation : grille + guides d'alignement
  snapToGrid?: boolean
  alignGuides?: boolean
  onToggleGrid?: () => void
  onToggleAlign?: () => void
}

const TOOLBAR_W = 48
const GAP = 8

type ShapeMode = 'rect' | 'circle' | 'diamond' | 'triangle' | 'line' | 'star'
const SHAPES: ShapeMode[] = ['rect', 'circle', 'diamond', 'triangle', 'line', 'star']
const SHAPE_LABELS: Record<ShapeMode, string> = { rect: 'Rectangle', circle: 'Cercle', diamond: 'Losange', triangle: 'Triangle', line: 'Trait', star: 'Étoile' }

// Inner SVG for a shape glyph, reused by the toolbar button and the shape picker.
function ShapeGlyph({ mode }: { mode: ShapeMode }) {
  switch (mode) {
    case 'rect':     return <rect x="4" y="6" width="16" height="12" rx="2" />
    case 'circle':   return <circle cx="12" cy="12" r="8" />
    case 'diamond':  return <polygon points="12,3 21,12 12,21 3,12" />
    case 'triangle': return <polygon points="12,4 22,20 2,20" />
    case 'line':     return <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
    case 'star':     return <polygon points="12,2 14.6,8.8 22,9.2 16.2,13.9 18.2,21 12,16.9 5.8,21 7.8,13.9 2,9.2 9.4,8.8" />
  }
}

export function FloatingToolbar({ toolMode, toolColor, toolStroke, toolFill, toolOpacity, minTop, onToolChange, onAddFrame, frameLimitReached, drawingEnabled = true, snapToGrid, alignGuides, onToggleGrid, onToggleAlign }: Props) {
  const MIN_Y = minTop ?? 120
  const tablesEnabled = useFlag('board.tables')
  const [pos, setPos] = useState({ x: 16, y: MIN_Y })
  const [collapsed, setCollapsed] = useState(false)
  const [lastShape, setLastShape] = useState<ShapeMode>('rect')
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  // Anchors the options flyout to the active tool button instead of the toolbar top.
  const flyoutAnchorRef = useRef<HTMLButtonElement>(null)
  const [flyoutTop, setFlyoutTop] = useState<number | null>(null)

  // Remember the most recently used shape so the grouped shapes button restores it.
  useEffect(() => {
    if (SHAPES.includes(toolMode as ShapeMode)) setLastShape(toolMode as ShapeMode)
  }, [toolMode])

  // Re-clamp y when the minimum changes (e.g. banner appears after mount)
  useEffect(() => {
    setPos((p) => (p.y < MIN_Y ? { ...p, y: MIN_Y } : p))
  }, [MIN_Y])

  function handleDragMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }

    function onMove(ev: MouseEvent) {
      if (!dragStart.current) return
      setPos({
        x: Math.max(0, dragStart.current.px + ev.clientX - dragStart.current.mx),
        y: Math.max(MIN_Y, dragStart.current.py + ev.clientY - dragStart.current.my),
      })
    }
    function onUp() {
      dragStart.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const isShape    = SHAPES.includes(toolMode as ShapeMode)
  const isDraw     = toolMode === 'draw'
  const isSticky   = toolMode === 'sticky'
  const showFlyout = !collapsed && (isShape || isDraw || isSticky)

  // Measure the active tool button's viewport top so the flyout lines up with it.
  useLayoutEffect(() => {
    setFlyoutTop(showFlyout && flyoutAnchorRef.current ? flyoutAnchorRef.current.getBoundingClientRect().top : null)
  }, [showFlyout, toolMode, pos.x, pos.y, collapsed])

  const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200
  const flyoutOnRight = pos.x < screenW / 2
  const flyoutTopPx = flyoutTop ?? pos.y
  const flyoutPosStyle: React.CSSProperties = flyoutOnRight
    ? { left: pos.x + TOOLBAR_W + GAP, top: flyoutTopPx }
    : { right: screenW - pos.x + GAP, top: flyoutTopPx }

  return (
    <>
      {/* ── Main vertical toolbar ── */}
      <div
        style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 45, userSelect: 'none' }}
        className="flex flex-col items-center gap-0.5 bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-2xl shadow-2xl shadow-black/15 p-1.5 w-12"
      >
        {/* Drag handle */}
        <div
          className="w-full flex justify-center py-1.5 rounded-xl cursor-grab active:cursor-grabbing hover:bg-gray-100/80 transition-colors"
          onMouseDown={handleDragMouseDown}
        >
          <svg className="w-4 h-3 text-gray-400" viewBox="0 0 16 12" fill="currentColor">
            <circle cx="4"  cy="2"  r="1.5" /><circle cx="12" cy="2"  r="1.5" />
            <circle cx="4"  cy="6"  r="1.5" /><circle cx="12" cy="6"  r="1.5" />
            <circle cx="4"  cy="10" r="1.5" /><circle cx="12" cy="10" r="1.5" />
          </svg>
        </div>

        {/* Collapse / expand */}
        <button
          title={collapsed ? 'Déplier la barre' : 'Replier la barre'}
          onClick={(e) => { setCollapsed((v) => !v); e.currentTarget.blur() }}
          className="w-9 h-6 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all focus:outline-none"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={collapsed ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} />
          </svg>
        </button>

        {!collapsed && (
          <>
            <Sep />

            <Btn mode="select" current={toolMode} label="Sélection (V)" onClick={() => onToolChange('select')}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-7 1-4 7L5 3z" />
              </svg>
            </Btn>
            <Btn mode="pan" current={toolMode} label="Déplacer le board (comme le clic molette)" onClick={() => onToolChange('pan')}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V6a1.5 1.5 0 013 0m0 0v-.5a1.5 1.5 0 013 0V6m0 0a1.5 1.5 0 013 0v1.5m0 0a1.5 1.5 0 013 0V14a6 6 0 01-6 6h-2.5a6 6 0 01-4.243-1.757l-3-3a1.5 1.5 0 012.122-2.122L10 14.5" />
              </svg>
            </Btn>

            <Sep />

            <Btn mode="text" current={toolMode} label="Zone de texte (T)" onClick={() => onToolChange('text')}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" d="M4 6h16M12 6v13M8 19h8" />
              </svg>
            </Btn>
            <Btn ref={isSticky ? flyoutAnchorRef : undefined} mode="sticky" current={toolMode} label="Note adhésive" onClick={() => onToolChange('sticky', toolMode === 'sticky' ? toolColor : DEFAULT_CARD_COLOR)}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </Btn>
            {onAddFrame && (
              <button
                title={frameLimitReached ? 'Limite de cadres atteinte sur ce board' : 'Ajouter un cadre'}
                disabled={frameLimitReached}
                onClick={(e) => { onAddFrame(); e.currentTarget.blur() }}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all focus:outline-none text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9h18M9 21V9" />
                </svg>
              </button>
            )}

            {tablesEnabled && (
              <Btn mode="table" current={toolMode} label="Tableau" onClick={() => onToolChange('table')}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="16" rx="2" strokeLinecap="round" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9h18M3 14h18M9 4v16M15 4v16" />
                </svg>
              </Btn>
            )}

            <Sep />

            {/* Grouped shapes — opens the shape picker in the options flyout */}
            <button
              ref={isShape ? flyoutAnchorRef : undefined}
              title="Formes"
              onClick={(e) => { onToolChange(lastShape, isShape ? toolColor : DEFAULT_SHAPE_COLOR); e.currentTarget.blur() }}
              className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all focus:outline-none ${
                isShape ? 'bg-primary-600 text-white shadow-md shadow-primary-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <ShapeGlyph mode={lastShape} />
              </svg>
              {/* caret hint that more shapes are available */}
              <svg className={`absolute bottom-0.5 right-0.5 w-2 h-2 ${isShape ? 'text-white/80' : 'text-gray-400'}`} viewBox="0 0 8 8" fill="currentColor">
                <path d="M8 8H3l5-5z" />
              </svg>
            </button>

            <Sep />

            {drawingEnabled && (
              <Btn ref={isDraw ? flyoutAnchorRef : undefined} mode="draw" current={toolMode} label="Dessin libre" onClick={() => onToolChange('draw', toolMode === 'draw' ? toolColor : DEFAULT_SHAPE_COLOR)}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </Btn>
            )}
            <Btn mode="link" current={toolMode} label="Lien URL" onClick={() => onToolChange('link')}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </Btn>
            <Btn mode="link-cards" current={toolMode} label="Relier des cartes" onClick={() => onToolChange('link-cards')}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="5"  cy="12" r="2.5" />
                <circle cx="19" cy="12" r="2.5" />
                <path strokeLinecap="round" d="M7.5 12h9" />
              </svg>
            </Btn>

            {/* Aimantation : grille + guides d'alignement */}
            {(onToggleGrid || onToggleAlign) && (
              <>
                <Sep />
                {onToggleGrid && (
                  <button
                    title={snapToGrid ? 'Grille : activée (clic pour désactiver)' : 'Aligner sur la grille'}
                    onClick={(e) => { onToggleGrid(); e.currentTarget.blur() }}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus:outline-none ${
                      snapToGrid ? 'bg-primary-600 text-white shadow-md shadow-primary-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v16H4zM9 4v16M15 4v16M4 9h16M4 15h16" />
                    </svg>
                  </button>
                )}
                {onToggleAlign && (
                  <button
                    title={alignGuides ? "Guides d'alignement : activés (clic pour désactiver)" : "Guides d'alignement"}
                    onClick={(e) => { onToggleAlign(); e.currentTarget.blur() }}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus:outline-none ${
                      alignGuides ? 'bg-primary-600 text-white shadow-md shadow-primary-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M7 8h10M9 16h6" />
                    </svg>
                  </button>
                )}
              </>
            )}

            {toolMode !== 'select' && (
              <>
                <Sep />
                <span className="text-[8px] text-gray-400 font-mono leading-tight text-center py-0.5 px-0.5">Échap</span>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Options flyout (colors + stroke + fill) ── */}
      {showFlyout && (
        <div
          style={{ position: 'fixed', ...flyoutPosStyle, zIndex: 44, userSelect: 'none' }}
          className="flex flex-row items-center gap-2 bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-2xl shadow-2xl shadow-black/15 px-3 py-2.5"
        >
          {/* Shape picker (shapes only) — grouped shapes button opens this */}
          {isShape && (
            <>
              <div className="grid grid-cols-2 gap-1">
                {SHAPES.map((s) => (
                  <button
                    key={s}
                    title={SHAPE_LABELS[s]}
                    onClick={() => { setLastShape(s); onToolChange(s, toolColor) }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      toolMode === s ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <ShapeGlyph mode={s} />
                    </svg>
                  </button>
                ))}
              </div>
              <div className="w-px self-stretch bg-gray-200 mx-0.5" />
            </>
          )}

          {/* Shared color picker (base palette + custom + recents) */}
          <ColorPicker value={toolColor} onChange={(c) => onToolChange(toolMode, c)} />

          {/* Stroke thickness + fill: shapes only */}
          {isShape && (
            <>
              <div className="w-px self-stretch bg-gray-200 mx-0.5" />
              <div className="flex flex-col gap-1">
                {(['thin', 'medium', 'thick'] as StrokeSize[]).map((s) => (
                  <button
                    key={s}
                    title={s === 'thin' ? 'Trait fin' : s === 'medium' ? 'Trait moyen' : 'Trait épais'}
                    onClick={() => onToolChange(toolMode, undefined, s)}
                    className={`w-10 h-6 rounded-lg flex items-center justify-center transition-all ${
                      toolStroke === s ? 'bg-primary-600' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <div
                      className="w-6 rounded-full"
                      style={{
                        height: s === 'thin' ? 1 : s === 'medium' ? 2.5 : 5,
                        background: toolStroke === s ? 'white' : '#6b7280',
                      }}
                    />
                  </button>
                ))}
              </div>
              <div className="w-px self-stretch bg-gray-200 mx-0.5" />
              <button
                title={toolFill ? 'Sans fond' : 'Avec fond'}
                onClick={() => onToolChange(toolMode, undefined, undefined, !toolFill)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  toolFill
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-200'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="4" y="4" width="16" height="16" rx="3" fill={toolFill ? 'currentColor' : 'none'} fillOpacity={toolFill ? 0.4 : 0} />
                </svg>
              </button>
              {toolFill && (
                <>
                  <div className="w-px self-stretch bg-gray-200 mx-0.5" />
                  <div className="flex flex-col items-center gap-1 py-0.5">
                    <span className="text-[9px] text-gray-400 font-mono leading-none">{Math.round(toolOpacity * 100)}%</span>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={Math.round(toolOpacity * 100)}
                      onChange={(e) => onToolChange(toolMode, undefined, undefined, undefined, parseInt(e.target.value) / 100)}
                      style={{ width: 56, accentColor: '#6366f1' }}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}

const Btn = forwardRef<HTMLButtonElement, {
  mode: ToolMode; current: ToolMode; label: string; onClick: () => void; children: React.ReactNode
}>(function Btn({ mode, current, label, onClick, children }, ref) {
  return (
    <button
      ref={ref}
      title={label}
      onClick={(e) => { onClick(); e.currentTarget.blur() }}
      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus:outline-none ${
        mode === current
          ? 'bg-primary-600 text-white shadow-md shadow-primary-200'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
      }`}
    >
      {children}
    </button>
  )
})

function Sep() {
  return <div className="w-6 h-px bg-gray-100 my-0.5 rounded-full" />
}
