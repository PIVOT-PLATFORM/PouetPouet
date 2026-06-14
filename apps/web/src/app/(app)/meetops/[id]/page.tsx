'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useMeetEvent, type BulkAction } from '@/hooks/useMeetops'
import { useMeetDistLists } from '@/hooks/useMeetDistLists'
import { useMeetGraph } from '@/hooks/useMeetGraph'
import { EventCalendar } from '@/components/meetops/event-calendar'
import { EventReport } from '@/components/meetops/event-report'
import { EventHistory } from '@/components/meetops/event-history'
import type { Meeting, MeetEvent, MeetDistList } from '@/lib/meetops'
import {
  EVENT_TYPE_LABELS, EVENT_TYPE_EMOJI, EVENT_STATUS_LABELS, MEETING_STATUS_LABELS,
  countMeetings, downloadIcs, labelColor,
} from '@/lib/meetops'

const STATUSES = ['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'] as const

// ── Bloc participants d'une réunion ─────────────────────────────────────────────

function Participants({
  meeting, lists, onAdd, onRemove, onApplyList,
}: {
  meeting: Meeting
  lists: MeetDistList[]
  onAdd: (email: string, name: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onApplyList: (listId: string) => Promise<{ added: number; skipped: number }>
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    await onAdd(email.trim(), name.trim())
    setEmail(''); setName('')
  }

  async function applyList(e: React.ChangeEvent<HTMLSelectElement>) {
    const listId = e.target.value
    e.target.value = ''
    if (!listId) return
    try {
      const res = await onApplyList(listId)
      if (res.added === 0) alert('Tous les membres de cette liste sont déjà invités.')
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <div>
      {meeting.participants.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mb-3">
          {meeting.participants.map((p) => (
            <li key={p.id} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-full pl-2.5 pr-1 py-0.5 text-xs text-gray-700 dark:text-gray-300">
              {p.name ? `${p.name} (${p.email})` : p.email}
              <button onClick={() => onRemove(p.id)} className="text-gray-400 hover:text-red-500 px-1" title="Retirer">✕</button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex flex-wrap gap-1.5">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="email@exemple.fr"
          className="flex-1 min-w-[10rem] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (optionnel)"
          className="w-32 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400" />
        <button type="submit" disabled={!email.trim()}
          className="px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-gray-800 disabled:opacity-40 rounded-lg">+ Ajouter</button>
      </form>
      {lists.length > 0 && (
        <select onChange={applyList} defaultValue=""
          className="mt-2 w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"
          title="Appliquer une liste de diffusion">
          <option value="">+ Appliquer une liste de diffusion…</option>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l._count?.members ?? l.members.length})</option>)}
        </select>
      )}
    </div>
  )
}

// ── Helpers dates locales ───────────────────────────────────────────────────────

function toDateStr(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function toTimeStr(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const CELL = 'bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-primary-400 dark:focus:border-primary-500 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400 transition-colors'

// ── Modale participants ──────────────────────────────────────────────────────────

function ParticipantsModal({
  meeting, lists, onAdd, onRemove, onApplyList, onClose,
}: {
  meeting: Meeting
  lists: MeetDistList[]
  onAdd: (email: string, name: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onApplyList: (listId: string) => Promise<{ added: number; skipped: number }>
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Participants</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{meeting.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 rounded-lg text-lg">✕</button>
        </div>
        <div className="p-5">
          <Participants meeting={meeting} lists={lists} onAdd={onAdd} onRemove={onRemove} onApplyList={onApplyList} />
        </div>
      </div>
    </div>
  )
}

// ── Ligne de réunion (édition inline) ───────────────────────────────────────────

function MeetingRow({
  m, canSend, labelListId, isOver, isDragging, selected,
  onUpdate, onDelete, onSend, onOpenParticipants, onToggleSelect,
  onDragStart, onDragEnter, onDragEnd, onDrop,
}: {
  m: Meeting
  canSend: boolean
  labelListId: string
  isOver: boolean
  isDragging: boolean
  selected: boolean
  onUpdate: (meetingId: string, patch: { title?: string; label?: string | null; startAt?: string; durationMin?: number }) => Promise<void>
  onDelete: (meetingId: string) => Promise<void>
  onSend: (meetingId: string) => Promise<void>
  onOpenParticipants: () => void
  onToggleSelect: () => void
  onDragStart: () => void
  onDragEnter: () => void
  onDragEnd: () => void
  onDrop: () => void
}) {
  const [label, setLabel] = useState(m.label ?? '')
  const [title, setTitle] = useState(m.title)
  const [date, setDate] = useState(toDateStr(m.startAt))
  const [time, setTime] = useState(toTimeStr(m.startAt))
  const [dur, setDur] = useState(m.durationMin)

  useEffect(() => { setLabel(m.label ?? '') }, [m.id, m.label])
  useEffect(() => { setTitle(m.title) }, [m.id, m.title])
  useEffect(() => { setDate(toDateStr(m.startAt)); setTime(toTimeStr(m.startAt)) }, [m.id, m.startAt])
  useEffect(() => { setDur(m.durationMin) }, [m.id, m.durationMin])

  async function save() {
    if (!date) return
    await onUpdate(m.id, { title, label: label || null, startAt: new Date(`${date}T${time}`).toISOString(), durationMin: dur })
  }

  return (
    <tr
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={onDragEnter}
      onDrop={(e) => { e.preventDefault(); onDrop() }}
      className={`group border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/40 dark:hover:bg-gray-800/30 ${selected ? 'bg-primary-50/40 dark:bg-primary-900/10' : ''} ${isDragging ? 'opacity-40' : ''} ${isOver ? 'border-t-2 border-t-primary-400' : ''}`}
    >
      <td className="w-5 align-middle">
        <input type="checkbox" checked={selected} onChange={onToggleSelect}
          className="opacity-0 group-hover:opacity-100 checked:opacity-100 cursor-pointer accent-primary-600 align-middle" />
      </td>
      <td className="w-5 align-middle">
        <span draggable
          onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', m.id); onDragStart() }}
          onDragEnd={onDragEnd}
          className="block cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 text-center select-none opacity-0 group-hover:opacity-100 transition-opacity"
          title="Glisser pour réorganiser">⠿</span>
      </td>
      <td className="py-1.5 pr-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: labelColor(label || null) }} />
          <input value={label} onChange={(e) => setLabel(e.target.value)}
            onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') save() }}
            list={labelListId} placeholder="—"
            className={`${CELL} w-24 text-gray-500 dark:text-gray-400`} />
        </div>
      </td>
      <td className="py-1.5 pr-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          className={`${CELL} w-full text-gray-900 dark:text-white`} />
      </td>
      <td className="py-1.5 pr-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} onBlur={save}
          className={`${CELL} text-gray-500 dark:text-gray-400`} />
      </td>
      <td className="py-1.5 pr-2">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} onBlur={save}
          className={`${CELL} text-gray-500 dark:text-gray-400`} />
      </td>
      <td className="py-1.5 pr-4">
        <input type="number" min={5} step={5} value={dur}
          onChange={(e) => setDur(Number(e.target.value))} onBlur={save}
          className={`${CELL} w-16 text-gray-500 dark:text-gray-400`} />
      </td>
      <td className="py-1.5 pr-4">
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {MEETING_STATUS_LABELS[m.status]}
        </span>
      </td>
      <td className="py-1.5">
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {m.teamsUrl && (
            <a href={m.teamsUrl} target="_blank" rel="noreferrer"
              className="text-xs hover:bg-blue-50 dark:hover:bg-gray-800 rounded px-1 py-0.5" title="Rejoindre Teams">🟦</a>
          )}
          {canSend && (
            <button onClick={() => onSend(m.id)}
              className="text-xs text-[#2f2f8f] dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-gray-800 rounded px-1 py-0.5"
              title="Envoyer / mettre à jour dans Outlook">
              {m.externalId ? 'MàJ' : '→OL'}
            </button>
          )}
          {m.sendError && <span className="text-xs text-red-400" title={m.sendError}>⚠</span>}
          <button onClick={onOpenParticipants}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded px-1 py-0.5"
            title="Gérer les participants">
            👥{m.participants.length > 0 ? ` ${m.participants.length}` : ''}
          </button>
          <button onClick={() => downloadIcs(`/api/meetops/meetings/${m.id}/ics`).catch(() => {})}
            className="text-xs text-gray-400 hover:text-primary-600 rounded px-1 py-0.5" title="Exporter en .ics">↓</button>
          <button onClick={() => { if (confirm('Supprimer cette réunion ?')) onDelete(m.id) }}
            className="text-xs text-gray-300 hover:text-red-500 rounded px-1 py-0.5" title="Supprimer">✕</button>
        </div>
      </td>
    </tr>
  )
}

// ── Tableau des réunions de l'événement ─────────────────────────────────────────

interface DraftRow { id: number; label: string; title: string; date: string; time: string; durationMin: number }

function MeetingsTable({
  event, lists, canSend,
  onAdd, onUpdate, onDelete, onSend, onReorder, onBulk,
  onAddParticipant, onRemoveParticipant, onApplyList,
}: {
  event: MeetEvent
  lists: MeetDistList[]
  canSend: boolean
  onAdd: (input: { label?: string | null; title?: string; startAt: string; durationMin: number }) => Promise<void>
  onUpdate: (meetingId: string, patch: { title?: string; label?: string | null; startAt?: string; durationMin?: number }) => Promise<void>
  onDelete: (meetingId: string) => Promise<void>
  onSend: (meetingId: string) => Promise<void>
  onReorder: (ids: string[]) => Promise<void>
  onBulk: (action: BulkAction, ids: string[], value?: string | number) => Promise<{ affected: number }>
  onAddParticipant: (meetingId: string, email: string, name: string) => Promise<void>
  onRemoveParticipant: (participantId: string) => Promise<void>
  onApplyList: (meetingId: string, listId: string) => Promise<{ added: number; skipped: number }>
}) {
  const [participantsId, setParticipantsId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Ordre local optimiste pour le drag & drop (resynchronisé à chaque reload).
  const [meetings, setMeetings] = useState(event.meetings)
  useEffect(() => { setMeetings(event.meetings) }, [event.meetings])
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  function handleDrop(targetId: string) {
    if (dragId && dragId !== targetId) {
      const arr = [...meetings]
      const from = arr.findIndex((m) => m.id === dragId)
      const to = arr.findIndex((m) => m.id === targetId)
      if (from !== -1 && to !== -1) {
        const [moved] = arr.splice(from, 1)
        arr.splice(to, 0, moved)
        setMeetings(arr)
        void onReorder(arr.map((m) => m.id))
      }
    }
    setDragId(null); setOverId(null)
  }

  // Purge la sélection des réunions disparues après un reload.
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => event.meetings.some((m) => m.id === id)))
      return next.size === prev.size ? prev : next
    })
  }, [event.meetings])

  const allSelected = meetings.length > 0 && meetings.every((m) => selected.has(m.id))
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(meetings.map((m) => m.id)))
  }

  async function runBulk(action: BulkAction, value?: string | number) {
    const ids = [...selected]
    if (ids.length === 0) return
    try { await onBulk(action, ids, value); setSelected(new Set()) } catch (e) { alert((e as Error).message) }
  }
  function bulkLabel() { const v = prompt('Étiquette à appliquer à la sélection (laisser vide pour effacer) :', ''); if (v !== null) void runBulk('setLabel', v) }
  function bulkDuration() { const v = prompt('Durée en minutes pour la sélection :', '60'); if (v) void runBulk('setDuration', Number(v)) }
  function bulkShift() { const v = prompt('Décaler la sélection de combien de jours ? (négatif = avancer)', '7'); if (v) void runBulk('shiftDays', Number(v)) }
  function bulkDelete() { if (confirm(`Supprimer ${selected.size} réunion(s) ?`)) void runBulk('delete') }

  const participantsMeeting = participantsId
    ? (event.meetings.find((m) => m.id === participantsId) ?? null)
    : null

  // Étiquettes déjà utilisées → autocomplétion dans les cellules « Label ».
  const labelListId = 'meetops-labels'
  const knownLabels = Array.from(new Set(meetings.map((m) => m.label).filter((l): l is string => !!l)))

  function addDraft() {
    const last = meetings[meetings.length - 1]
    const lastD = drafts[drafts.length - 1]
    const date = lastD?.date ?? (last ? toDateStr(last.startAt) : '')
    const time = lastD?.time ?? (last ? toTimeStr(last.startAt) : '09:00')
    const label = lastD?.label ?? (last?.label ?? '')
    const durationMin = lastD?.durationMin ?? (last?.durationMin ?? 60)
    setDrafts((prev) => [...prev, { id: Date.now(), label, title: '', date, time, durationMin }])
  }

  function updateDraft(id: number, patch: Partial<DraftRow>) {
    setDrafts((prev) => prev.map((d) => d.id === id ? { ...d, ...patch } : d))
  }

  function removeDraft(id: number) {
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }

  async function saveDraft(draft: DraftRow) {
    // La date est le seul champ requis : si vide, on prend aujourd'hui.
    const date = draft.date || toDateStr(new Date().toISOString())
    setDrafts((prev) => prev.filter((d) => d.id !== draft.id))
    await onAdd({
      label: draft.label || null,
      title: draft.title || undefined,
      startAt: new Date(`${date}T${draft.time || '09:00'}`).toISOString(),
      durationMin: draft.durationMin,
    })
  }

  // Auto-enregistrement : dès qu'on quitte une ligne en saisie avec un champ
  // rempli (label ou titre), elle est créée ; vide, elle est simplement abandonnée.
  function handleDraftBlur(draft: DraftRow, e: React.FocusEvent<HTMLTableRowElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    if (draft.label.trim() || draft.title.trim()) void saveDraft(draft)
    else removeDraft(draft.id)
  }

  const hasRows = meetings.length > 0 || drafts.length > 0

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
      <datalist id={labelListId}>
        {knownLabels.map((l) => <option key={l} value={l} />)}
      </datalist>

      {/* Barre d'actions de masse */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-2 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-sm">
          <span className="font-medium text-primary-700 dark:text-primary-300 px-1">{selected.size} sélectionnée(s)</span>
          <button onClick={bulkLabel} className="font-medium text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 px-2 py-1 rounded-lg">Étiquette</button>
          <button onClick={bulkDuration} className="font-medium text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 px-2 py-1 rounded-lg">Durée</button>
          <button onClick={bulkShift} className="font-medium text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 px-2 py-1 rounded-lg">Décaler les dates</button>
          <button onClick={bulkDelete} className="font-medium text-red-600 hover:bg-white dark:hover:bg-gray-800 px-2 py-1 rounded-lg">Supprimer</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg">Désélectionner</button>
        </div>
      )}

      {hasRows ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="w-5">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="cursor-pointer accent-primary-600 align-middle" title="Tout sélectionner" />
                </th>
                <th className="w-5" />
                {(['Label', 'Nom', 'Date', 'Heure', 'Min.', 'Statut'] as const).map((h) => (
                  <th key={h} className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide pb-1.5 pr-4">{h}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <MeetingRow
                  key={m.id}
                  m={m}
                  canSend={canSend}
                  labelListId={labelListId}
                  isOver={overId === m.id && dragId !== m.id}
                  isDragging={dragId === m.id}
                  selected={selected.has(m.id)}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onSend={onSend}
                  onOpenParticipants={() => setParticipantsId(m.id)}
                  onToggleSelect={() => toggleSelect(m.id)}
                  onDragStart={() => setDragId(m.id)}
                  onDragEnter={() => setOverId(m.id)}
                  onDragEnd={() => { setDragId(null); setOverId(null) }}
                  onDrop={() => handleDrop(m.id)}
                />
              ))}
              {drafts.map((draft) => (
                <tr key={draft.id} onBlur={(e) => handleDraftBlur(draft, e)}
                  className="border-b border-dashed border-gray-200 dark:border-gray-700">
                  <td className="w-5" />
                  <td className="w-5" />
                  <td className="py-1.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: labelColor(draft.label || null) }} />
                      <input value={draft.label} onChange={(e) => updateDraft(draft.id, { label: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveDraft(draft); if (e.key === 'Escape') removeDraft(draft.id) }}
                        list={labelListId} placeholder="—"
                        className={`${CELL} w-24 text-gray-500 dark:text-gray-400`} />
                    </div>
                  </td>
                  <td className="py-1.5 pr-2">
                    <input value={draft.title} onChange={(e) => updateDraft(draft.id, { title: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveDraft(draft); if (e.key === 'Escape') removeDraft(draft.id) }}
                      placeholder="Titre…" autoFocus
                      className={`${CELL} w-full text-gray-900 dark:text-white`} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input type="date" value={draft.date} onChange={(e) => updateDraft(draft.id, { date: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveDraft(draft); if (e.key === 'Escape') removeDraft(draft.id) }}
                      className={`${CELL} text-gray-500 dark:text-gray-400`} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input type="time" value={draft.time} onChange={(e) => updateDraft(draft.id, { time: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveDraft(draft); if (e.key === 'Escape') removeDraft(draft.id) }}
                      className={`${CELL} text-gray-500 dark:text-gray-400`} />
                  </td>
                  <td className="py-1.5 pr-4">
                    <input type="number" min={5} step={5} value={draft.durationMin}
                      onChange={(e) => updateDraft(draft.id, { durationMin: Number(e.target.value) })}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveDraft(draft); if (e.key === 'Escape') removeDraft(draft.id) }}
                      className={`${CELL} w-16 text-gray-500 dark:text-gray-400`} />
                  </td>
                  <td />
                  <td className="py-1.5">
                    <button onClick={() => removeDraft(draft.id)} title="Abandonner"
                      className="text-xs text-gray-400 hover:text-red-500 rounded px-1">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-2">Aucune réunion. Ajoute la première ci-dessous.</p>
      )}

      <button onClick={addDraft}
        className="mt-2 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-gray-800 px-2 py-1 rounded-lg transition-colors">
        + Ajouter une réunion
      </button>

      {participantsMeeting && (
        <ParticipantsModal
          meeting={participantsMeeting}
          lists={lists}
          onAdd={(email, name) => onAddParticipant(participantsMeeting.id, email, name)}
          onRemove={onRemoveParticipant}
          onApplyList={(listId) => onApplyList(participantsMeeting.id, listId)}
          onClose={() => setParticipantsId(null)}
        />
      )}
    </div>
  )
}

// ── Modale « Sauver comme modèle » ──────────────────────────────────────────────

function SaveTemplateModal({ onSave, onClose }: { onSave: (input: { name: string; description?: string | null }) => Promise<unknown>; onClose: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), description: description.trim() || null })
      alert('Modèle enregistré.')
      onClose()
    } catch (err) {
      alert((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form onSubmit={submit} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white">Sauver comme modèle</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Les réunions sont enregistrées en décalages relatifs (sans dates).</p>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du modèle (ex. Sprint Scrum)"
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optionnel)"
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
        <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">Annuler</button>
          <button type="submit" disabled={saving || !name.trim()} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Page détail ─────────────────────────────────────────────────────────────────

export default function MeetopsEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const {
    event, isLoading, error,
    updateEvent,
    addMeeting, deleteMeeting, updateMeeting, reorderMeetings, bulkUpdate, saveAsTemplate, addParticipant, removeParticipant, applyList,
    sendMeeting, sendEvent,
  } = useMeetEvent(id)
  const { lists } = useMeetDistLists(id)
  const { status: graph } = useMeetGraph()
  const canSend = graph?.configured && graph?.connected

  const [view, setView] = useState<'list' | 'calendar' | 'report' | 'history'>('list')
  const [sending, setSending] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" /></div>
  }
  if (error || !event) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Événement introuvable</h2>
        <Link href="/meetops" className="text-sm text-primary-600 hover:text-primary-700 mt-3 inline-block">← Retour</Link>
      </div>
    )
  }

  async function handleExport(path: string) {
    try { await downloadIcs(path) } catch (err) { alert((err as Error).message) }
  }

  async function handleSendEvent() {
    if (!confirm('Envoyer / mettre à jour toutes les réunions dans Outlook (avec lien Teams) ?')) return
    setSending(true)
    try {
      const res = await sendEvent()
      alert(`${res.sent}/${res.total} réunion(s) envoyée(s)${res.failed ? `, ${res.failed} en échec` : ''}.`)
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSending(false)
    }
  }
  async function handleSendMeeting(meetingId: string) {
    try { await sendMeeting(meetingId) } catch (err) { alert((err as Error).message) }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/meetops" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">← MeetOps</Link>

      {/* En-tête événement */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <span className="w-3 h-3 rounded-full mt-2 shrink-0" style={{ background: event.color }} />
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{event.name}</h1>
            {event.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{event.description}</p>}
            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
              <span>{EVENT_TYPE_EMOJI[event.type]} {EVENT_TYPE_LABELS[event.type]}</span>
              <span>·</span>
              <span>{countMeetings(event)} réunion{countMeetings(event) > 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canSend && countMeetings(event) > 0 && (
              <button onClick={handleSendEvent} disabled={sending}
                className="text-xs font-medium text-white bg-[#2f2f8f] hover:opacity-90 disabled:opacity-50 rounded-lg px-2.5 py-1.5"
                title="Créer/mettre à jour les réunions dans Outlook avec lien Teams">
                {sending ? 'Envoi…' : '🟦 Envoyer (Outlook/Teams)'}
              </button>
            )}
            {countMeetings(event) > 0 && (
              <button onClick={() => handleExport(`/api/meetops/events/${event.id}/ics`)}
                className="text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-2 py-1.5"
                title="Exporter toutes les réunions au format .ics">↓ .ics</button>
            )}
            {countMeetings(event) > 0 && (
              <button onClick={() => setTemplateOpen(true)}
                className="text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-2 py-1.5"
                title="Enregistrer cet événement comme modèle réutilisable">💾 Modèle</button>
            )}
            <select
              value={event.status} onChange={(e) => updateEvent({ status: e.target.value as typeof STATUSES[number] })}
              className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{EVENT_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Bascule de vue */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 self-start">
        {([
          ['list', 'Tableau'], ['calendar', 'Calendrier'], ['report', 'Tableau de bord'], ['history', 'Historique'],
        ] as const).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${view === v ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {view === 'calendar' && <EventCalendar event={event} />}
      {view === 'report' && <EventReport event={event} />}
      {view === 'history' && <EventHistory eventId={event.id} refreshKey={event} />}
      {view === 'list' && (
        <MeetingsTable
          event={event}
          lists={lists}
          canSend={!!canSend}
          onAdd={addMeeting}
          onUpdate={updateMeeting}
          onDelete={deleteMeeting}
          onSend={handleSendMeeting}
          onReorder={reorderMeetings}
          onBulk={bulkUpdate}
          onAddParticipant={(meetingId, email, name) => addParticipant(meetingId, { email, name: name || null })}
          onRemoveParticipant={removeParticipant}
          onApplyList={applyList}
        />
      )}

      {templateOpen && <SaveTemplateModal onSave={saveAsTemplate} onClose={() => setTemplateOpen(false)} />}
    </div>
  )
}
