'use client'

import type { Card } from '@/hooks/useBoard'
import { ConnectHandles, LinkCardsOverlay, BorderResizeHandles, type ResizeDir } from './board-card-parts'

interface Props {
  card: Card
  isSelected?: boolean
  isMultiSelect?: boolean
  isReadonly?: boolean
  outline: string
  onRecolor?: (id: string, color: string) => void
  onCrop?: (id: string) => void
  onDelete: (id: string) => void
  onSelect?: (id: string, addToSelection: boolean) => void
  onSetLocked?: (id: string, locked: boolean) => void
  onStartConnect?: (cardId: string, e: React.MouseEvent) => void
  onLinkCardsClick?: (cardId: string, additive: boolean) => void
  linkCardsMode?: boolean
  isLinkSource?: boolean
  handleMouseDown: (e: React.MouseEvent) => void
  handleResizeMouseDown: (e: React.MouseEvent, dir?: ResizeDir) => void
  isDragging: React.MutableRefObject<boolean>
}

const BORDER_DEFAULT = '#6366f1'

export function ImageCard({
  card, isSelected, isMultiSelect, isReadonly, outline,
  onRecolor, onCrop, onDelete, onSelect, onSetLocked, onStartConnect,
  onLinkCardsClick, linkCardsMode, isLinkSource,
  handleMouseDown, handleResizeMouseDown, isDragging,
}: Props) {
  const hasBorder = card.color !== 'transparent' && card.color !== '#FFEB3B' && card.color !== ''

  return (
    <div
      data-card-id={card.id}
      className="absolute group select-none overflow-hidden"
      style={{
        left: card.posX,
        top: card.posY,
        width: Math.max(card.width, 80),
        height: Math.max(card.height, 60),
        borderRadius: 10,
        border: hasBorder ? `2px solid ${card.color}` : '2px solid transparent',
        boxShadow: isSelected ? undefined : '0 2px 10px rgba(0,0,0,0.18)',
        outline,
        outlineOffset: '2px',
        cursor: isReadonly ? 'default' : (card.locked ? 'default' : 'grab'),
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        if (isDragging.current) return
        onSelect?.(card.id, e.shiftKey || e.metaKey || e.ctrlKey)
      }}
    >
      {/* Image fills entirely */}
      <img
        src={card.content}
        alt=""
        className="w-full h-full object-contain"
        draggable={false}
        style={{ display: 'block' }}
      />

      {/* Overlay controls — top-right */}
      {!isReadonly && (
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {/* Crop */}
          {!card.locked && onCrop && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onCrop(card.id) }}
              className="w-6 h-6 rounded-md flex items-center justify-center bg-black/35 text-white/80 hover:bg-black/55 transition-colors backdrop-blur-sm"
              title="Rogner"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 2v14a2 2 0 002 2h14M2 6h14a2 2 0 012 2v14" />
              </svg>
            </button>
          )}

          {/* Border toggle */}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onRecolor?.(card.id, hasBorder ? 'transparent' : BORDER_DEFAULT)
            }}
            className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors backdrop-blur-sm ${
              hasBorder
                ? 'bg-primary-600/80 text-white hover:bg-primary-700/80'
                : 'bg-black/35 text-white/80 hover:bg-black/55'
            }`}
            title={hasBorder ? 'Retirer le contour' : 'Ajouter un contour'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={2.5} />
            </svg>
          </button>

          {/* Lock */}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onSetLocked?.(card.id, !card.locked) }}
            className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors backdrop-blur-sm ${
              card.locked
                ? 'bg-amber-500/80 text-white hover:bg-amber-600/80'
                : 'bg-black/35 text-white/80 hover:bg-black/55'
            }`}
            title={card.locked ? 'Déverrouiller' : 'Verrouiller'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {card.locked
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6-6h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2zm10-4a4 4 0 10-8 0v4h8V9z" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              }
            </svg>
          </button>

          {/* Delete */}
          {!card.locked && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDelete(card.id) }}
              className="w-6 h-6 rounded-md flex items-center justify-center bg-black/35 text-white/80 hover:bg-red-600/80 hover:text-white transition-colors backdrop-blur-sm"
              title="Supprimer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Locked indicator (readonly mode) */}
      {isReadonly && card.locked && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md bg-black/30 flex items-center justify-center">
          <svg className="w-3 h-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6-6h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2zm10-4a4 4 0 10-8 0v4h8V9z" />
          </svg>
        </div>
      )}

      {/* Connect handles */}
      {!linkCardsMode && (
        <ConnectHandles cardId={card.id} onStart={isReadonly ? undefined : onStartConnect} />
      )}

      {/* Link-cards overlay */}
      {linkCardsMode && onLinkCardsClick && (
        <LinkCardsOverlay cardId={card.id} isSource={isLinkSource} onClick={onLinkCardsClick} />
      )}

      {/* Invisible border zones for resizing — no visible dots, disabled during multi-select */}
      {!isReadonly && !card.locked && !isMultiSelect && (
        <BorderResizeHandles onStart={handleResizeMouseDown} />
      )}
    </div>
  )
}
