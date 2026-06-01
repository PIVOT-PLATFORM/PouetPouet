'use client'

import { useState, useRef, useEffect } from 'react'
import type { Card, BoardField } from '@/hooks/useBoard'
import { parseLabelFmt, formatFieldValue, type LabelFmt } from '@/lib/card-format'
import { ConnectHandles, LinkCardsOverlay, FmtBtn, BorderResizeHandles, type ResizeDir } from './board-card-parts'
import { CHIP_STYLE, MIN_W, MIN_H, SHAPE_MIN } from './board-card-constants'
import { ColorPicker } from '@/components/ui/color-picker'
import { ShapeCard } from './board-card-shape'
import { DrawCard } from './board-card-draw'
import { ImageCard } from './board-card-image'

interface Props {
  card: Card
  fields: BoardField[]
  zoom?: number
  isSelected?: boolean
  isMultiSelect?: boolean
  groupColor?: string
  drawMode?: boolean
  isReadonly?: boolean
  onMove: (id: string, x: number, y: number) => void
  onStartDrag?: (id: string) => void
  onCommitDrag?: (id: string) => void
  onUpdate: (id: string, content: string) => void
  onRecolor?: (id: string, color: string) => void
  onDelete: (id: string) => void
  onResize: (id: string, w: number, h: number) => void
  onResizeBox?: (id: string, box: { posX: number; posY: number; width: number; height: number }) => void
  onStartResize?: (id: string) => void
  onCommitResize?: (id: string) => void
  onSelect?: (id: string, addToSelection: boolean) => void
  onOpenDetail: (id: string) => void
  onStartConnect?: (cardId: string, e: React.MouseEvent) => void
  onSetLocked?: (id: string, locked: boolean) => void
  linkCardsMode?: boolean
  isLinkSource?: boolean
  onLinkCardsClick?: (cardId: string, additive: boolean) => void
}

