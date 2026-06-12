'use client'

import { useState } from 'react'
import type { WheelDraw, WheelEvent, DrawMode } from '@/hooks/useWheel'

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const MODE_BADGE: Record<DrawMode, { label: string; cls: string }> = {
  WEIGHTED: { label: 'Équilibré', cls: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400' },
  RANDOM:   { label: 'Aléatoire', cls: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400' },
}

const PAGE_SIZE_EVENT = 5
const PAGE_SIZE_STANDALONE = 4

function Pagination({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / pageSize)
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 pt-1">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 px-1"
      >
        ‹
      </button>
      <span className="text-xs text-gray-400">{page + 1} / {pages}</span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= pages - 1}
        className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 px-1"
      >
        ›
      </button>
    </div>
  )
}

function DrawHistoryItem({ draw, onDelete }: { draw: WheelDraw; onDelete: (id: string) => void }) {
  const badge = MODE_BADGE[draw.mode] ?? MODE_BADGE.WEIGHTED
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-1 mb-1">
          {draw.results.map((r, i) => (
            <span key={i} className="text-xs font-semibold bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 rounded-lg px-2 py-0.5">
              {r}
            </span>
          ))}
        </div>
        {draw.note && (
          <p className="text-xs text-gray-400 italic truncate">{draw.note}</p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-gray-300 dark:text-gray-600">{formatShortDate(draw.createdAt)} · {draw.teamName}</p>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${badge.cls}`}>{badge.label}</span>
        </div>
      </div>
      <button
        onClick={() => onDelete(draw.id)}
        className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}

export function EventSection({
  event,
  onDelete,
  onRename,
  onDeleteDraw,
}: {
  event: WheelEvent
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onDeleteDraw: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(event.name)
  const [page, setPage] = useState(0)

  const visibleDraws = event.draws.slice(page * PAGE_SIZE_EVENT, (page + 1) * PAGE_SIZE_EVENT)

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-sm">{expanded ? '▾' : '▸'}</span>
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { onRename(event.id, name); setEditing(false) }
              if (e.key === 'Escape') { setName(event.name); setEditing(false) }
            }}
            onBlur={() => { onRename(event.id, name); setEditing(false) }}
            className="flex-1 text-sm font-semibold bg-transparent border-b border-primary-400 focus:outline-none"
          />
        ) : (
          <span className="flex-1 text-sm font-semibold text-gray-800 dark:text-white truncate">{event.name}</span>
        )}
        <span className="text-xs text-gray-400 shrink-0">{event.draws.length} tirage{event.draws.length !== 1 ? 's' : ''}</span>
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true) }}
          className="text-gray-300 hover:text-primary-500 transition-colors text-xs px-1"
          title="Renommer"
        >
          ✎
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(event.id) }}
          className="text-gray-300 hover:text-red-400 transition-colors text-xs px-1"
          title="Supprimer"
        >
          ✕
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-2">
          {event.draws.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Aucun tirage dans cet événement</p>
          ) : (
            <>
              {visibleDraws.map((d) => (
                <DrawHistoryItem key={d.id} draw={d} onDelete={onDeleteDraw} />
              ))}
              <Pagination page={page} total={event.draws.length} pageSize={PAGE_SIZE_EVENT} onChange={setPage} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function StandaloneDrawsSection({ draws, onDelete }: { draws: WheelDraw[]; onDelete: (id: string) => void }) {
  const [page, setPage] = useState(0)
  const visible = draws.slice(page * PAGE_SIZE_STANDALONE, (page + 1) * PAGE_SIZE_STANDALONE)
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Tirages sans événement</p>
      {visible.map((d) => (
        <DrawHistoryItem key={d.id} draw={d} onDelete={onDelete} />
      ))}
      <Pagination page={page} total={draws.length} pageSize={PAGE_SIZE_STANDALONE} onChange={setPage} />
    </div>
  )
}
