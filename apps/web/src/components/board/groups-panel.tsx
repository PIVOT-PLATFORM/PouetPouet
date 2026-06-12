'use client'

import type { Card } from '@/hooks/useBoard'
import { groupColor } from '@/hooks/useBoard'
import { ColorPopover } from '@/components/ui/color-picker'

interface Props {
  cards: Card[]
  highlightedGroupId: string | null
  onHighlight: (groupId: string | null) => void
  onRecolor: (groupId: string, color: string) => void
  onDelete: (groupId: string) => void
  onClose: () => void
  top: number
  right: number
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export function GroupsPanel({ cards, highlightedGroupId, onHighlight, onRecolor, onDelete, onClose, top, right, onMouseEnter, onMouseLeave }: Props) {
  const groups = new Map<string, Card[]>()
  cards.forEach((c) => {
    if (!c.groupId) return
    const g = groups.get(c.groupId) ?? []
    g.push(c)
    groups.set(c.groupId, g)
  })

  return (
    <div
      style={{ position: 'fixed', top, right }}
      className="w-56 bg-white rounded-2xl shadow-xl border border-gray-100 z-[200] flex flex-col overflow-hidden"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-800">Groupes</span>
        {highlightedGroupId && (
          <button
            onClick={() => onHighlight(null)}
            className="text-[10px] font-medium text-primary-500 hover:text-primary-700 transition-colors"
            title="Désactiver la surbrillance"
          >
            Effacer
          </button>
        )}
      </div>

      {groups.size === 0 ? (
        <p className="px-4 py-6 text-xs text-gray-400 text-center">Aucun groupe sur ce board.</p>
      ) : (
        <div className="flex flex-col py-2 max-h-72 overflow-y-auto">
          {Array.from(groups.entries()).map(([gid, gcards], i) => {
            const color = gcards.find((c) => c.groupColor)?.groupColor ?? groupColor(gid)
            const isActive = highlightedGroupId === gid
            return (
              <div
                key={gid}
                className={`group/row flex items-center gap-2 pl-3 pr-2 py-1.5 transition-colors ${
                  isActive ? 'bg-primary-50' : 'hover:bg-gray-50'
                }`}
              >
                {/* Outline color picker */}
                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  <ColorPopover
                    value={color}
                    onChange={(c) => onRecolor(gid, c)}
                    title="Couleur du contour"
                    align="left"
                  />
                </div>

                {/* Highlight toggle */}
                <button
                  onClick={() => onHighlight(isActive ? null : gid)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  <span className="text-sm text-gray-700 font-medium flex-1 truncate">
                    Groupe {i + 1}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {gcards.length} carte{gcards.length > 1 ? 's' : ''}
                  </span>
                </button>

                {/* Delete (dissolve) group */}
                <button
                  onClick={() => onDelete(gid)}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/row:opacity-100 transition-all"
                  title="Supprimer le groupe"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
