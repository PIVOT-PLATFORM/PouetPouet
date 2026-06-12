'use client'

import { use, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCapacityEvent } from '@/hooks/useCapacity'
// NB: useRouter is used inside DeleteButton; the main component navigates via <Link>.
import type { CapacityEvent, CapacityEventMember, CapacityEventStatus } from '@/hooks/useCapacity'
import {
  EVENT_TYPE_LABELS, EVENT_TYPE_EMOJI, EVENT_STATUS_LABELS, WEEKDAY_LABELS,
  computeEventCapacity, computeMemberCapacity, summarizeHistory, formatDateRange, toDateInput,
} from '@/lib/capacity'

const STATUSES: CapacityEventStatus[] = ['PLANNING', 'ACTIVE', 'DONE']

export default function CapacityEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const {
    event, history, isLoading, error,
    updateEvent, addMember, updateMember, deleteMember, addAbsence, deleteAbsence,
  } = useCapacityEvent(id)

  const cap = useMemo(() => (event ? computeEventCapacity(event) : null), [event])
  const hist = useMemo(() => (event ? summarizeHistory(history, event) : null), [history, event])

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" /></div>
  }
  if (error || !event || !cap) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Événement introuvable</h2>
        <Link href="/capacity" className="text-sm text-primary-600 hover:text-primary-700 mt-3 inline-block">← Retour</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div>
        <Link href="/capacity" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 inline-flex items-center gap-1 mb-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Capacité
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{EVENT_TYPE_EMOJI[event.type]}</span>
            <div>
              <input
                value={event.name}
                onChange={(e) => updateEvent({ name: e.target.value })}
                className="text-2xl font-bold text-gray-900 dark:text-white bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-primary-400 rounded-lg px-1 -mx-1 outline-none"
              />
              <p className="text-sm text-gray-400 mt-0.5">
                {EVENT_TYPE_LABELS[event.type]} · {formatDateRange(event.startDate, event.endDate)}
                {event.parent && <> · ↳ <Link href={`/capacity/${event.parent.id}`} className="text-primary-500 hover:underline">{event.parent.name}</Link></>}
              </p>
            </div>
          </div>
          {/* Status switcher */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            {STATUSES.map((s) => (
              <button
                key={s} onClick={() => updateEvent({ status: s })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  event.status === s ? EVENT_STATUS_LABELS[s].cls : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                {EVENT_STATUS_LABELS[s].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Jours ouvrés" value={String(cap.totalWorkingDays)} hint="dans la période" />
        <SummaryCard label="Jours·homme nets" value={String(cap.totalNetPersonDays)} hint="après FTE & absences" accent />
        <SummaryCard label="Capacité (heures)" value={String(cap.totalHours)} hint={`focus ${Math.round(event.focusFactor * 100)}%`} />
        <SummaryCard
          label="Capacité (points)"
          value={cap.totalPoints != null ? String(cap.totalPoints) : '—'}
          hint={event.pointsPerPersonDay != null ? `${event.pointsPerPersonDay} pts/j·h` : 'vélocité non définie'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: members + absences ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <MembersPanel
            event={event}
            onAddMember={addMember}
            onUpdateMember={updateMember}
            onDeleteMember={deleteMember}
            onAddAbsence={addAbsence}
            onDeleteAbsence={deleteAbsence}
          />

          {/* Children (sub-events of a PI) */}
          {event.children && event.children.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Événements rattachés</h3>
              <div className="flex flex-col gap-2">
                {event.children.map((c) => (
                  <Link key={c.id} href={`/capacity/${c.id}`} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-primary-600 transition-colors">
                    <span>{EVENT_TYPE_EMOJI[c.type]}</span> {c.name}
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-md ${EVENT_STATUS_LABELS[c.status].cls}`}>{EVENT_STATUS_LABELS[c.status].label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: params + planning + history ── */}
        <div className="flex flex-col gap-6">
          <ParamsPanel event={event} onUpdate={updateEvent} />
          <PlanningPanel event={event} cap={cap} onUpdate={updateEvent} />
          <HistoryPanel event={event} hist={hist} onApplyVelocity={(v) => updateEvent({ pointsPerPersonDay: v })} />
        </div>
      </div>

      {/* Danger zone */}
      <div className="flex justify-end">
        <DeleteButton eventId={event.id} />
      </div>
    </div>
  )
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'bg-primary-50 border-primary-100 dark:bg-primary-950/40 dark:border-primary-900' : 'bg-white border-gray-100 dark:bg-gray-900 dark:border-gray-800'}`}>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>{value}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )
}

// ── Members panel ─────────────────────────────────────────────────────────────

function MembersPanel({
  event, onAddMember, onUpdateMember, onDeleteMember, onAddAbsence, onDeleteAbsence,
}: {
  event: CapacityEvent
  onAddMember: (m: { name: string; role?: string; fte?: number }) => Promise<unknown>
  onUpdateMember: (id: string, patch: { name?: string; role?: string | null; fte?: number; focusFactor?: number | null }) => Promise<unknown>
  onDeleteMember: (id: string) => Promise<unknown>
  onAddAbsence: (memberId: string, abs: { startDate: string; endDate: string; fraction?: number; reason?: string }) => Promise<unknown>
  onDeleteAbsence: (memberId: string, absenceId: string) => Promise<unknown>
}) {
  const [newName, setNewName] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    await onAddMember({ name: newName.trim() })
    setNewName('')
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Membres & disponibilité</h3>
        <span className="text-xs text-gray-400">{event.members.length} pers.</span>
      </div>

      {/* Column header */}
      <div className="hidden sm:flex items-center gap-2 px-5 py-2 text-[11px] font-medium text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-800/50">
        <span className="flex-1">Nom</span>
        <span className="w-20 text-center">FTE</span>
        <span className="w-20 text-center">Focus</span>
        <span className="w-16 text-center">Absences</span>
        <span className="w-20 text-right">Net j·h</span>
        <span className="w-6" />
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {event.members.length === 0 && (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">Ajoutez les membres qui participent à cet événement.</p>
        )}
        {[...event.members].sort((a, b) => a.order - b.order).map((m) => {
          const mc = computeMemberCapacity(m, event)
          const isOpen = expanded === m.id
          return (
            <div key={m.id}>
              <div className="flex items-center gap-2 px-5 py-2.5">
                <input
                  defaultValue={m.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== m.name && onUpdateMember(m.id, { name: e.target.value.trim() })}
                  className="flex-1 min-w-0 bg-transparent text-sm font-medium text-gray-800 dark:text-gray-100 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-primary-400 rounded-lg px-1.5 py-1 outline-none"
                />
                <input
                  type="number" min="0" max="1" step="0.1" defaultValue={m.fte}
                  onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v !== m.fte) onUpdateMember(m.id, { fte: v }) }}
                  className="w-20 text-center text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-1 py-1 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <input
                  type="number" min="0" max="1" step="0.05"
                  defaultValue={m.focusFactor ?? ''}
                  placeholder={`${Math.round(event.focusFactor * 100)}%`}
                  onBlur={(e) => {
                    const raw = e.target.value.trim()
                    const v = raw === '' ? null : parseFloat(raw)
                    if (v !== (m.focusFactor ?? null)) onUpdateMember(m.id, { focusFactor: v })
                  }}
                  className="w-20 text-center text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-1 py-1 focus:outline-none focus:ring-2 focus:ring-primary-400"
                  title="Focus factor individuel (laisser vide = défaut de l'événement)"
                />
                <button
                  onClick={() => setExpanded(isOpen ? null : m.id)}
                  className={`w-16 text-center text-xs font-medium rounded-lg py-1 transition-colors ${
                    m.absences.length > 0 ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  title="Gérer les absences"
                >
                  {mc.absentDays > 0 ? `−${mc.absentDays}j` : '+'}
                </button>
                <span className="w-20 text-right text-sm font-semibold text-gray-800 dark:text-gray-100 tabular-nums">{mc.netPersonDays}</span>
                <button onClick={() => onDeleteMember(m.id)} className="w-6 text-gray-300 hover:text-red-500 transition-colors" title="Retirer">✕</button>
              </div>

              {isOpen && (
                <AbsenceEditor
                  member={m}
                  event={event}
                  onAdd={(abs) => onAddAbsence(m.id, abs)}
                  onDelete={(absId) => onDeleteAbsence(m.id, absId)}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Add member */}
      <form onSubmit={handleAdd} className="flex gap-2 p-3 border-t border-gray-100 dark:border-gray-800">
        <input
          value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ajouter un membre…"
          className="flex-1 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <button type="submit" disabled={!newName.trim()} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40">Ajouter</button>
      </form>
    </div>
  )
}

// ── Absence editor (per member) ───────────────────────────────────────────────

function AbsenceEditor({
  member, event, onAdd, onDelete,
}: {
  member: CapacityEventMember
  event: CapacityEvent
  onAdd: (abs: { startDate: string; endDate: string; fraction?: number; reason?: string }) => Promise<unknown>
  onDelete: (absenceId: string) => Promise<unknown>
}) {
  const [start, setStart] = useState(toDateInput(event.startDate))
  const [end, setEnd] = useState(toDateInput(event.startDate))
  const [fraction, setFraction] = useState(1)
  const [reason, setReason] = useState('')

  async function handleAdd() {
    if (!start || !end) return
    await onAdd({ startDate: start, endDate: end, fraction, reason: reason.trim() || undefined })
    setReason('')
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800/40 px-5 py-4">
      {member.absences.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3">
          {member.absences.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <span className="font-medium">{toDateInput(a.startDate)} → {toDateInput(a.endDate)}</span>
              {a.fraction !== 1 && <span className="text-amber-600">½</span>}
              {a.reason && <span className="text-gray-400">· {a.reason}</span>}
              <button onClick={() => onDelete(a.id)} className="ml-auto text-gray-300 hover:text-red-500">✕</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[10px] text-gray-400 uppercase mb-0.5">Du</label>
          <input type="date" value={start} min={toDateInput(event.startDate)} max={toDateInput(event.endDate)} onChange={(e) => setStart(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 uppercase mb-0.5">Au</label>
          <input type="date" value={end} min={start} max={toDateInput(event.endDate)} onChange={(e) => setEnd(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 uppercase mb-0.5">Durée</label>
          <select value={fraction} onChange={(e) => setFraction(parseFloat(e.target.value))}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400">
            <option value={1}>Journée(s)</option>
            <option value={0.5}>Demi-journée</option>
          </select>
        </div>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif (congés…)"
          className="flex-1 min-w-[120px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400" />
        <button onClick={handleAdd} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">+ Absence</button>
      </div>
    </div>
  )
}

// ── Params panel ──────────────────────────────────────────────────────────────

function ParamsPanel({ event, onUpdate }: { event: CapacityEvent; onUpdate: (p: Partial<CapacityEvent>) => Promise<unknown> }) {
  function toggleDay(d: number) {
    const next = event.workingDays.includes(d) ? event.workingDays.filter((x) => x !== d) : [...event.workingDays, d].sort()
    onUpdate({ workingDays: next })
  }
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Paramètres</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Début</label>
          <input type="date" defaultValue={toDateInput(event.startDate)} onBlur={(e) => e.target.value && onUpdate({ startDate: e.target.value })}
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Fin</label>
          <input type="date" defaultValue={toDateInput(event.endDate)} min={toDateInput(event.startDate)} onBlur={(e) => e.target.value && onUpdate({ endDate: e.target.value })}
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Jours travaillés</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button key={d} onClick={() => toggleDay(d)}
              className={`flex-1 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                event.workingDays.includes(d) ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-950 dark:text-primary-300' : 'border-gray-200 dark:border-gray-700 text-gray-400'
              }`}>
              {WEEKDAY_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Heures / jour</label>
          <input type="number" min="1" max="24" step="0.5" defaultValue={event.hoursPerDay}
            onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v !== event.hoursPerDay) onUpdate({ hoursPerDay: v }) }}
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Pts / jour·homme</label>
          <input type="number" min="0" step="0.1" defaultValue={event.pointsPerPersonDay ?? ''} placeholder="ex. 1.5"
            onBlur={(e) => { const raw = e.target.value.trim(); const v = raw === '' ? null : parseFloat(raw); if (v !== (event.pointsPerPersonDay ?? null)) onUpdate({ pointsPerPersonDay: v }) }}
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Focus factor — <span className="text-gray-700 dark:text-gray-200 font-semibold">{Math.round(event.focusFactor * 100)}%</span>
        </label>
        <input type="range" min="0" max="1" step="0.05" value={event.focusFactor} onChange={(e) => onUpdate({ focusFactor: parseFloat(e.target.value) })} className="w-full accent-primary-600" />
      </div>
    </div>
  )
}

// ── Planning panel (committed / completed) ────────────────────────────────────

function PlanningPanel({ event, cap, onUpdate }: { event: CapacityEvent; cap: ReturnType<typeof computeEventCapacity>; onUpdate: (p: Partial<CapacityEvent>) => Promise<unknown> }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Engagement & réalisation</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Points engagés</label>
          <input type="number" min="0" step="0.5" defaultValue={event.committedPoints ?? ''} placeholder="—"
            onBlur={(e) => { const raw = e.target.value.trim(); const v = raw === '' ? null : parseFloat(raw); if (v !== (event.committedPoints ?? null)) onUpdate({ committedPoints: v }) }}
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Points réalisés</label>
          <input type="number" min="0" step="0.5" defaultValue={event.completedPoints ?? ''} placeholder="—"
            onBlur={(e) => { const raw = e.target.value.trim(); const v = raw === '' ? null : parseFloat(raw); if (v !== (event.completedPoints ?? null)) onUpdate({ completedPoints: v }) }}
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
      </div>

      {/* Indicators */}
      <div className="flex flex-col gap-2 text-xs">
        {cap.loadRatio != null && (
          <Indicator
            label="Charge engagée vs capacité"
            value={`${Math.round(cap.loadRatio * 100)}%`}
            tone={cap.loadRatio > 1 ? 'bad' : cap.loadRatio > 0.9 ? 'warn' : 'good'}
            hint={cap.loadRatio > 1 ? 'Sur-engagement' : 'Dans la capacité'}
          />
        )}
        {cap.predictability != null && (
          <Indicator
            label="Prédictibilité (réalisé / engagé)"
            value={`${Math.round(cap.predictability * 100)}%`}
            tone={cap.predictability >= 0.9 ? 'good' : cap.predictability >= 0.7 ? 'warn' : 'bad'}
          />
        )}
        {cap.loadRatio == null && cap.predictability == null && (
          <p className="text-gray-400">Renseignez la vélocité et les points pour voir les indicateurs de charge.</p>
        )}
      </div>

      <textarea
        defaultValue={event.notes ?? ''} placeholder="Notes (risques, hypothèses, dépendances…)" rows={2}
        onBlur={(e) => { if ((e.target.value.trim() || null) !== (event.notes ?? null)) onUpdate({ notes: e.target.value }) }}
        className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
      />
    </div>
  )
}

function Indicator({ label, value, tone, hint }: { label: string; value: string; tone: 'good' | 'warn' | 'bad'; hint?: string }) {
  const cls = tone === 'good' ? 'text-green-600 dark:text-green-400' : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`font-bold ${cls}`}>{value}{hint && <span className="font-normal text-gray-400 ml-1">· {hint}</span>}</span>
    </div>
  )
}

// ── History / realization feedback panel ──────────────────────────────────────

function HistoryPanel({
  event, hist, onApplyVelocity,
}: {
  event: CapacityEvent
  hist: ReturnType<typeof summarizeHistory> | null
  onApplyVelocity: (v: number) => void
}) {
  if (!hist || hist.stats.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Historique de réalisation</h3>
        <p className="text-xs text-gray-400">
          {event.teamId
            ? 'Aucun événement terminé pour cette équipe. Marquez des événements « Terminé » avec leurs points réalisés pour alimenter les prévisions.'
            : 'Associez une équipe à cet événement pour comparer avec les PI/sprints passés.'}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-950/40 dark:to-secondary-950/40 rounded-2xl border border-primary-100 dark:border-primary-900 p-5 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-primary-900 dark:text-primary-200">Retour des PI / sprints précédents</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/70 dark:bg-gray-900/50 rounded-xl p-3">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Vélocité moyenne</p>
          <p className="text-xl font-bold text-primary-700 dark:text-primary-300">{hist.avgVelocity ?? '—'}<span className="text-xs font-normal text-gray-400"> pts/j·h</span></p>
        </div>
        <div className="bg-white/70 dark:bg-gray-900/50 rounded-xl p-3">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Prédictibilité moy.</p>
          <p className="text-xl font-bold text-primary-700 dark:text-primary-300">{hist.avgPredictability != null ? `${Math.round(hist.avgPredictability * 100)}%` : '—'}</p>
        </div>
      </div>

      {hist.forecastPoints != null && (
        <div className="bg-white/70 dark:bg-gray-900/50 rounded-xl p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Prévision pour cet événement</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">~{hist.forecastPoints} pts</p>
            <p className="text-[11px] text-gray-400">basé sur la vélocité historique</p>
          </div>
          {hist.avgVelocity != null && event.pointsPerPersonDay !== hist.avgVelocity && (
            <button
              onClick={() => onApplyVelocity(hist.avgVelocity as number)}
              className="shrink-0 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
            >
              Appliquer
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Détail</p>
        {hist.stats.map((s) => (
          <div key={s.event.id} className="flex items-center gap-2 text-xs">
            <Link href={`/capacity/${s.event.id}`} className="flex-1 truncate text-gray-600 dark:text-gray-300 hover:text-primary-600">{s.event.name}</Link>
            <span className="text-gray-400">{s.netPersonDays} j·h</span>
            <span className="font-semibold text-gray-700 dark:text-gray-200 w-16 text-right">{s.realizedVelocity ?? '—'} pts/j</span>
            <span className={`w-12 text-right font-medium ${s.predictability != null && s.predictability >= 0.9 ? 'text-green-600' : s.predictability != null && s.predictability >= 0.7 ? 'text-amber-600' : 'text-red-500'}`}>
              {s.predictability != null ? `${Math.round(s.predictability * 100)}%` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Delete button ─────────────────────────────────────────────────────────────

function DeleteButton({ eventId }: { eventId: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  async function handle() {
    const { api } = await import('@/lib/api')
    await api.delete(`/api/capacity/events/${eventId}`)
    router.push('/capacity')
  }
  return confirm ? (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">Confirmer la suppression ?</span>
      <button onClick={handle} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700">Supprimer</button>
      <button onClick={() => setConfirm(false)} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300">Annuler</button>
    </div>
  ) : (
    <button onClick={() => setConfirm(true)} className="text-sm text-gray-400 hover:text-red-500 transition-colors">Supprimer cet événement</button>
  )
}
