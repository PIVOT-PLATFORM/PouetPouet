'use client'

import { useState, useCallback } from 'react'
import { useTeams } from '@/hooks/useDaily'
import type { DailyTeam } from '@/hooks/useDaily'
import { ColorPicker } from '@/components/ui/color-picker'
import { DEFAULT_SHAPE_COLOR } from '@/lib/colors'

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

// ── Member editor row ─────────────────────────────────────────────────────────

function MemberRow({
  name,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  name: string
  index: number
  total: number
  onChange: (v: string) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none"
        >
          ▲
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none"
        >
          ▼
        </button>
      </div>
      <input
        value={name}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Membre ${index + 1}`}
        className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:bg-gray-800 dark:text-white"
      />
      <button
        type="button"
        onClick={onRemove}
        className="text-gray-300 hover:text-red-400 transition-colors p-1"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}

// ── Team modal (create / edit) ────────────────────────────────────────────────

function TeamModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: DailyTeam
  onSave: (name: string, members: string[], color: string, description: string) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [color, setColor] = useState(initial?.color ?? DEFAULT_SHAPE_COLOR)
  const [members, setMembers] = useState<string[]>(
    initial?.members.map((m) => m.name) ?? ['']
  )
  const [saving, setSaving] = useState(false)

  function moveUp(i: number) {
    setMembers((prev) => {
      const arr = [...prev]
      ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
      return arr
    })
  }

  function moveDown(i: number) {
    setMembers((prev) => {
      const arr = [...prev]
      ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
      return arr
    })
  }

  async function handleSave() {
    if (!name.trim()) return
    const validMembers = members.map((m) => m.trim()).filter(Boolean)
    setSaving(true)
    await onSave(name.trim(), validMembers, color, description.trim())
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Colored header preview */}
        <div className="rounded-t-2xl h-20 flex items-center px-6 gap-4 shrink-0" style={{ background: color }}>
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white text-lg font-bold">
            {initials(name || 'Équipe')}
          </div>
          <span className="text-white font-semibold text-lg truncate">{name || 'Nouvelle équipe'}</span>
        </div>

        <div className="p-6 flex flex-col gap-5 overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nom de l'équipe</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Squad Alpha"
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description <span className="font-normal text-gray-400">(optionnelle)</span></label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Équipe back-end, sprint 3"
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Couleur</label>
            <ColorPicker value={color} onChange={setColor} columns={7} />
          </div>

          {/* Members */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Membres</label>
            <div className="flex flex-col gap-2">
              {members.map((m, i) => (
                <MemberRow
                  key={i}
                  name={m}
                  index={i}
                  total={members.length}
                  onChange={(v) => setMembers((prev) => prev.map((x, j) => j === i ? v : x))}
                  onRemove={() => setMembers((prev) => prev.filter((_, j) => j !== i))}
                  onMoveUp={() => moveUp(i)}
                  onMoveDown={() => moveDown(i)}
                />
              ))}
              <button
                type="button"
                onClick={() => setMembers((prev) => [...prev, ''])}
                className="text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 font-medium text-left py-1"
              >
                + Ajouter un membre
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Enregistrement…' : initial ? 'Enregistrer' : 'Créer l\'équipe'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Team card ─────────────────────────────────────────────────────────────────

function TeamCard({
  team,
  onEdit,
  onDelete,
}: {
  team: DailyTeam
  onEdit: (t: DailyTeam) => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const sessions = team._count?.dailySessions ?? 0
  const draws = team._count?.wheelDraws ?? 0
  const scrums = team._count?.scrumRooms ?? 0
  const sprints = team._count?.capacityEvents ?? 0

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col">
      {/* Colored band */}
      <div className="h-3 shrink-0" style={{ background: team.color }} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: team.color }}
            >
              {initials(team.name)}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">{team.name}</h3>
              {team.description && (
                <p className="text-xs text-gray-400 truncate mt-0.5">{team.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onEdit(team)}
              className="text-xs text-gray-400 hover:text-primary-600 transition-colors px-2 py-1 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-950"
            >
              Modifier
            </button>
            {confirmDelete ? (
              <div className="flex gap-1">
                <button
                  onClick={() => onDelete(team.id)}
                  className="text-xs text-red-600 font-semibold px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900"
                >
                  Supprimer
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-400 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Members */}
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
            {team.members.length} membre{team.members.length !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {team.members.map((m) => (
              <span
                key={m.id}
                className="text-xs font-medium px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              >
                {m.name}
              </span>
            ))}
            {team.members.length === 0 && (
              <span className="text-xs text-gray-400 italic">Aucun membre</span>
            )}
          </div>
        </div>

        {/* Stats FORGE — cross-module usage of this team pivot */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-50 dark:border-gray-800 mt-auto">
          {sessions > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-400" title="Daily Standup">
              <span>☀️</span><span>{sessions}</span>
            </div>
          )}
          {draws > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-400" title="Tirages Roue">
              <span>🎡</span><span>{draws}</span>
            </div>
          )}
          {scrums > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-400" title="Salles Scrum Poker">
              <span>🃏</span><span>{scrums}</span>
            </div>
          )}
          {sprints > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-400" title="Sprints Capacité">
              <span>📊</span><span>{sprints}</span>
            </div>
          )}
          {sessions === 0 && draws === 0 && scrums === 0 && sprints === 0 && (
            <span className="text-xs text-gray-300 dark:text-gray-600 italic">Non utilisée</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EquipesPage() {
  const { teams, isLoading, createTeam, updateTeam, deleteTeam } = useTeams()
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<DailyTeam | null>(null)
  const [search, setSearch] = useState('')

  const handleSave = useCallback(async (name: string, members: string[], color: string, description: string) => {
    if (editTarget) {
      await updateTeam(editTarget.id, name, members, color, description)
    } else {
      await createTeam(name, members, color, description)
    }
  }, [editTarget, createTeam, updateTeam])

  function openCreate() {
    setEditTarget(null)
    setShowModal(true)
  }

  function openEdit(team: DailyTeam) {
    setEditTarget(team)
    setShowModal(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">Chargement…</p>
      </div>
    )
  }

  const q = search.trim().toLowerCase()
  const filteredTeams = q ? teams.filter((t) => t.name.toLowerCase().includes(q)) : teams

  return (
    <>
      {showModal && (
        <TeamModal
          initial={editTarget ?? undefined}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}

      <div className="flex flex-col gap-8">
        {/* Header + barre de recherche */}
        <div>
          <div className="flex items-end justify-between mb-5">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Mes équipes</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {teams.length} équipe{teams.length !== 1 ? 's' : ''} · utilisées dans les dailys et la roue
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 shrink-0 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 active:scale-95 transition-all shadow-sm shadow-primary-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Nouvelle équipe
            </button>
          </div>

          {/* Barre de recherche */}
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une équipe…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Grid */}
        {teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-950 flex items-center justify-center text-3xl">
              👥
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-700 dark:text-gray-300">Aucune équipe pour l'instant</p>
              <p className="text-sm text-gray-500 mt-1">Créez votre première équipe pour l'utiliser dans les dailys et la roue</p>
            </div>
            <button
              onClick={openCreate}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              Créer une équipe
            </button>
          </div>
        ) : filteredTeams.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-12">Aucune équipe ne correspond à « {search} ».</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                onEdit={openEdit}
                onDelete={deleteTeam}
              />
            ))}

            {/* Add card */}
            <button
              onClick={openCreate}
              className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-2 py-10 text-gray-400 hover:text-primary-600 hover:border-primary-300 dark:hover:border-primary-700 transition-colors min-h-[180px]"
            >
              <span className="text-3xl">+</span>
              <span className="text-sm font-medium">Nouvelle équipe</span>
            </button>
          </div>
        )}
      </div>
    </>
  )
}
