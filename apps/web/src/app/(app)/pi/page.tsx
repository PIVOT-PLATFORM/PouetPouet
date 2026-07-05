'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TrainFront, Plus, Trash2, Users, CalendarRange } from 'lucide-react'
import { usePiCycles, type PiCycleInput, type PiCycleStatus } from '@/hooks/usePi'
import { useFlagGuard } from '@/hooks/useFlagGuard'

const inputCls = 'w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400'

const STATUS_META: Record<PiCycleStatus, { label: string; cls: string }> = {
  PREPARATION: { label: 'Préparation', cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
  ACTIVE: { label: 'Actif', cls: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' },
  CLOSED: { label: 'Clos', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' },
}

function frDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

function CreateModal({ onClose, onSave }: { onClose: () => void; onSave: (input: PiCycleInput) => Promise<unknown> }) {
  const [name, setName] = useState('')
  const [artName, setArtName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [iterationCount, setIterationCount] = useState(5)
  const [iterationWeeks, setIterationWeeks] = useState(2)
  const [eventDay1, setEventDay1] = useState('')
  const [eventDay2, setEventDay2] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !startDate) { setError('Le nom et la date de début sont obligatoires.'); return }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: name.trim(),
        artName: artName.trim() || null,
        startDate,
        iterationCount,
        iterationWeeks,
        eventDay1: eventDay1 || null,
        eventDay2: eventDay2 || null,
        eventLocation: eventLocation.trim() || null,
      })
      onClose()
    } catch {
      setError('Erreur lors de la création.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nouveau PI</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nom</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="PI 2026.Q4" className={inputCls} maxLength={120} autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Train (ART, optionnel)</label>
              <input value={artName} onChange={(e) => setArtName(e.target.value)} placeholder="Train Alpha" className={inputCls} maxLength={120} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Début du PI</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Itérations</label>
              <input type="number" min={1} max={12} value={iterationCount} onChange={(e) => setIterationCount(Math.min(12, Math.max(1, Number(e.target.value) || 1)))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Semaines / itér.</label>
              <input type="number" min={1} max={6} value={iterationWeeks} onChange={(e) => setIterationWeeks(Math.min(6, Math.max(1, Number(e.target.value) || 1)))} className={inputCls} />
            </div>
          </div>
          <p className="text-xs text-gray-400 -mt-2">Les créneaux IT1…IT{iterationCount} + IP Sprint seront générés automatiquement.</p>
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Événement PI Planning (optionnel)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Jour 1</label>
                <input type="date" value={eventDay1} onChange={(e) => setEventDay1(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Jour 2</label>
                <input type="date" value={eventDay2} onChange={(e) => setEventDay2(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Lieu</label>
              <input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="Salle plénière, site de Lyon…" className={inputCls} maxLength={300} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 disabled:opacity-60">
              {saving ? 'Création…' : 'Créer le PI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PiCyclesPage() {
  useFlagGuard('module.pi')
  const { cycles, isLoading, createCycle, deleteCycle } = usePiCycles()
  const [creating, setCreating] = useState(false)

  async function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Supprimer le PI « ${name} » ? Les itérations et équipes du Train seront supprimées (le formulaire logistique et le tableau To-Do liés sont conservés dans leurs modules).`)) return
    await deleteCycle(id)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2"><TrainFront size={28} style={{ color: '#0ea5e9' }} />PI Planning</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{isLoading ? '…' : `${cycles.length} PI`}</p>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 active:scale-95 transition-all shadow-sm">
          <Plus size={16} /> Nouveau PI
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : cycles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
          <TrainFront className="w-10 h-10 opacity-30" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Aucun PI pour l&apos;instant</p>
          <button onClick={() => setCreating(true)} className="text-sm font-medium text-sky-600 hover:text-sky-700">Créer votre premier PI</button>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
          {cycles.map((c) => {
            const status = STATUS_META[c.status]
            return (
              <Link key={c.id} href={`/pi/${c.id}`} className="group flex flex-col gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white line-clamp-1">{c.name}</h2>
                    {c.artName && <p className="text-xs text-gray-400 mt-0.5">{c.artName}</p>}
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${status.cls}`}>{status.label}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1"><CalendarRange size={12} />{frDate(c.startDate)} → {frDate(c.endDate)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-50 dark:border-gray-800 mt-auto">
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{c.iterationCount} itération{c.iterationCount > 1 ? 's' : ''}</span>
                    <span className="flex items-center gap-1"><Users size={11} />{c.teamCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{c.role === 'OWNER' ? 'Propriétaire' : c.role === 'EDITOR' ? 'Éditeur' : 'Lecteur'}</span>
                    {c.role === 'OWNER' && (
                      <button onClick={(e) => handleDelete(e, c.id, c.name)} title="Supprimer" className="p-1 rounded text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} onSave={createCycle} />}
    </div>
  )
}
