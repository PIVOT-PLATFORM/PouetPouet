'use client'

import { useState, useCallback } from 'react'
import { useTeams } from '@/hooks/useDaily'
import type { DailyTeam, DailyTeamMember } from '@/hooks/useDaily'

// ── Color palette ─────────────────────────────────────────────────────────────

const COLORS = [
  { label: 'Indigo',   value: '#6366f1' },
  { label: 'Violet',   value: '#8b5cf6' },
  { label: 'Rose',     value: '#f43f5e' },
  { label: 'Orange',   value: '#f97316' },
  { label: 'Amber',    value: '#f59e0b' },
  { label: 'Emerald',  value: '#10b981' },
  { label: 'Teal',     value: '#14b8a6' },
  { label: 'Sky',      value: '#0ea5e9' },
  { label: 'Pink',     value: '#ec4899' },
  { label: 'Slate',    value: '#64748b' },
]

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
        className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-800 dark:text-white"
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
  const [color, setColor] = useState(initial?.color ?? COLORS[0].value)
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
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description <span className="font-normal text-gray-400">(optionnelle)</span></label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Équipe back-end, sprint 3"
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Couleur</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  title={c.label}
                  className={`w-8 h-8 rounded-full transition-transform ${color === c.value ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-110'}`}
                  style={{ background: c.value }}
                />
              ))}
            </div>
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
                className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-medium text-left py-1"
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
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
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
  const sessions = team._count?.sessions ?? 0
  const draws = team._count?.wheelDraws ?? 0

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
              className="text-xs text-gray-400 hover:text-indigo-600 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950"
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
                className="text-gray-300 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
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

        {/* Stats */}
        <div className="flex items-center gap-4 pt-2 border-t border-gray-50 dark:border-gray-800 mt-auto">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span>📅</span>
            <span>{sessions} daily{sessions !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span>🎲</span>
            <span>{draws} tirage{draws !== 1 ? 's' : ''}</span>
          </div>
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

  return (
    <>
      {showModal && (
        <TeamModal
          initial={editTarget ?? undefined}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}

      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Mes équipes</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
              {teams.length} équipe{teams.length !== 1 ? 's' : ''} · utilisées dans les dailys et la roue
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shrink-0"
          >
            + Nouvelle équipe
          </button>
        </div>

        {/* Grid */}
        {teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-3xl">
              👥
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-700 dark:text-gray-300">Aucune équipe pour l'instant</p>
              <p className="text-sm text-gray-400 mt-1">Créez votre première équipe pour l'utiliser dans les dailys et la roue</p>
            </div>
            <button
              onClick={openCreate}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Créer une équipe
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {teams.map((team) => (
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
              className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-2 py-10 text-gray-400 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors min-h-[180px]"
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
