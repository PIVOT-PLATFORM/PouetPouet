'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMeetTemplates } from '@/hooks/useMeetops'
import { EVENT_TYPE_EMOJI, EVENT_TYPE_LABELS } from '@/lib/meetops'
import type { MeetTemplate, MeetTemplateLine, MeetEventType } from '@/lib/meetops'

const EVENT_TYPES: MeetEventType[] = ['VERSION', 'SPRINT', 'COPIL', 'COMOP', 'RELEASE', 'ONBOARDING', 'CUSTOM']

interface DraftLine { label: string; title: string; durationMin: number; dayOffset: number; time: string }

function CreateTemplateModal({
  onCreate, onClose,
}: {
  onCreate: (input: { name: string; description?: string | null; type?: MeetEventType; color?: string; lines: MeetTemplateLine[] }) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<MeetEventType>('CUSTOM')
  const [color, setColor] = useState('#475569')
  const [lines, setLines] = useState<DraftLine[]>([{ label: '', title: '', durationMin: 60, dayOffset: 0, time: '09:00' }])
  const [saving, setSaving] = useState(false)

  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, j) => j === i ? { ...l, ...patch } : l))
  }
  function addLine() {
    const last = lines[lines.length - 1]
    setLines((prev) => [...prev, { label: last?.label ?? '', title: '', durationMin: last?.durationMin ?? 60, dayOffset: last?.dayOffset ?? 0, time: last?.time ?? '09:00' }])
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, j) => j !== i))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || lines.length === 0) return
    setSaving(true)
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || null,
        type,
        color,
        lines: lines.map((l) => ({ label: l.label.trim() || null, title: l.title.trim() || 'Réunion', durationMin: l.durationMin || 60, dayOffset: l.dayOffset || 0, time: l.time || '09:00' })),
      })
      onClose()
    } catch (err) {
      alert((err as Error).message)
      setSaving(false)
    }
  }

  const cell = 'border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form onSubmit={submit} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h3 className="font-semibold text-gray-900 dark:text-white">Nouveau modèle</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Les réunions sont définies en décalage de jours (J+0, J+1…) depuis la date de départ.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nom</label>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint Scrum, PI Planning…" className={`${cell} w-full`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Couleur</label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-9 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer" />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as MeetEventType)} className={`${cell} w-full`}>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_TYPE_EMOJI[t]} {EVENT_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description (optionnel)</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className={`${cell} w-full`} />
            </div>
          </div>

          <div>
            <div className="grid grid-cols-[3rem_4rem_1fr_6rem_4rem_1.5rem] gap-2 text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1 px-0.5">
              <span>J+</span><span>Heure</span><span>Titre</span><span>Étiquette</span><span>Min.</span><span />
            </div>
            <div className="flex flex-col gap-1.5">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[3rem_4rem_1fr_6rem_4rem_1.5rem] gap-2 items-center">
                  <input type="number" min={0} value={l.dayOffset} onChange={(e) => updateLine(i, { dayOffset: Number(e.target.value) })} className={cell} />
                  <input type="time" value={l.time} onChange={(e) => updateLine(i, { time: e.target.value })} className={cell} />
                  <input value={l.title} onChange={(e) => updateLine(i, { title: e.target.value })} placeholder="Réunion" className={cell} />
                  <input value={l.label} onChange={(e) => updateLine(i, { label: e.target.value })} placeholder="—" className={cell} />
                  <input type="number" min={5} step={5} value={l.durationMin} onChange={(e) => updateLine(i, { durationMin: Number(e.target.value) })} className={cell} />
                  <button type="button" onClick={() => removeLine(i)} className="text-gray-300 hover:text-red-500 text-sm" title="Retirer">✕</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addLine} className="mt-2 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-gray-800 px-2 py-1 rounded-lg">+ Ajouter une réunion</button>
          </div>
        </div>
        <div className="p-5 border-t border-gray-100 dark:border-gray-800 shrink-0 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">Annuler</button>
          <button type="submit" disabled={saving || !name.trim()} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl">
            {saving ? 'Enregistrement…' : 'Créer le modèle'}
          </button>
        </div>
      </form>
    </div>
  )
}

function InstantiateModal({
  template, onCreate, onClose,
}: {
  template: MeetTemplate
  onCreate: (input: { name: string; startDate: string }) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(template.name)
  const [startDate, setStartDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !startDate) return
    setSaving(true)
    try {
      await onCreate({ name: name.trim(), startDate })
    } catch (err) {
      alert((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form onSubmit={submit} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white">Créer depuis le modèle</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{template.lines.length} réunion(s) seront générées à partir de la date choisie.</p>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nom de l&apos;événement</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Date de départ (jour 0)</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
        </div>
        <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">Annuler</button>
          <button type="submit" disabled={saving || !name.trim() || !startDate} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl">
            {saving ? 'Création…' : 'Créer l\'événement'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function MeetopsTemplatesPage() {
  const router = useRouter()
  const { templates, isLoading, createTemplate, deleteTemplate, instantiate } = useMeetTemplates()
  const [active, setActive] = useState<MeetTemplate | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  async function handleCreate(input: { name: string; startDate: string }) {
    const ev = await instantiate(active!.id, input)
    router.push(`/meetops/${ev.id}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Link href="/meetops" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>MeetOps</Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mt-2">🧩 Modèles</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Structures d&apos;événements réutilisables. Crée-en un ici, ou depuis un événement existant (« 💾 Modèle »).</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 active:scale-95 transition-all shadow-sm shadow-primary-200 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Nouveau modèle
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Chargement…</p>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-4xl mb-3">🧩</p>
          <p className="text-gray-500 dark:text-gray-400">Aucun modèle. Ouvre un événement et clique « 💾 Modèle » pour en créer un.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                  <h2 className="font-semibold text-gray-900 dark:text-white truncate">{t.name}</h2>
                </div>
                <button onClick={() => { if (confirm(`Supprimer le modèle « ${t.name} » ?`)) deleteTemplate(t.id) }}
                  className="text-gray-300 hover:text-red-500 text-sm shrink-0" title="Supprimer">✕</button>
              </div>
              {t.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.description}</p>}
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
                <span>{EVENT_TYPE_EMOJI[t.type]} {EVENT_TYPE_LABELS[t.type]}</span>
                <span>·</span>
                <span>{t.lines.length} réunion{t.lines.length > 1 ? 's' : ''}</span>
                {!!t._count?.events && <><span>·</span><span>{t._count.events} événement(s) créé(s)</span></>}
              </div>
              <button onClick={() => setActive(t)}
                className="mt-4 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-gray-800 px-3 py-1.5 rounded-lg transition-colors">
                + Créer un événement
              </button>
            </div>
          ))}
        </div>
      )}

      {active && <InstantiateModal template={active} onCreate={handleCreate} onClose={() => setActive(null)} />}
      {createOpen && <CreateTemplateModal onCreate={createTemplate} onClose={() => setCreateOpen(false)} />}
    </div>
  )
}
