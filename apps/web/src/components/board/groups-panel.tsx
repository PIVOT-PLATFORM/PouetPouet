'use client'

import type { Card } from '@/hooks/useBoard'
import { groupColor } from '@/hooks/useBoard'

interface Props {
  cards: Card[]
  highlightedGroupId: string | null
  onHighlight: (groupId: string | null) => void
  onClose: () => void
  // Viewport anchor: `top` lines up with the usual gap below the navbar,
  // `right` aligns the panel's right edge with the Groups button.
  top: number
  right: number
}

export function GroupsPanel({ cards, highlightedGroupId, onHighlight, onClose, top, right }: Props) {
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
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-800">Groupes</span>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {groups.size === 0 ? (
        <p className="px-4 py-6 text-xs text-gray-400 text-center">Aucun groupe sur ce board.</p>
      ) : (
        <div className="flex flex-col py-2 max-h-72 overflow-y-auto">
          {Array.from(groups.entries()).map(([gid, gcards], i) => {
            const color = groupColor(gid)
            const isActive = highlightedGroupId === gid
            return (
              <button
                key={gid}
                onClick={() => onHighlight(isActive ? null : gid)}
                className={`flex items-center gap-2.5 px-4 py-2 text-left transition-colors ${
                  isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0 border-2"
                  style={{ borderColor: color, background: `${color}40` }}
                />
                <span className="text-sm text-gray-700 font-medium flex-1">
                  Groupe {i + 1}
                </span>
                <span className="text-xs text-gray-400 shrink-0">
                  {gcards.length} carte{gcards.length > 1 ? 's' : ''}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {highlightedGroupId && (
        <div className="border-t border-gray-100 px-4 py-2">
          <button
            onClick={() => onHighlight(null)}
            className="w-full text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            Effacer la mise en avant
          </button>
        </div>
      )}
    </div>
  )
}
