'use client'

import { useState, useRef } from 'react'
import type { PresenceUser, BoardMember } from '@/hooks/useBoard'

// Toolbar avatar cluster + hover dropdown listing who is connected on the board.
// `dropdownTop` fixes the dropdown's viewport top so it lines up with the floating
// toolbar's initial position rather than hugging the header bar.
export function PresenceIndicator({ presence, members, dropdownTop = 120 }: { presence: PresenceUser[]; members: BoardMember[]; dropdownTop?: number }) {
  const [showPresence, setShowPresence] = useState(false)
  const [presenceRect, setPresenceRect] = useState<DOMRect | null>(null)
  const presenceTriggerRef = useRef<HTMLDivElement>(null)
  const presenceLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handlePresenceEnter() {
    if (presenceLeaveTimer.current) clearTimeout(presenceLeaveTimer.current)
    if (presenceTriggerRef.current) setPresenceRect(presenceTriggerRef.current.getBoundingClientRect())
    setShowPresence(true)
  }

  function handlePresenceLeave() {
    presenceLeaveTimer.current = setTimeout(() => setShowPresence(false), 150)
  }

  if (members.length === 0) return null

  const connectedIds = new Set(presence.map((u) => u.id))
  const sortedMembers = [...members].sort((a, b) => (connectedIds.has(b.id) ? 1 : 0) - (connectedIds.has(a.id) ? 1 : 0))
  const triggerUsers = presence.length > 0 ? presence : members

  return (
    <div
      ref={presenceTriggerRef}
      className="shrink-0 flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-gray-100 transition-colors cursor-default select-none"
      onMouseEnter={handlePresenceEnter}
      onMouseLeave={handlePresenceLeave}
    >
      <div className="flex -space-x-1.5">
        {triggerUsers.slice(0, 3).map((u) => (
          <div
            key={u.id}
            className={`w-6 h-6 rounded-full ring-2 ring-white overflow-hidden flex items-center justify-center shrink-0 ${presence.length > 0 ? 'bg-primary-100' : 'bg-gray-100'}`}
          >
            {u.avatar
              ? <img src={u.avatar} alt={u.name} className={`w-full h-full object-cover ${presence.length === 0 ? 'opacity-40' : ''}`} />
              : <span className={`text-[10px] font-semibold ${presence.length > 0 ? 'text-primary-600' : 'text-gray-400'}`}>{u.name.charAt(0).toUpperCase()}</span>
            }
          </div>
        ))}
        {presence.length > 3 && (
          <div className="w-6 h-6 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-semibold text-gray-600">+{presence.length - 3}</span>
          </div>
        )}
      </div>
      <span className="text-xs font-medium text-gray-500">
        {presence.length}/{members.length}
      </span>

      {/* Dropdown flottant en position fixed pour passer au-dessus de tout */}
      {showPresence && presenceRect && (
        <div
          style={{ position: 'fixed', top: dropdownTop, right: window.innerWidth - presenceRect.right }}
          className="w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-[200]"
          onMouseEnter={handlePresenceEnter}
          onMouseLeave={handlePresenceLeave}
        >
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pb-1.5">
            {presence.length} connecté{presence.length > 1 ? 's' : ''} · {members.length} membre{members.length > 1 ? 's' : ''}
          </p>
          {sortedMembers.map((m: BoardMember) => {
            const isOnline = connectedIds.has(m.id)
            return (
              <div key={m.id} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50">
                <div className="relative shrink-0">
                  <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
                    {m.avatar
                      ? <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                      : <span className="text-xs font-semibold text-primary-600">{m.name.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  {isOnline && <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-400 ring-1 ring-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{m.name}</p>
                  <p className="text-[10px] text-gray-400">
                    {m.role === 'OWNER' ? 'Propriétaire' : m.role === 'EDITOR' ? 'Éditeur' : 'Lecteur'}
                    {isOnline && <span className="ml-1.5 text-green-500">· en ligne</span>}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
