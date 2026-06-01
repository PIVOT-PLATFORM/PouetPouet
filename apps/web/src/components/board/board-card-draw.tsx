'use client'

import type { Card } from '@/hooks/useBoard'
import { ConnectHandles, LinkCardsOverlay, BorderResizeHandles, type ResizeDir } from './board-card-parts'
import { MIN_W, MIN_H } from './board-card-constants'

interface DrawCardProps {
  card: Card
  isReadonly?: boolean
  isSelected?: boolean
  isMultiSelect?: boolean
  outline: string
  onDelete: (id: string) => void
  onStartConnect?: (cardId: string, e: React.MouseEvent) => void
  onLinkCardsClick?: (cardId: string, additive: boolean) => void
  linkCardsMode?: boolean
  isLinkSource?: boolean
  handleMouseDown: (e: React.MouseEvent) => void
  handleClick: (e: React.MouseEvent) => void
  handleResizeMouseDown: (e: React.MouseEvent, dir: ResizeDir) => void
}

export function DrawCard({
  card, isReadonly, isSelected, isMultiSelect, outline,
  onDelete, onStartConnect, onLinkCardsClick, linkCardsMode, isLinkSource,
  handleMouseDown, handleClick, handleResizeMouseDown,
}: DrawCardProps) {
  const w = Math.max(card.width, MIN_W)
  const h = Math.max(card.height, MIN_H)
  return (
    <div
      data-card-id={card.id}
      className="absolute group select-none"
      style={{ left: card.posX, top: card.posY, width: w, height: h, cursor: isReadonly ? 'default' : 'grab', outline, outlineOffset: '2px' }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <path d={card.content} stroke={card.color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
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