export function BoardCard({
  card, fields, zoom = 1, isSelected, isMultiSelect, groupColor, drawMode, isReadonly,
  onMove, onStartDrag, onCommitDrag, onUpdate, onRecolor, onDelete,
  onResize, onResizeBox, onStartResize, onCommitResize,
  onSelect, onOpenDetail, onStartConnect, onSetLocked,
  linkCardsMode, isLinkSource, onLinkCardsClick,
}: Props) {
  const isLabel = card.type === 'LABEL'

  const [isEditing, setIsEditing] = useState(card.content === '' && (card.type === 'TEXT' || isLabel))
  const [content, setContent] = useState(() => isLabel ? parseLabelFmt(card.content).text : card.content)
  const [labelFmt, setLabelFmt] = useState<Omit<LabelFmt, 'text'>>(() => {
    if (!isLabel) return { size: 16, bold: false, italic: false, underline: false, strike: false, color: '#374151' }
    const f = parseLabelFmt(card.content)
    return { size: f.size, bold: f.bold, italic: f.italic, underline: f.underline, strike: f.strike, color: f.color }
  })

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isDragging = useRef(false)

  useEffect(() => {
    if (isEditing) { textareaRef.current?.focus(); textareaRef.current?.select() }
  }, [isEditing])

  useEffect(() => {
    if (isLabel) {
      const f = parseLabelFmt(card.content)
      setContent(f.text)
      setLabelFmt({ size: f.size, bold: f.bold, italic: f.italic, underline: f.underline, strike: f.strike, color: f.color })
    } else {
      setContent(card.content)
    }
  }, [card.content])

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    if (drawMode) return  // let event bubble to canvas so drawing works over cards
    if (isEditing) return
    if (isReadonly) return
    if (card.locked) return
    // Safety net: if the mousedown bubbled up from a connect handle, ignore it
    if ((e.target as HTMLElement).closest('[data-connect-handle]')) return
    e.preventDefault()
    e.stopPropagation()
    isDragging.current = false
    onStartDrag?.(card.id)
    const startX = e.clientX, startY = e.clientY
    const startCardX = card.posX, startCardY = card.posY

    function onMouseMove(ev: MouseEvent) {
      const dx = ev.clientX - startX, dy = ev.clientY - startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging.current = true
      onMove(card.id, startCardX + dx / zoom, startCardY + dy / zoom)
    }
    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      onCommitDrag?.(card.id)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const minW = card.type === 'SHAPE' || card.type === 'DRAW' ? SHAPE_MIN : isLabel ? 40 : MIN_W
  const minH = card.type === 'SHAPE' || card.type === 'DRAW' ? SHAPE_MIN : isLabel ? 20 : MIN_H

  function handleResizeMouseDown(e: React.MouseEvent, dir: ResizeDir = 'se') {
    if (isReadonly || card.locked) return
    e.preventDefault(); e.stopPropagation()
    onStartResize?.(card.id)
    const sx = e.clientX, sy = e.clientY
    const s = { x: card.posX, y: card.posY, w: card.width, h: card.height }
    function onMouseMove(ev: MouseEvent) {
      const dx = (ev.clientX - sx) / zoom
      const dy = (ev.clientY - sy) / zoom
      let { x, y, w, h } = s
      if (dir.includes('e')) w = s.w + dx
      if (dir.includes('s')) h = s.h + dy
      if (dir.includes('w')) { w = s.w - dx; x = s.x + dx }
      if (dir.includes('n')) { h = s.h - dy; y = s.y + dy }
      // Clamp to the minimum while keeping the anchored (opposite) edge fixed.
      if (w < minW) { if (dir.includes('w')) x = s.x + (s.w - minW); w = minW }
      if (h < minH) { if (dir.includes('n')) y = s.y + (s.h - minH); h = minH }
      onResizeBox?.(card.id, { posX: x, posY: y, width: w, height: h })
    }
    function onMouseUp() {
      onCommitResize?.(card.id)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function saveLabelContent(text: string, fmt: Omit<LabelFmt, 'text'>) {
    if (!text.trim()) { onDelete(card.id); return }
    onUpdate(card.id, JSON.stringify({ ...fmt, text }))
  }

  function handleBlur() {
    setIsEditing(false)
    if (isLabel) saveLabelContent(content, labelFmt)
    else onUpdate(card.id, content)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setIsEditing(false)
      if (isLabel) saveLabelContent(content, labelFmt)
      else onUpdate(card.id, content)
    }
  }

  function handleClick(e: React.MouseEvent) {
    if (isDragging.current) return
    if (isReadonly) return
    if (e.shiftKey || e.metaKey || e.ctrlKey) { onSelect?.(card.id, true); return }
    if (!isEditing && card.type === 'TEXT' && !card.locked) setIsEditing(true)
    if (!isEditing) onSelect?.(card.id, false)
  }

  function updateLabelFmt(changes: Partial<Omit<LabelFmt, 'text'>>) {
    const newFmt = { ...labelFmt, ...changes }
    setLabelFmt(newFmt)
    onUpdate(card.id, JSON.stringify({ ...newFmt, text: content }))
  }

  const chips = fields
    .map((f) => ({ field: f, fv: (card.fieldValues ?? []).find((v) => v.fieldId === f.id) }))
    .filter(({ fv }) => fv?.value)

  const CHIP_ROW_H = 22
  const CHIP_AVG_W = 76
  const ACTIONS_H  = 28
  const SPACER_H   = 8
  const CONTENT_MIN_H = 44

  const cardW = Math.max(card.width,  MIN_W)
  const cardH = Math.max(card.height, MIN_H)
  const availH = Math.max(0, cardH - ACTIONS_H - CONTENT_MIN_H - SPACER_H)
  const maxRows = Math.max(0, Math.floor(availH / CHIP_ROW_H))
  const chipsPerRow = Math.max(1, Math.floor((cardW - 16) / CHIP_AVG_W))
  const maxVisible = maxRows * chipsPerRow

  const outline = isSelected ? '2px solid #6366f1' : card.locked ? '1.5px solid #d1d5db' : groupColor ? `2px solid ${groupColor}` : 'none'

  // ── IMAGE card ──────────────────────────────────────────────────────────────
  if (card.type === 'IMAGE') {
    return (
      <ImageCard
        card={card}
        isSelected={isSelected}
        isMultiSelect={isMultiSelect}
        isReadonly={isReadonly}
        outline={outline}
        onRecolor={onRecolor}
        onDelete={onDelete}
        onSelect={onSelect}
        onSetLocked={onSetLocked}
        onStartConnect={onStartConnect}
        onLinkCardsClick={onLinkCardsClick}
        linkCardsMode={linkCardsMode}
        isLinkSource={isLinkSource}
        handleMouseDown={handleMouseDown}
        handleResizeMouseDown={handleResizeMouseDown}
        isDragging={isDragging}
      />
    )
  }

  // ── SHAPE card ──────────────────────────────────────────────────────────────
  if (card.type === 'SHAPE') {
    return (
      <ShapeCard
        card={card}
        isSelected={isSelected}
        isMultiSelect={isMultiSelect}
        isReadonly={isReadonly}
        outline={outline}
        onRecolor={onRecolor}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onSelect={onSelect}
        onStartConnect={onStartConnect}
        onLinkCardsClick={onLinkCardsClick}
        linkCardsMode={linkCardsMode}
        isLinkSource={isLinkSource}
        handleMouseDown={handleMouseDown}
        handleResizeMouseDown={handleResizeMouseDown}
        isDragging={isDragging}
      />
    )
  }

  // ── DRAW card ───────────────────────────────────────────────────────────────
  if (card.type === 'DRAW') {
    return (
      <DrawCard
        card={card}
        isReadonly={isReadonly}
        isSelected={isSelected}
        isMultiSelect={isMultiSelect}
        outline={outline}
        onDelete={onDelete}
        onStartConnect={onStartConnect}
        onLinkCardsClick={onLinkCardsClick}
        linkCardsMode={linkCardsMode}
        isLinkSource={isLinkSource}
        handleMouseDown={handleMouseDown}
        handleClick={handleClick}
        handleResizeMouseDown={handleResizeMouseDown}
      />
    )
  }

  // ── LABEL card ──────────────────────────────────────────────────────────────
  if (isLabel) {
    const textStyle: React.CSSProperties = {
      fontSize: labelFmt.size,
      fontWeight: labelFmt.bold ? 'bold' : 'normal',
      fontStyle: labelFmt.italic ? 'italic' : 'normal',
      textDecoration: [labelFmt.underline ? 'underline' : '', labelFmt.strike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
      color: labelFmt.color,
      lineHeight: 1.3,
    }

    return (
      <div
        data-card-id={card.id}
        className="absolute group select-none"
        style={{
          left: card.posX,
          top: card.posY,
          cursor: isReadonly ? 'default' : (isEditing ? 'default' : 'grab'),
          outline: isSelected ? '1.5px dashed #818cf8' : 'none',
          outlineOffset: 6,
          borderRadius: 4,
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDoubleClick={(e) => { e.stopPropagation(); if (!isReadonly && !card.locked) setIsEditing(true) }}
      >
        {/* ── Formatting toolbar (visible when a single, unlocked object is selected) ── */}
        {isSelected && !isReadonly && !isMultiSelect && !card.locked && (
          <div
            className="absolute bottom-full left-0 mb-2 flex items-center gap-0.5 bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-xl shadow-xl px-1.5 py-1 whitespace-nowrap"
            style={{ zIndex: 10 }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Font size */}
            <button
              className="w-5 h-5 rounded flex items-center justify-center text-gray-500 hover:bg-gray-100 text-xs font-bold leading-none"
              onClick={() => updateLabelFmt({ size: Math.max(10, labelFmt.size - 2) })}
              title="Diminuer la taille"
            >−</button>
            <span className="text-[10px] font-mono text-gray-600 w-6 text-center select-none">{labelFmt.size}</span>
            <button
              className="w-5 h-5 rounded flex items-center justify-center text-gray-500 hover:bg-gray-100 text-xs font-bold leading-none"
              onClick={() => updateLabelFmt({ size: Math.min(72, labelFmt.size + 2) })}
              title="Augmenter la taille"
            >+</button>

            <div className="w-px h-4 bg-gray-200 mx-0.5" />

            <FmtBtn active={labelFmt.bold}      onClick={() => updateLabelFmt({ bold:      !labelFmt.bold      })} title="Gras">
              <span className="font-bold text-[11px]">B</span>
            </FmtBtn>
            <FmtBtn active={labelFmt.italic}    onClick={() => updateLabelFmt({ italic:    !labelFmt.italic    })} title="Italique">
              <span className="italic text-[11px]">I</span>
            </FmtBtn>
            <FmtBtn active={labelFmt.underline} onClick={() => updateLabelFmt({ underline: !labelFmt.underline })} title="Souligné">
              <span className="underline text-[11px]">U</span>
            </FmtBtn>
            <FmtBtn active={labelFmt.strike}    onClick={() => updateLabelFmt({ strike:    !labelFmt.strike    })} title="Barré">
              <span className="line-through text-[11px]">S</span>
            </FmtBtn>

            <div className="w-px h-4 bg-gray-200 mx-0.5" />

            {/* Text colors — shared picker */}
            <ColorPicker value={labelFmt.color} onChange={(c) => updateLabelFmt({ color: c })} columns={8} />
          </div>
        )}

        {/* ── Text content ── */}
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="bg-transparent resize-none focus:outline-none"
            style={{
              ...textStyle,
              width: Math.max(card.width, 80),
              height: Math.max(card.height, 28),
              border: '1px dashed #cbd5e1',
              borderRadius: 4,
              padding: '2px 6px',
            }}
            placeholder="Étiquette…"
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <p className="whitespace-pre-wrap px-1.5 py-0.5" style={{ ...textStyle, minWidth: 40, minHeight: 24 }}>
            {content || <span style={{ color: '#d1d5db', fontSize: 14, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none' }}>Étiquette…</span>}
          </p>
        )}

        {/* ── Delete button (inside bounds, top-right) ── */}
        {!isReadonly && !card.locked && (
          <button
            className="absolute top-0 right-0 w-5 h-5 rounded-full bg-white/90 border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ zIndex: 5 }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(card.id) }}
            title="Supprimer"
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* ── Resize handles (when selected) ── */}
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

  // ── TEXT / IMAGE / LINK card ─────────────────────────────────────────────────
  return (
    <div
      data-card-id={card.id}
      className="absolute rounded-xl shadow-md hover:shadow-xl transition-shadow duration-200 flex flex-col group select-none overflow-hidden"
      style={{
        left: card.posX,
        top: card.posY,
        width: Math.max(card.width, MIN_W),
        height: Math.max(card.height, MIN_H),
        background: card.type === 'IMAGE' ? '#1e1e1e' : card.color,
        cursor: isReadonly ? 'default' : (card.locked ? 'default' : isEditing ? 'default' : 'grab'),
        outline, outlineOffset: '2px',
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {/* ── Actions row ── */}
      <div className="shrink-0 flex justify-end items-center gap-1 px-2 pt-1.5 h-7 opacity-0 group-hover:opacity-100 transition-opacity">
        {isReadonly ? (
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-gray-400/50" title="Lecture seule">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-4-5a4 4 0 118 0v1H8v-1z" />
              <rect x="5" y="12" width="14" height="9" rx="2" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </div>
        ) : (
          <>
            {card.type !== 'LINK' && !card.locked && (
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onOpenDetail(card.id) }}
                className="w-5 h-5 rounded-full flex items-center justify-center text-gray-500/60 hover:text-indigo-600 hover:bg-indigo-100/60 transition-colors"
                title="Détail"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2m8-16h2a2 2 0 012 2v2m-4 12h2a2 2 0 002-2v-2" />
                </svg>
              </button>
            )}
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onSetLocked?.(card.id, !card.locked) }}
              className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${card.locked ? 'text-amber-600 bg-amber-100/80 hover:bg-amber-200/80' : 'text-gray-500/60 hover:text-amber-600 hover:bg-amber-100/60'}`}
              title={card.locked ? 'Déverrouiller' : 'Verrouiller'}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {card.locked
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6-6h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2zm10-4a4 4 0 10-8 0v4h8V9z" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                }
              </svg>
            </button>
            {!card.locked && (
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDelete(card.id) }}
                className="w-5 h-5 rounded-full flex items-center justify-center text-gray-500/60 hover:text-red-600 hover:bg-red-100/60 transition-colors"
                title="Supprimer"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0 px-3 overflow-hidden">
        {card.type === 'IMAGE' ? (
          <img src={card.content} alt="" className="w-full h-full object-contain rounded" draggable={false} />
        ) : card.type === 'LINK' ? (
          <a
            href={card.content}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center gap-2 h-full"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <p className="text-[11px] text-blue-600 text-center break-all line-clamp-2 leading-tight font-medium">
              {card.content}
            </p>
          </a>
        ) : isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full h-full bg-transparent resize-none text-sm text-gray-800 focus:outline-none placeholder-gray-500/60 leading-relaxed"
            placeholder="Votre idée…"
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed h-full overflow-hidden">
            {content || <span className="text-gray-400/70 text-xs italic">Cliquer pour écrire</span>}
          </p>
        )}
      </div>

      {/* ── Chips ── */}
      {chips.length > 0 && maxVisible > 0 && (
        <div
          className="shrink-0 flex flex-wrap gap-1 px-2 overflow-hidden"
          style={{ maxHeight: maxRows * CHIP_ROW_H }}
        >
          {chips.slice(0, maxVisible).map(({ field, fv }) => (
            <span
              key={field.id}
              className={`inline-flex items-center gap-0.5 h-5 rounded-full border px-1.5 text-[10px] font-medium shrink-0 max-w-[90px] overflow-hidden ${CHIP_STYLE[field.type] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}
              title={`${field.name} : ${fv!.value}`}
            >
              <span className="shrink-0 leading-none">{field.emoji || field.name[0].toUpperCase()}</span>
              <span className="truncate min-w-0 ml-0.5">{formatFieldValue(field.type, fv!.value)}</span>
            </span>
          ))}
          {chips.length > maxVisible && (
            <span className="shrink-0 inline-flex items-center h-5 rounded-full border border-gray-200 bg-gray-100 px-1.5 text-[10px] font-medium text-gray-500">
              +{chips.length - maxVisible}
            </span>
          )}
        </div>
      )}

      <div className="shrink-0 h-2" />

      {/* ── Resize handles (when selected) ── */}
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

