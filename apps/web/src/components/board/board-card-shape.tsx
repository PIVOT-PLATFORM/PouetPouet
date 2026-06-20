'use client'

import type { Card } from '@/hooks/useBoard'
import { ConnectHandles, LinkCardsOverlay, BorderResizeHandles, type ResizeDir } from './board-card-parts'
import { SHAPE_MIN } from './board-card-constants'
import { ColorPicker } from '@/components/ui/color-picker'

interface ShapeCardProps {
  card: Card
  isSelected?: boolean
  isMultiSelect?: boolean
  isReadonly?: boolean
  outline: string
  onRecolor?: (id: string, color: string) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, content: string) => void
  onSelect?: (id: string, addToSelection: boolean) => void
  onStartConnect?: (cardId: string, e: React.MouseEvent) => void
  onLinkCardsClick?: (cardId: string, additive: boolean) => void
  linkCardsMode?: boolean
  isLinkSource?: boolean
  handleMouseDown: (e: React.MouseEvent) => void
  handleResizeMouseDown: (e: React.MouseEvent, dir: ResizeDir) => void
  isDragging: React.RefObject<boolean>
}

export function ShapeCard({
  card, isSelected, isMultiSelect, isReadonly, outline,
  onRecolor, onDelete, onUpdate, onSelect, onStartConnect,
  onLinkCardsClick, linkCardsMode, isLinkSource,
  handleMouseDown, handleResizeMouseDown, isDragging,
}: ShapeCardProps) {
  const parts = card.content.split('|')
  const shapeType = parts[0]
  const strokeSize = parts[1] || 'medium'
  const sw = strokeSize === 'thin' ? 1.5 : strokeSize === 'thick' ? 6 : 3
  const hasFill = parts[2] !== 'false'
  const fillOpacity = parts[3] !== undefined ? Math.min(1, Math.max(0.05, parseFloat(parts[3]) || 0.25)) : 0.25
  const rotation = parts[4] !== undefined ? parseFloat(parts[4]) || 0 : 0
  const w = Math.max(card.width, SHAPE_MIN)
  const h = Math.max(card.height, SHAPE_MIN)
  const pad = Math.ceil(sw / 2) + 4

  // Pour les lignes : longueur fixe = w (ne change pas à la rotation)
  // Le conteneur est rendu fin (24px) centré sur le milieu vertical du bbox stocké.
  const lineHalf = shapeType === 'line' ? Math.max(0, w / 2 - pad) : 0
  const lineContainerH = 24
  const lineCY = lineContainerH / 2 // centre vertical dans le SVG fin

  function updateShape(overrides: { stroke?: string; fill?: boolean; opacity?: number; rotation?: number }) {
    const s = overrides.stroke ?? strokeSize
    const f = overrides.fill ?? hasFill
    const o = overrides.opacity ?? fillOpacity
    const r = overrides.rotation ?? rotation
    onUpdate(card.id, `${shapeType}|${s}|${f}|${o}${shapeType === 'line' ? `|${r}` : ''}`)
  }

  const isLine = shapeType === 'line'

  const shapeAttrs = {
    fill: hasFill ? card.color : 'none',
    fillOpacity: hasFill ? fillOpacity : 0,
    stroke: card.color,
    strokeWidth: sw,
    vectorEffect: 'non-scaling-stroke' as const,
    // #115 — la hitbox épouse la géométrie. Pour formes remplies, intérieur + contour.
    // Pour formes creuses, seul le contour (via hit-shape invisible).
    pointerEvents: hasFill ? ('all' as const) : ('none' as const),
  }

  // Pour formes creuses : hit-zone invisible ±10px autour du contour
  const hitShapeAttrs = !hasFill ? {
    fill: 'none',
    stroke: 'transparent',
    strokeWidth: sw + 40, // +20px de chaque côté
    vectorEffect: 'non-scaling-stroke' as const,
    pointerEvents: 'stroke' as const,
  } : null

  // 5-point star centred in the box.
  const starCx = w / 2, starCy = h / 2
  const starR = Math.min(w, h) / 2 - pad
  const starPoints = Array.from({ length: 10 }, (_, i) => {
    const ang = (-90 + i * 36) * (Math.PI / 180)
    const rad = i % 2 === 0 ? starR : starR * 0.42
    return `${(starCx + rad * Math.cos(ang)).toFixed(1)},${(starCy + rad * Math.sin(ang)).toFixed(1)}`
  }).join(' ')

  return (
    <div
      data-card-id={card.id}
      className="absolute group select-none"
      // #115 — pointer-events:none sur le conteneur : seuls la géométrie SVG (pointer-events:all)
      // et les overlays interactifs (réactivés en auto) captent les clics ; les coins vides du
      // bounding box laissent passer le clic vers le canvas. Le survol de groupe se déclenche via
      // le survol de la forme (un descendant hover met aussi l'ancêtre en :hover).
      style={{
        left: card.posX,
        top: shapeType === 'line' ? card.posY + h / 2 - lineContainerH / 2 : card.posY,
        width: w,
        height: shapeType === 'line' ? lineContainerH : h,
        cursor: isReadonly ? 'default' : 'grab',
        outline: shapeType === 'line' ? undefined : outline,
        outlineOffset: '2px',
        pointerEvents: 'none',
        ...(shapeType === 'line' && { transform: `rotate(${rotation}deg)`, transformOrigin: 'center' }),
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        if (isDragging.current) return
        if (e.shiftKey || e.metaKey || e.ctrlKey) { onSelect?.(card.id, true); return }
        onSelect?.(card.id, false)
      }}
    >
      {/* ── Shape editing panel (visible when a single, unlocked object is selected) ── */}
      {isSelected && !isReadonly && !isMultiSelect && !card.locked && (
        <div
          className={`absolute flex items-center gap-0.5 bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-xl shadow-xl px-2 py-1.5 whitespace-nowrap ${isLine ? '' : 'bottom-full mb-2'}`}
          style={
            isLine
              ? {
                  // Pinned above the line center in world space: container rotates +θ,
                  // origin at the center point counter-rotates -θ → popup stays horizontal
                  // and centered, never spins, never overlaps the line.
                  zIndex: 10, pointerEvents: 'auto', left: '50%', top: '50%',
                  transformOrigin: '0 0',
                  transform: `rotate(${-rotation}deg) translate(-50%, calc(-100% - 28px))`,
                }
              : { zIndex: 10, pointerEvents: 'auto', left: '50%', transform: 'translateX(-50%)' }
          }
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Shared color picker */}
          <ColorPicker value={card.color} onChange={(c) => onRecolor?.(card.id, c)} />

          <div className="w-px self-stretch bg-gray-200 mx-0.5" />

          {/* Stroke: horizontal row */}
          {(['thin', 'medium', 'thick'] as const).map((s) => (
            <button
              key={s}
              title={s === 'thin' ? 'Trait fin' : s === 'medium' ? 'Trait moyen' : 'Trait épais'}
              onClick={() => updateShape({ stroke: s })}
              className={`w-8 h-6 rounded flex items-center justify-center transition-all ${strokeSize === s ? 'bg-primary-600' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <div className="w-5 rounded-full" style={{ height: s === 'thin' ? 1 : s === 'medium' ? 2.5 : 5, background: strokeSize === s ? 'white' : '#6b7280' }} />
            </button>
          ))}

          <div className="w-px self-stretch bg-gray-200 mx-0.5" />

          {shapeType === 'line' ? (
            /* Rotation slider — line only */
            <input
              type="range"
              min={0}
              max={175}
              step={5}
              value={rotation}
              onChange={(e) => updateShape({ rotation: parseInt(e.target.value) })}
              style={{ width: 80, accentColor: '#6366f1' }}
            />
          ) : (
            /* Fill toggle + opacity — other shapes */
            <>
              <button
                title={hasFill ? 'Sans fond' : 'Avec fond'}
                onClick={() => updateShape({ fill: !hasFill })}
                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${hasFill ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="4" y="4" width="16" height="16" rx="3" fill={hasFill ? 'currentColor' : 'none'} fillOpacity={hasFill ? 0.4 : 0} />
                </svg>
              </button>
              {hasFill && (
                <>
                  <div className="w-px self-stretch bg-gray-200 mx-0.5" />
                  <span className="text-[10px] font-mono text-gray-500 w-6 text-right">{Math.round(fillOpacity * 100)}%</span>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={Math.round(fillOpacity * 100)}
                    onChange={(e) => updateShape({ opacity: parseInt(e.target.value) / 100 })}
                    style={{ width: 52, accentColor: '#6366f1' }}
                  />
                </>
              )}
            </>
          )}
        </div>
      )}

      <svg
        width={w}
        height={shapeType === 'line' ? lineContainerH : h}
        viewBox={`0 0 ${w} ${shapeType === 'line' ? lineContainerH : h}`}
        style={{ display: 'block', pointerEvents: 'none', overflow: 'visible' }}
      >
        {shapeType === 'rect' && (
          <>
            {hitShapeAttrs && <rect x={pad} y={pad} width={w - 2 * pad} height={h - 2 * pad} rx={8} {...hitShapeAttrs} />}
            <rect x={pad} y={pad} width={w - 2 * pad} height={h - 2 * pad} rx={8} {...shapeAttrs} />
          </>
        )}
        {shapeType === 'circle' && (
          <>
            {hitShapeAttrs && <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - pad} {...hitShapeAttrs} />}
            <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - pad} {...shapeAttrs} />
          </>
        )}
        {shapeType === 'diamond' && (
          <>
            {hitShapeAttrs && <polygon points={`${w / 2},${pad} ${w - pad},${h / 2} ${w / 2},${h - pad} ${pad},${h / 2}`} {...hitShapeAttrs} />}
            <polygon points={`${w / 2},${pad} ${w - pad},${h / 2} ${w / 2},${h - pad} ${pad},${h / 2}`} {...shapeAttrs} />
          </>
        )}
        {shapeType === 'triangle' && (
          <>
            {hitShapeAttrs && <polygon points={`${w / 2},${pad} ${w - pad},${h - pad} ${pad},${h - pad}`} {...hitShapeAttrs} />}
            <polygon points={`${w / 2},${pad} ${w - pad},${h - pad} ${pad},${h - pad}`} {...shapeAttrs} />
          </>
        )}
        {shapeType === 'line' && (
          // Pas de rotation SVG — le conteneur CSS tourne à la place (tout s'aligne)
          <>
            {isSelected && (
              <line
                x1={w / 2 - lineHalf} y1={lineCY}
                x2={w / 2 + lineHalf} y2={lineCY}
                stroke="#6366f1" strokeWidth={sw + 6}
                strokeLinecap="round" vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'none' }}
              />
            )}
            <line
              x1={w / 2 - lineHalf} y1={lineCY}
              x2={w / 2 + lineHalf} y2={lineCY}
              stroke="transparent" strokeWidth={Math.max(sw + 40, 44)}
              strokeLinecap="round" vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'stroke' }}
            />
            <line
              x1={w / 2 - lineHalf} y1={lineCY}
              x2={w / 2 + lineHalf} y2={lineCY}
              stroke={shapeAttrs.stroke} strokeWidth={shapeAttrs.strokeWidth}
              strokeLinecap="round" vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'none' }}
            />
          </>
        )}
        {shapeType === 'star' && (
          <>
            {hitShapeAttrs && <polygon points={starPoints} strokeLinejoin="round" {...hitShapeAttrs} />}
            <polygon points={starPoints} strokeLinejoin="round" {...shapeAttrs} />
          </>
        )}
      </svg>

      {!isReadonly && !card.locked && (
        <div
          className="absolute opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            pointerEvents: 'auto',
            ...(isLine
              ? {
                  // Symmetric to the popup: pinned below the line center, world-aligned.
                  left: '50%', top: '50%', transformOrigin: '0 0',
                  transform: `rotate(${-rotation}deg) translate(-50%, 20px)`,
                }
              : { top: '4px', right: '4px' }),
          }}
        >
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(card.id) }}
            className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 shadow-sm"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {!isReadonly && !card.locked && !isMultiSelect && (
        isLine ? (
          /* Poignées d'extrémité pour les lignes : visibles uniquement quand sélectionnée */
          isSelected && (
          <>
            {(['w', 'e'] as const).map((dir) => (
              <div
                key={dir}
                onMouseDown={(e) => { if (e.button === 0) { e.preventDefault(); e.stopPropagation(); handleResizeMouseDown(e, dir) } }}
                style={{
                  position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                  [dir === 'w' ? 'left' : 'right']: -6,
                  width: 12, height: 12, cursor: 'ew-resize', zIndex: 45,
                  pointerEvents: 'auto', borderRadius: '50%',
                  background: 'white', border: '2px solid #6366f1',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              />
            ))}
          </>
          )
        ) : (
          <BorderResizeHandles onStart={handleResizeMouseDown} />
        )
      )}
      {!isSelected && shapeType !== 'line' && <ConnectHandles cardId={card.id} onStart={isReadonly ? undefined : onStartConnect} />}
      {linkCardsMode && onLinkCardsClick && (
        <LinkCardsOverlay cardId={card.id} isSource={isLinkSource} onClick={onLinkCardsClick} />
      )}
    </div>
  )
}
