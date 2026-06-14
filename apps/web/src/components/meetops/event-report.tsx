'use client'

import { useMemo } from 'react'
import type { MeetEvent } from '@/lib/meetops'
import { MEETING_STATUS_LABELS, labelColor } from '@/lib/meetops'

// Tableau de bord d'un événement : métriques calculées depuis les réunions chargées.
export function EventReport({ event }: { event: MeetEvent }) {
  const stats = useMemo(() => {
    const meetings = event.meetings
    const total = meetings.length
    const byStatus = { DRAFT: 0, SENT: 0, UPDATED: 0, CANCELLED: 0 } as Record<string, number>
    const emails = new Set<string>()
    let totalMin = 0
    let chargeHours = 0
    const byLabel = new Map<string, number>()
    for (const m of meetings) {
      byStatus[m.status] = (byStatus[m.status] ?? 0) + 1
      totalMin += m.durationMin
      chargeHours += (m.durationMin / 60) * m.participants.length
      for (const p of m.participants) emails.add(p.email.toLowerCase())
      const key = m.label || '— sans étiquette'
      byLabel.set(key, (byLabel.get(key) ?? 0) + 1)
    }
    const sent = byStatus.SENT + byStatus.UPDATED
    return {
      total,
      byStatus,
      sendRate: total ? Math.round((sent / total) * 100) : 0,
      uniqueParticipants: emails.size,
      totalHours: Math.round((totalMin / 60) * 10) / 10,
      chargeHours: Math.round(chargeHours * 10) / 10,
      labels: [...byLabel.entries()].sort((a, b) => b[1] - a[1]),
      withoutParticipants: meetings.filter((m) => m.participants.length === 0).length,
    }
  }, [event])

  const cards = [
    { label: 'Réunions', value: stats.total },
    { label: 'Taux d\'envoi', value: `${stats.sendRate}%` },
    { label: 'Participants uniques', value: stats.uniqueParticipants },
    { label: 'Heures planifiées', value: `${stats.totalHours} h` },
    { label: 'Charge (h × pers.)', value: `${stats.chargeHours} h` },
    { label: 'Sans participant', value: stats.withoutParticipants, warn: stats.withoutParticipants > 0 },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
            <div className={`text-2xl font-bold ${c.warn ? 'text-amber-500' : 'text-gray-900 dark:text-white'}`}>{c.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Par statut</h3>
          <div className="flex flex-col gap-2">
            {(['DRAFT', 'SENT', 'UPDATED', 'CANCELLED'] as const).map((s) => {
              const n = stats.byStatus[s] ?? 0
              const pct = stats.total ? (n / stats.total) * 100 : 0
              return (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-20 text-gray-500 dark:text-gray-400 shrink-0">{MEETING_STATUS_LABELS[s]}</span>
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-gray-600 dark:text-gray-300">{n}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Par étiquette</h3>
          {stats.labels.length === 0 ? (
            <p className="text-xs text-gray-400">Aucune réunion.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {stats.labels.map(([label, n]) => {
                const pct = stats.total ? (n / stats.total) * 100 : 0
                return (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: labelColor(label.startsWith('—') ? null : label) }} />
                    <span className="w-28 truncate text-gray-500 dark:text-gray-400 shrink-0" title={label}>{label}</span>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: labelColor(label.startsWith('—') ? null : label) }} />
                    </div>
                    <span className="w-6 text-right text-gray-600 dark:text-gray-300">{n}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
