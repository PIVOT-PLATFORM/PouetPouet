'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft, ClipboardList, ListChecks, Pencil, Plus, Share2, Trash2, Users, X } from 'lucide-react'
import { usePiCycle, type PiCycleStatus } from '@/hooks/usePi'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { api } from '@/lib/api'
import { Select } from '@/components/ui/select'
import { ModuleShareModal } from '@/components/share/module-share-modal'

const inputCls = 'w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400'

const STATUS_OPTIONS: { value: PiCycleStatus; label: string }[] = [
  { value: 'PREPARATION', label: 'Préparation' },
  { value: 'ACTIVE', label: 'Actif' },
  { value: 'CLOSED', label: 'Clos' },
]

function frDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

interface PivotTeam { id: string; name: string; color: string }

function ImportTeamsModal({ excludedSourceIds, onClose, onImport }: {
  excludedSourceIds: Set<string>
  onClose: () => void
  onImport: (teamIds: string[]) => Promise<unknown>
}) {
  const [teams, setTeams] = useState<PivotTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<PivotTeam[]>('/api/teams').then(setTeams).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const available = teams.filter((t) => !excludedSourceIds.has(t.id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleImport() {
    if (selected.size === 0) return
    setSaving(true)
    try {
      await onImport([...selected])
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Importer des équipes</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={18} /></button>
        </div>
        <div className="p-6 flex flex-col gap-3">
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" /></div>
          ) : available.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Aucune équipe disponible à importer.<br />Créez vos équipes dans <Link href="/equipes" className="text-sky-500 hover:underline">Mes équipes</Link>.</p>
          ) : (
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {available.map((t) => (
                <label key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                  <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="w-4 h-4 rounded accent-sky-500" />
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color }} />
                  <span className="text-sm dark:text-gray-200">{t.name}</span>
                </label>
              ))}
            </div>
          )}
          <button
            onClick={handleImport}
            disabled={saving || selected.size === 0}
            className="mt-2 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 disabled:opacity-50"
          >
            {saving ? 'Import…' : `Importer (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PiCycleDetailPage() {
  useFlagGuard('module.pi')
  const { id } = useParams<{ id: string }>()
  const { cycle, isLoading, notFound, updateCycle, addTeam, importTeams, updateTeam, removeTeam, createLogisticsForm, createTodoDashboard } = usePiCycle(id)

  const [editingName, setEditingName] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" /></div>
  }
  if (notFound || !cycle) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">PI introuvable.</p>
        <Link href="/pi" className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-700"><ChevronLeft size={16} />Retour à PI Planning</Link>
      </div>
    )
  }

  const canEdit = cycle.role === 'OWNER' || cycle.role === 'EDITOR'
  const isOwner = cycle.role === 'OWNER'

  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!newTeamName.trim()) return
    await addTeam(newTeamName.trim())
    setNewTeamName('')
  }

  async function handleCreateForm() {
    setBusy('form')
    try { await createLogisticsForm() } finally { setBusy(null) }
  }

  async function handleCreateDashboard() {
    setBusy('dashboard')
    try { await createTodoDashboard() } finally { setBusy(null) }
  }

  const respondedPct = cycle.logisticsForm && cycle.logisticsForm.recipientCount > 0
    ? Math.round((cycle.logisticsForm.respondedCount / cycle.logisticsForm.recipientCount) * 100)
    : null

  return (
    <div className="flex flex-col gap-6">
      <Link href="/pi" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"><ChevronLeft size={16} />PI Planning</Link>

      {/* En-tête */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              defaultValue={cycle.name}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== cycle.name) updateCycle({ name: v }); setEditingName(false) }}
              autoFocus
              className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight bg-transparent border border-transparent focus:border-sky-400 rounded-lg px-2 py-1 -ml-2 focus:outline-none w-full"
            />
          ) : (
            <h1
              onClick={() => canEdit && setEditingName(true)}
              className={`text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight ${canEdit ? 'cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-2 py-1 -ml-2' : ''}`}
            >
              {cycle.name}
            </h1>
          )}
          <p className="text-gray-500 dark:text-gray-400 mt-1 px-2 text-sm">
            {cycle.artName && <span className="font-medium">{cycle.artName} · </span>}
            {frDate(cycle.startDate)} → {frDate(cycle.endDate)}
            {cycle.eventLocation && <span> · {cycle.eventLocation}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit ? (
            <Select
              className="w-36"
              value={cycle.status}
              onChange={(v) => updateCycle({ status: v as PiCycleStatus })}
              options={STATUS_OPTIONS}
            />
          ) : (
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500">{STATUS_OPTIONS.find((s) => s.value === cycle.status)?.label}</span>
          )}
          {isOwner && (
            <button onClick={() => setShowShare(true)} className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-sky-500 transition-all" title="Partager">
              <Share2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Itérations */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Itérations</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {cycle.iterations.map((it) => (
            <div key={it.id} className={`shrink-0 min-w-[120px] rounded-xl border px-3 py-2.5 ${it.label === 'IP Sprint' ? 'border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20' : 'border-gray-100 dark:border-gray-800'}`}>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{it.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{frDate(it.startDate)} → {frDate(it.endDate)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cartes intégrations : Logistique + Tâches */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Logistique (module Formulaires) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-violet-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Logistique de l&apos;événement</h2>
          </div>
          {cycle.logisticsForm ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{cycle.logisticsForm.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {cycle.logisticsForm.recipientCount > 0
                      ? `${cycle.logisticsForm.respondedCount}/${cycle.logisticsForm.recipientCount} participant${cycle.logisticsForm.recipientCount > 1 ? 's ont' : ' a'} répondu`
                      : `${cycle.logisticsForm.responseCount} réponse${cycle.logisticsForm.responseCount !== 1 ? 's' : ''} — ajoutez des destinataires pour suivre qui a répondu`}
                  </p>
                </div>
                {respondedPct !== null && (
                  <span className="text-lg font-bold text-violet-500">{respondedPct}%</span>
                )}
              </div>
              {respondedPct !== null && (
                <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-1.5 rounded-full bg-violet-500 transition-all" style={{ width: `${respondedPct}%` }} />
                </div>
              )}
              <div className="flex items-center gap-2 mt-auto pt-2">
                <Link href={`/forms/${cycle.logisticsForm.id}/responses`} className="flex-1 text-center py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors">Réponses & relances</Link>
                <Link href={`/forms/${cycle.logisticsForm.id}/edit`} className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-violet-500 transition-colors" title="Modifier le formulaire"><Pencil size={15} /></Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400">Créez le formulaire logistique (présence, hôtel, repas, allergies) dans le module Formulaires — vous pourrez ensuite le personnaliser, ajouter des destinataires et activer les relances automatiques.</p>
              {canEdit && (
                <button onClick={handleCreateForm} disabled={busy === 'form'} className="mt-auto flex items-center justify-center gap-1.5 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                  <Plus size={14} /> {busy === 'form' ? 'Création…' : 'Créer le formulaire logistique'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Tâches (module To-Do) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <ListChecks size={16} className="text-orange-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Tâches de préparation</h2>
          </div>
          {cycle.todoDashboard ? (
            <>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{cycle.todoDashboard.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{cycle.todoDashboard.listCount} liste{cycle.todoDashboard.listCount !== 1 ? 's' : ''} rattachée{cycle.todoDashboard.listCount !== 1 ? 's' : ''}</p>
              </div>
              <Link href={`/todo/dashboards/${cycle.todoDashboard.id}`} className="mt-auto text-center py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">Ouvrir le tableau des tâches</Link>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400">Créez le tableau des tâches du Train dans le module To-Do — listes par équipe, kanban, assignation et statistiques de complétion.</p>
              {canEdit && (
                <button onClick={handleCreateDashboard} disabled={busy === 'dashboard'} className="mt-auto flex items-center justify-center gap-1.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                  <Plus size={14} /> {busy === 'dashboard' ? 'Création…' : 'Créer le tableau des tâches'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Équipes du Train */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-sky-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Équipes du Train <span className="text-gray-400 font-normal">({cycle.teams.length})</span></h2>
          </div>
          {canEdit && (
            <button onClick={() => setShowImport(true)} className="text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400">Importer depuis mes équipes</button>
          )}
        </div>
        {cycle.teams.length === 0 ? (
          <p className="text-xs text-gray-400">Aucune équipe pour l&apos;instant — ajoutez les équipes du Train (elles formeront les lignes du futur program board).</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {cycle.teams.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color }} />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{t.name}</span>
                {canEdit && (
                  <>
                    <input
                      type="color"
                      value={t.color}
                      onChange={(e) => updateTeam(t.id, { color: e.target.value })}
                      title="Couleur"
                      className="w-6 h-6 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-0"
                    />
                    <button
                      onClick={() => { if (confirm(`Retirer l'équipe « ${t.name} » du Train ?`)) removeTeam(t.id) }}
                      title="Retirer"
                      className="p-1 rounded text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <form onSubmit={handleAddTeam} className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Nouvelle équipe…" className={`flex-1 ${inputCls}`} maxLength={120} />
            <button type="submit" disabled={!newTeamName.trim()} className="shrink-0 flex items-center gap-1.5 rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
              <Plus size={14} /> Ajouter
            </button>
          </form>
        )}
      </div>

      {showShare && <ModuleShareModal module="pi" resourceId={cycle.id} resourceName={cycle.name} onClose={() => setShowShare(false)} />}
      {showImport && (
        <ImportTeamsModal
          excludedSourceIds={new Set(cycle.teams.map((t) => t.sourceTeamId).filter((s): s is string => !!s))}
          onClose={() => setShowImport(false)}
          onImport={importTeams}
        />
      )}
    </div>
  )
}
