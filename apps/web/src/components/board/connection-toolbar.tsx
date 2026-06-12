'use client'

import { useEffect, useState } from 'react'
import type { Connection, ConnectionPatch, ConnShape, ConnArrow } from '@/hooks/useBoard'
import { ColorPopover } from '@/components/ui/color-picker'

const WIDTHS: { w: number; label: string }[] = [
  { w: 1.5, label: 'Fin' },
  { w: 2.5, label: 'Moyen' },
  { w: 5, label: 'Épais' },
]
const SHAPES: { v: ConnShape; title: string; d: string }[] = [
  { v: 'straight', title: 'Droite', d: 'M3 17L17 3' },
  { v: 'curved', title: 'Courbe', d: 'M3 16C3 8 12 12 12 12S17 12 17 4' },
  { v: 'orthogonal', title: 'Coudée', d: 'M3 4v8a2 2 0 002 2h12' },
]
const ARROWS: { v: ConnArrow; title: string; label: string }[] = [
  { v: 'none', title: 'Aucune flèche', label: '—' },
  { v: 'start', title: 'Flèche au départ', label: '←' },
  { v: 'end', title: 'Flèche à l\'arrivée', label: '→' },
  { v: 'both', title: 'Double flèche', label: '↔' },
]

function Cell({ active, title, onClick, children }: { active: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`h-7 min-w-7 px-1.5 rounded-md flex items-center justify-center transition-colors ${
        active ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5" />
}

export function ConnectionToolbar({ conn, onUpdate, onDelete }: {
  conn: Connection
  onUpdate: (patch: ConnectionPatch) => void
  onDelete: () => void
}) {
  const [label, setLabel] = useState(conn.label ?? '')
  useEffect(() => { setLabel(conn.label ?? '') }, [conn.id, conn.label])

  function commitLabel() {
    const next = label.trim() || null
    if (next !== (conn.label ?? null)) onUpdate({ label: next })
  }

  return (
    <div
      data-popover-anchor
      className="flex items-center gap-0.5 bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-xl shadow-xl px-1.5 py-1"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <ColorPopover value={conn.color || '#9ca3af'} onChange={(c) => onUpdate({ color: c })} title="Couleur" align="left" />

      <Sep />

      {WIDTHS.map((x) => (
        <Cell key={x.w} active={Math.abs(conn.width - x.w) < 0.3} title={x.label} onClick={() => onUpdate({ width: x.w })}>
          <div className="w-4 rounded-full bg-current" style={{ height: x.w }} />
        </Cell>
      ))}

      <Sep />

      <Cell active={conn.dashed} title="Pointillés" onClick={() => onUpdate({ dashed: !conn.dashed })}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} fill="none">
          <path strokeLinecap="round" strokeDasharray="4 4" d="M3 12h18" />
        </svg>
      </Cell>

      <Sep />

      {SHAPES.map((s) => (
        <Cell key={s.v} active={conn.shape === s.v} title={s.title} onClick={() => onUpdate({ shape: s.v })}>
          <svg className="w-4 h-4" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={2} fill="none">
            <path strokeLinecap="round" strokeLinejoin="round" d={s.d} />
          </svg>
        </Cell>
      ))}

      <Sep />

      {ARROWS.map((arr) => (
        <Cell key={arr.v} active={conn.arrow === arr.v} title={arr.title} onClick={() => onUpdate({ arrow: arr.v })}>
          <span className="text-sm font-semibold leading-none">{arr.label}</span>
        </Cell>
      ))}

      <Sep />

      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commitLabel}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
        placeholder="Label…"
        className="h-7 w-24 rounded-md border border-gray-200 px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-400"
      />

      <Sep />

      <button title="Supprimer la liaison" onClick={onDelete} className="h-7 w-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}
