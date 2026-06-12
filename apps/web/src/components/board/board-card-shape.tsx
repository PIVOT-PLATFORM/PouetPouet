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

  function updateShape(overrides: { stroke?: string; fill?: boolean; opacity?: number; rotation?: number }) {
    const s = overrides.stroke ?? strokeSize
    const f = overrides.fill ?? hasFill
    const o = overrides.opacity ?? fillOpacity
    const r = overrides.rotation ?? rotation
    onUpdate(card.id, `${shapeType}|${s}|${f}|${o}${shapeType === 'line' ? `|${r}` : ''}`)
  }

  const shapeAttrs = {
    fill: hasFill ? card.color : 'none',
    fillOpacity: hasFill ? fillOpacity : 0,
    stroke: card.color,
    strokeWidth: sw,
    vectorEffect: 'non-scaling-stroke' as const,
  }

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
      style={{ left: card.posX, top: card.posY, width: w, height: h, cursor: isReadonly ? 'default' : 'grab', outline, outlineOffset: '2px' }}
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
          className="absolute bottom-full left-0 mb-2 flex items-center gap-0.5 bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-xl shadow-xl px-2 py-1.5 whitespace-nowrap"
          style={{ zIndex: 10 }}
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

      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
        {shapeType === 'rect' && <rect x={pad} y={pad} width={w - 2 * pad} height={h - 2 * pad} rx={8} {...shapeAttrs} />}
        {shapeType === 'circle' && <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - pad} {...shapeAttrs} />}
        {shapeType === 'diamond' && <polygon points={`${w / 2},${pad} ${w - pad},${h / 2} ${w / 2},${h - pad} ${pad},${h / 2}`} {...shapeAttrs} />}
        {shapeType === 'triangle' && <polygon points={`${w / 2},${pad} ${w - pad},${h - pad} ${pad},${h - pad}`} {...shapeAttrs} />}
        {shapeType === 'line' && (() => {
          const theta = (rotation * Math.PI) / 180
          const cosA = Math.abs(Math.cos(theta))
          const sinA = Math.abs(Math.sin(theta))
          // Length of the chord spanning the bounding box at the current angle.
          const chord = cosA < 1e-9 ? h : sinA < 1e-9 ? w : Math.min(w / cosA, h / sinA)
          const half = Math.max(0, chord / 2 - pad)
          return (
            <g transform={`rotate(${rotation}, ${w / 2}, ${h / 2})`}>
              <line
                x1={w / 2 - half} y1={h / 2}
                x2={w / 2 + half} y2={h / 2}
                stroke={shapeAttrs.stroke} strokeWidth={shapeAttrs.strokeWidth}
                strokeLinecap="round" vectorEffect="non-scaling-stroke"
              />
            </g>
          )
        })()}
        {shapeType === 'star' && <polygon points={starPoints} strokeLinejoin="round" {...shapeAttrs} />}
      </svg>

      {!isReadonly && !card.locked && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
        <BorderResizeHandles onStart={handleResizeMouseDown} />
      )}
      {!isSelected && <ConnectHandles cardId={card.id} onStart={isReadonly ? undefined : onStartConnect} />}
      {linkCardsMode && onLinkCardsClick && (
        <LinkCardsOverlay cardId={card.id} isSource={isLinkSource} onClick={onLinkCardsClick} />
      )}
    </div>
  )
}
