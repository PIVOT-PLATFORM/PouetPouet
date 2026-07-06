'use client'

import { memo } from 'react'
import type { PiTicket, PiTicketType } from '@/hooks/usePi'

export const TICKET_TYPES: { value: PiTicketType; label: string; color: string }[] = [
  { value: 'FEATURE', label: 'Feature', color: '#3b82f6' },
  { value: 'MILESTONE', label: 'Milestone', color: '#8b5cf6' },
  { value: 'OBJECTIVE', label: 'Objectif', color: '#f59e0b' },
  { value: 'RISK', label: 'Risque', color: '#f97316' },
  { value: 'STORY', label: 'Story', color: '#6b7280' },
  { value: 'ENABLER', label: 'Enabler', color: '#06b6d4' },
]

export function ticketColor(type: PiTicketType): string {
  return TICKET_TYPES.find((t) => t.value === type)?.color ?? '#6b7280'
}

export const PiTicketCard = memo(function PiTicketCard({ ticket, canEdit, linkMode, isLinkSource, isDragging, registerAnchor, onDragStart, onDragEnd, onClick }: {
  ticket: PiTicket
  canEdit: boolean
  linkMode: boolean
  isLinkSource: boolean
  isDragging: boolean
  registerAnchor: (ticketId: string, el: HTMLElement | null) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onClick: (ticket: PiTicket) => void
}) {
  const color = ticketColor(ticket.type)
  const typeLabel = TICKET_TYPES.find((t) => t.value === ticket.type)?.label

  return (
    <div
      ref={(el) => registerAnchor(ticket.id, el)}
      draggable={canEdit && !linkMode}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', ticket.id); e.dataTransfer.effectAllowed = 'move'; onDragStart(ticket.id) }}
      onDragEnd={onDragEnd}
      onClick={(e) => { e.stopPropagation(); onClick(ticket) }}
      title={ticket.description ?? undefined}
      className={`rounded-lg border bg-white dark:bg-gray-900 px-2 py-1.5 shadow-sm transition-all
        ${canEdit && !linkMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
        ${isDragging ? 'opacity-40' : 'opacity-100'}
        ${isLinkSource ? 'ring-2 ring-sky-400 border-sky-300' : linkMode ? 'hover:ring-2 hover:ring-sky-300 border-gray-100 dark:border-gray-800' : 'border-gray-100 dark:border-gray-800 hover:shadow'}`}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color }}>{typeLabel}</span>
      <p className="text-xs text-gray-800 dark:text-gray-100 leading-snug break-words line-clamp-2">{ticket.title}</p>
    </div>
  )
})
