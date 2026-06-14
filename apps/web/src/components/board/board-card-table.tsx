'use client'

import type { Card } from '@/hooks/useBoard'
import { ConnectHandles, LinkCardsOverlay, BorderResizeHandles, type ResizeDir } from './board-card-parts'
import { ColorPicker } from '@/components/ui/color-picker'
import { headerTint } from '@/lib/colors'
import { parseTableContent, serializeTable } from '@/lib/table-clipboard'

interface TableCardProps {
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

const GRIP_H = 16

export function TableCard({
  card, isSelected, isMultiSelect, isReadonly, outline,
  onRecolor, onDelete, onUpdate, onSelect, onStartConnect,
  onLinkCardsClick, linkCardsMode, isLinkSource,
  handleMouseDown, handleResizeMouseDown, isDragging,
}: TableCardProps) {
  const rows = parseTableContent(card.content)
  const editable = !isReadonly && !card.locked
  const tint = headerTint(card.color)

  function commit(next: string[][]) {
    onUpdate(card.id, serializeTable(next))
  }

  function commitCell(r: number, c: number, value: string) {
    if (rows[r]?.[c] === value) return
    const next = rows.map((row) => [...row])
    next[r][c] = value
    commit(next)
  }

  function addRow() { commit([...rows.map((r) => [...r]), rows[0].map(() => '')]) }
  function delRow() { if (rows.length > 1) commit(rows.slice(0, -1).map((r) => [...r])) }
  function addCol() { commit(rows.map((r) => [...r, ''])) }
  function delCol() { if (rows[0].length > 1) commit(rows.map((r) => r.slice(0, -1))) }

  return (
    <div
      data-card-id={card.id}
      className="absolute group select-none"
      style={{ left: card.posX, top: card.posY, width: card.width, height: card.height, outline, outlineOffset: '2px' }}
      onClick={(e) => {
        if (isDragging.current) return
        if (e.shiftKey || e.metaKey || e.ctrlKey) { onSelect?.(card.id, true); return }
        onSelect?.(card.id, false)
      }}
    >
      {/* ── Edit panel (single, unlocked selection) ── */}
      {isSelected && editable && !isMultiSelect && (
        <div
          className="absolute bottom-full left-0 mb-2 flex items-center gap-0.5 bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-xl shadow-xl px-2 py-1.5 whitespace-nowrap"
          style={{ zIndex: 10 }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <ColorPicker value={card.color} onChange={(c) => onRecolor?.(card.id, c)} />
          <div className="w-px self-stretch bg-gray-200 mx-0.5" />
          <span className="text-[10px] font-medium text-gray-500 px-1">Lignes</span>
          <StepBtn label="Retirer une ligne" disabled={rows.length <= 1} onClick={delRow}>−</StepBtn>
          <StepBtn label="Ajouter une ligne" onClick={addRow}>+</StepBtn>
          <div className="w-px self-stretch bg-gray-200 mx-0.5" />
          <span className="text-[10px] font-medium text-gray-500 px-1">Colonnes</span>
          <StepBtn label="Retirer une colonne" disabled={rows[0].length <= 1} onClick={delCol}>−</StepBtn>
          <StepBtn label="Ajouter une colonne" onClick={addCol}>+</StepBtn>
        </div>
      )}

      {/* ── Drag grip (table cells capture their own mousedown for editing) ── */}
      <div
        className="flex items-center justify-center rounded-t-lg"
        style={{ height: GRIP_H, background: card.color, cursor: isReadonly ? 'default' : 'grab' }}
        onMouseDown={handleMouseDown}
        title="Déplacer le tableau"
      >
        <div className="w-6 h-1 rounded-full bg-black/15" />
      </div>

      {/* ── Table body ── */}
      <div className="overflow-hidden rounded-b-lg border border-gray-300 bg-white" style={{ height: card.height - GRIP_H }}>
        <table className="w-full h-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className="border border-gray-200 align-top p-0"
                    style={r === 0 ? { background: tint } : undefined}
                  >
                    <div
                      contentEditable={editable}
                      suppressContentEditableWarning
                      onMouseDown={(e) => e.stopPropagation()}
                      onBlur={(e) => editable && commitCell(r, c, e.currentTarget.textContent ?? '')}
                      className={`w-full h-full px-1.5 py-1 text-xs outline-none break-words overflow-hidden ${r === 0 ? 'font-semibold text-gray-700' : 'text-gray-600'} ${editable ? 'focus:bg-primary-50/60 cursor-text' : ''}`}
                    >
                      {cell}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editable && (
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
      {editable && !isMultiSelect && <BorderResizeHandles onStart={handleResizeMouseDown} />}
      {!isSelected && <ConnectHandles cardId={card.id} onStart={isReadonly ? undefined : onStartConnect} />}
      {linkCardsMode && onLinkCardsClick && (
        <LinkCardsOverlay cardId={card.id} isSource={isLinkSource} onClick={onLinkCardsClick} />
      )}
    </div>
  )
}

function StepBtn({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="w-6 h-6 rounded-lg flex items-center justify-center text-base leading-none text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}
