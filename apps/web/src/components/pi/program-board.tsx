'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Link2, Plus, X } from 'lucide-react'
import type { PiBoard, PiDependencyStatus, PiTicket } from '@/hooks/usePi'
import { PiTicketCard, TICKET_TYPES } from './pi-ticket-card'
import { DependencyLayer } from './dependency-layer'

export interface BoardCell { teamId: string | null; iterationId: string | null }

function cellKey(teamId: string | null, iterationId: string | null): string {
  return `${teamId ?? 'train'}:${iterationId ?? 'none'}`
}

function frDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

// Cellule de la matrice = zone de drop HTML5 (pattern du kanban Feedback :
// compteur dragenter/dragleave pour gérer les enfants imbriqués).
function Cell({ cell, tickets, canEdit, linkMode, linkSource, draggedId, isTrain, registerAnchor, onDrop, onDragStart, onDragEnd, onTicketClick, onAdd }: {
  cell: BoardCell
  tickets: PiTicket[]
  canEdit: boolean
  linkMode: boolean
  linkSource: string | null
  draggedId: string | null
  isTrain: boolean
  registerAnchor: (ticketId: string, el: HTMLElement | null) => void
  onDrop: (ticketId: string, cell: BoardCell) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onTicketClick: (ticket: PiTicket) => void
  onAdd: (cell: BoardCell) => void
}) {
  const [isOver, setIsOver] = useState(false)
  const overCount = useRef(0)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    overCount.current = 0
    setIsOver(false)
    const id = e.dataTransfer.getData('text/plain')
    if (!id || tickets.some((t) => t.id === id)) return // déjà dans cette cellule
    onDrop(id, cell)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDragEnter={(e) => { e.preventDefault(); overCount.current += 1; setIsOver(true) }}
      onDragLeave={() => { overCount.current -= 1; if (overCount.current === 0) setIsOver(false) }}
      onDrop={handleDrop}
      className={`group/cell min-h-[72px] border-l border-t border-gray-100 dark:border-gray-800 p-1.5 flex flex-col gap-1.5 transition-colors
        ${isOver && draggedId ? 'bg-sky-50 dark:bg-sky-950/40' : isTrain ? 'bg-sky-50/40 dark:bg-sky-950/15' : ''}`}
    >
      {tickets.map((t) => (
        <PiTicketCard
          key={t.id}
          ticket={t}
          canEdit={canEdit}
          linkMode={linkMode}
          isLinkSource={linkSource === t.id}
          isDragging={draggedId === t.id}
          registerAnchor={registerAnchor}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onClick={onTicketClick}
        />
      ))}
      {canEdit && !linkMode && (
        <button
          onClick={() => onAdd(cell)}
          className="flex items-center justify-center py-1 rounded-lg text-gray-300 dark:text-gray-700 opacity-0 group-hover/cell:opacity-100 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-all"
          title="Ajouter un ticket"
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  )
}

export function ProgramBoard({ board, canEdit, onMoveTicket, onEditTicket, onAddTicket, onCreateDependency, onUpdateDependency, onDeleteDependency }: {
  board: PiBoard
  canEdit: boolean
  onMoveTicket: (ticketId: string, patch: BoardCell & { order: number }) => void
  onEditTicket: (ticket: PiTicket) => void
  onAddTicket: (cell: BoardCell) => void
  onCreateDependency: (fromTicketId: string, toTicketId: string) => Promise<string | null>
  onUpdateDependency: (depId: string, patch: { status?: PiDependencyStatus; note?: string | null }) => void
  onDeleteDependency: (depId: string) => void
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const anchors = useRef(new Map<string, HTMLElement>())
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [linkMode, setLinkMode] = useState(false)
  const [linkSource, setLinkSource] = useState<string | null>(null)
  const [depError, setDepError] = useState<string | null>(null)

  useEffect(() => {
    if (!depError) return
    const timer = setTimeout(() => setDepError(null), 5000)
    return () => clearTimeout(timer)
  }, [depError])

  const registerAnchor = useCallback((ticketId: string, el: HTMLElement | null) => {
    if (el) anchors.current.set(ticketId, el)
    else anchors.current.delete(ticketId)
  }, [])

  // Colonnes : « Non planifié » puis IT1…IP ; lignes : Train puis équipes.
  const columns = useMemo(() => [
    { id: null as string | null, label: 'Non planifié', sub: null as string | null },
    ...board.iterations.map((it) => ({ id: it.id as string | null, label: it.label, sub: `${frDate(it.startDate)} → ${frDate(it.endDate)}` as string | null })),
  ], [board.iterations])
  const rows = useMemo(() => [
    { id: null as string | null, name: 'Train', color: '#0ea5e9' },
    ...board.teams.map((t) => ({ id: t.id as string | null, name: t.name, color: t.color })),
  ], [board.teams])

  const ticketsByCell = useMemo(() => {
    const map = new Map<string, PiTicket[]>()
    for (const t of [...board.tickets].sort((a, b) => a.order - b.order)) {
      const key = cellKey(t.teamId, t.iterationId)
      const list = map.get(key) ?? []
      list.push(t)
      map.set(key, list)
    }
    return map
  }, [board.tickets])

  // Signature de placement : recalcul des flèches quand un ticket change de cellule/ordre.
  const revision = useMemo(
    () => board.tickets.map((t) => `${t.id}:${t.teamId}:${t.iterationId}:${t.order}`).join('|'),
    [board.tickets],
  )

  function handleDrop(ticketId: string, cell: BoardCell) {
    const target = ticketsByCell.get(cellKey(cell.teamId, cell.iterationId)) ?? []
    const order = target.length > 0 ? Math.max(...target.map((t) => t.order)) + 1 : 0
    onMoveTicket(ticketId, { ...cell, order })
  }

  async function handleTicketClick(ticket: PiTicket) {
    if (!linkMode) {
      onEditTicket(ticket)
      return
    }
    if (!linkSource) {
      setLinkSource(ticket.id)
      return
    }
    if (linkSource === ticket.id) {
      setLinkSource(null)
      return
    }
    const error = await onCreateDependency(linkSource, ticket.id)
    if (error) setDepError(error)
    setLinkSource(null)
  }

  const gridTemplateColumns = `170px repeat(${columns.length}, minmax(220px, 1fr))`

  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1">
      {/* Barre d'outils : légende des types + mode « Lier » */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap text-xs text-gray-500 dark:text-gray-400">
          {TICKET_TYPES.map((t) => (
            <span key={t.value} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
              {t.label}
            </span>
          ))}
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 rounded bg-emerald-500" />Dépendance OK</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 rounded bg-red-500" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #ef4444 0 4px, transparent 4px 7px)' }} />Bloquante</span>
        </div>
        <div className="flex-1" />
        {canEdit && (
          <button
            onClick={() => { setLinkMode((v) => !v); setLinkSource(null) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors
              ${linkMode ? 'bg-sky-500 border-sky-500 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-sky-300 hover:text-sky-600'}`}
          >
            <Link2 size={13} /> {linkMode ? 'Terminer' : 'Lier des tickets'}
          </button>
        )}
      </div>
      {linkMode && (
        <p className="text-xs text-sky-600 dark:text-sky-400 -mt-1">
          {linkSource ? 'Cliquez sur le ticket qui dépend du premier (demandeur).' : 'Cliquez sur le ticket fournisseur (celui dont on dépend).'}
        </p>
      )}
      {depError && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          <span className="flex-1">{depError}</span>
          <button onClick={() => setDepError(null)}><X size={13} /></button>
        </div>
      )}

      {/* Matrice : conteneur scrollable, wrapper relative à la taille du contenu
          (porte l'overlay SVG des dépendances → les flèches défilent avec lui). */}
      <div className="flex-1 min-h-0 overflow-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div ref={wrapperRef} className="relative grid w-max min-w-full" style={{ gridTemplateColumns }}>
          {/* En-tête */}
          <div className="sticky top-0 left-0 z-40 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
            Équipes
          </div>
          {columns.map((col) => (
            <div key={col.id ?? 'none'} className={`sticky top-0 z-30 border-b border-l border-gray-200 dark:border-gray-700 px-3 py-2 ${col.id === null ? 'bg-gray-50/80 dark:bg-gray-800/80' : 'bg-gray-50 dark:bg-gray-800'}`}>
              <p className={`text-xs font-semibold ${col.id === null ? 'text-gray-400 italic' : 'text-gray-700 dark:text-gray-200'}`}>{col.label}</p>
              {col.sub && <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{col.sub}</p>}
            </div>
          ))}

          {/* Lignes : Train puis équipes */}
          {rows.map((row) => (
            <div key={row.id ?? 'train'} className="contents">
              <div className={`sticky left-0 z-20 border-t border-gray-100 dark:border-gray-800 px-3 py-2.5 flex items-start gap-2 ${row.id === null ? 'bg-sky-50 dark:bg-sky-950' : 'bg-white dark:bg-gray-900'}`}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5" style={{ background: row.color }} />
                <span className={`text-xs font-semibold leading-tight ${row.id === null ? 'text-sky-700 dark:text-sky-400' : 'text-gray-700 dark:text-gray-200'}`}>{row.name}</span>
              </div>
              {columns.map((col) => {
                const cell: BoardCell = { teamId: row.id, iterationId: col.id }
                return (
                  <Cell
                    key={`${row.id ?? 'train'}:${col.id ?? 'none'}`}
                    cell={cell}
                    tickets={ticketsByCell.get(cellKey(cell.teamId, cell.iterationId)) ?? []}
                    canEdit={canEdit}
                    linkMode={linkMode}
                    linkSource={linkSource}
                    draggedId={draggedId}
                    isTrain={row.id === null}
                    registerAnchor={registerAnchor}
                    onDrop={handleDrop}
                    onDragStart={setDraggedId}
                    onDragEnd={() => setDraggedId(null)}
                    onTicketClick={handleTicketClick}
                    onAdd={onAddTicket}
                  />
                )
              })}
            </div>
          ))}

          <DependencyLayer
            dependencies={board.dependencies}
            anchors={anchors}
            wrapperRef={wrapperRef}
            revision={revision}
            canEdit={canEdit}
            onUpdate={onUpdateDependency}
            onDelete={onDeleteDependency}
          />
        </div>
      </div>
    </div>
  )
}
