'use client'

import { useMemo, useState } from 'react'
import type { MeetEvent, Meeting } from '@/lib/meetops'
import { labelColor } from '@/lib/meetops'

const WEEKDAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

interface Placed {
  meeting: Meeting
  label: string | null
  color: string
}

// Clé de jour locale "YYYY-MM-DD".
function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Décalage lundi-début : getDay() 0=dim..6=sam → 0=lun..6=dim.
function mondayOffset(d: Date): number {
  return (d.getDay() + 6) % 7
}

export function EventCalendar({ event, onMeetingDblClick }: {
  event: MeetEvent
  onMeetingDblClick?: (meeting: Meeting) => void
}) {
  // Index des réunions par jour + couleur dérivée de l'étiquette.
  const { byDay, firstMonth } = useMemo(() => {
    const map = new Map<string, Placed[]>()
    let earliest: Date | null = null
    for (const m of event.meetings) {
      const d = new Date(m.startAt)
      const key = dayKey(d)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push({ meeting: m, label: m.label, color: labelColor(m.label) })
      if (!earliest || d < earliest) earliest = d
    }
    for (const list of map.values()) list.sort((a, b) => +new Date(a.meeting.startAt) - +new Date(b.meeting.startAt))
    const base = earliest ?? new Date()
    return { byDay: map, firstMonth: new Date(base.getFullYear(), base.getMonth(), 1) }
  }, [event])

  const [month, setMonth] = useState(firstMonth)

  const cells = useMemo(() => {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
    const gridStart = new Date(monthStart)
    gridStart.setDate(gridStart.getDate() - mondayOffset(monthStart))
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [month])

  const todayKey = dayKey(new Date())
  const monthLabel = month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
      {/* Barre de navigation */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white capitalize">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" title="Mois précédent">‹</button>
          <button onClick={() => setMonth(new Date())}
            className="px-2 h-8 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Aujourd&apos;hui</button>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" title="Mois suivant">›</button>
        </div>
      </div>

      {/* En-têtes jours */}
      <div className="grid grid-cols-7 gap-px mb-px">
        {WEEKDAY_HEADERS.map((d) => (
          <div key={d} className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wide py-1">{d}</div>
        ))}
      </div>

      {/* Grille */}
      <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === month.getMonth()
          const key = dayKey(d)
          const items = byDay.get(key) ?? []
          return (
            <div key={i} className={`min-h-[84px] p-1.5 bg-white dark:bg-gray-900 ${inMonth ? '' : 'opacity-40'}`}>
              <div className={`text-[11px] mb-1 ${key === todayKey ? 'font-bold text-primary-600' : 'text-gray-400'}`}>
                {d.getDate()}
              </div>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 3).map((it) => {
                  const time = new Date(it.meeting.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  const cancelled = it.meeting.status === 'CANCELLED'
                  return (
                    <div key={it.meeting.id}
                      title={`${it.label ? `${it.label} — ` : ''}${it.meeting.title} (${time})`}
                      onDoubleClick={() => onMeetingDblClick?.(it.meeting)}
                      className={[
                        'text-[10px] leading-tight rounded px-1 py-0.5 truncate',
                        cancelled ? 'line-through opacity-60' : '',
                        onMeetingDblClick ? 'cursor-pointer hover:brightness-90 transition-[filter]' : '',
                      ].join(' ')}
                      style={{ background: it.color, color: '#1f2937' }}>
                      {time} {it.meeting.title}
                    </div>
                  )
                })}
                {items.length > 3 && (
                  <div className="text-[10px] text-gray-400 pl-1">+{items.length - 3}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Légende des étiquettes */}
      {(() => {
        const labels = Array.from(new Set(event.meetings.map((m) => m.label).filter((l): l is string => !!l)))
        if (labels.length === 0) return null
        return (
          <div className="flex flex-wrap gap-3 mt-4">
            {labels.map((l) => (
              <div key={l} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: labelColor(l) }} />
                {l}
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}
