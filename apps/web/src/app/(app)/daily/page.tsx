'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTeams, useDailySessions } from '@/hooks/useDaily'
import type { DailyTeam, DailySession } from '@/hooks/useDaily'
import { formatDuration } from '@/lib/time'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function statusLabel(status: string) {
  if (status === 'PENDING') return { label: 'En attente', cls: 'bg-gray-100 text-gray-600' }
  if (status === 'RUNNING') return { label: 'En cours', cls: 'bg-green-100 text-green-700' }
  return { label: 'Terminé', cls: 'bg-blue-100 text-blue-700' }
}

// ── Team editor modal ─────────────────────────────────────────────────────────

function TeamModal({
  team,
  onSave,
  onClose,
}: {
  team?: DailyTeam | null
  onSave: (name: string, members: string[]) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(team?.name ?? '')
  const [members, setMembers] = useState<string[]>(team?.members.map((m) => m.name) ?? [''])
  const [saving, setSaving] = useState(false)

  function addMember() { setMembers((p) => [...p, '']) }
  function removeMember(i: number) { setMembers((p) => p.filter((_, idx) => idx !== i)) }
  function updateMember(i: number, v: string) { setMembers((p) => p.map((m, idx) => idx === i ? v : m)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clean = members.map((m) => m.trim()).filter(Boolean)
    if (!name.trim() || !clean.length) return
    setSaving(true)
    await onSave(name.trim(), clean)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{team ? 'Modifier l\'équipe' : 'Nouvelle équipe'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom de l'équipe</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mon équipe"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Membres</label>
            <div className="flex flex-col gap-2">
              {members.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={m}
                    onChange={(e) => updateMember(i, e.target.value)}
                    placeholder={`Membre ${i + 1}`}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                  {members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMember(i)}
                      className="text-gray-400 hover:text-red-500 px-2 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addMember}
              className="mt-2 text-sm text-primary-600 hover:text-primary-800 font-medium"
            >
              + Ajouter un membre
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 rounded-xl bg-primary-600 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Create session modal ──────────────────────────────────────────────────────

const TIME_PRESETS = [
  { label: '30s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '3 min', value: 180 },
  { label: '5 min', value: 300 },
]

function CreateSessionModal({
  teams,
  onCreate,
  onClose,
}: {
  teams: DailyTeam[]
  onCreate: (name: string, timePerPerson: number, participants: string[], teamId?: string) => Promise<DailySession>
  onClose: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [timePerPerson, setTimePerPerson] = useState(120)
  const [customTime, setCustomTime] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id ?? '')
  const [checkedMembers, setCheckedMembers] = useState<Record<string, boolean>>({})
  const [extras, setExtras] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function toggleMember(memberId: string) {
    setCheckedMembers((p) => ({ ...p, [memberId]: !p[memberId] }))
  }

  function toggleAllTeam(team: DailyTeam) {
    const allChecked = team.members.every((m) => checkedMembers[m.id])
    const next = { ...checkedMembers }
    team.members.forEach((m) => { next[m.id] = !allChecked })
    setCheckedMembers(next)
  }

  function addExtra() { setExtras((p) => [...p, '']) }
  function removeExtra(i: number) { setExtras((p) => p.filter((_, idx) => idx !== i)) }
  function updateExtra(i: number, v: string) { setExtras((p) => p.map((e, idx) => idx === i ? v : e)) }

  const selectedMembers = teams.flatMap((t) => t.members.filter((m) => checkedMembers[m.id]).map((m) => m.name))
  const extraNames = extras.map((e) => e.trim()).filter(Boolean)
  const allParticipants = [...selectedMembers, ...extraNames]

  const effectiveTime = customTime ? parseInt(customTime, 10) * 60 : timePerPerson

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !allParticipants.length) return
    setSaving(true)
    const session = await onCreate(name.trim(), effectiveTime || 120, allParticipants, selectedTeamId || undefined)
    router.push(`/daily/${session.id}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Nouveau daily</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Session name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom de la session</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Daily du lundi, Sprint 42…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>

          {/* Time per person */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Temps par personne</label>
            <div className="flex flex-wrap gap-2">
              {TIME_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => { setTimePerPerson(p.value); setCustomTime('') }}
                  className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                    !customTime && timePerPerson === p.value
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-200 text-gray-600 hover:border-primary-400'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-1.5">
                <input
                  type="number"
                  min="1"
                  placeholder="min"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="w-14 text-sm text-center focus:outline-none"
                />
                <span className="text-xs text-gray-400">min</span>
              </div>
            </div>
          </div>

          {/* Team association */}
          {teams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Équipe associée</label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
              >
                <option value="">— Aucune équipe —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Teams */}
          {teams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Participants</label>
              <div className="flex flex-col gap-3">
                {teams.map((team) => (
                  <div key={team.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-800">{team.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleAllTeam(team)}
                        className="text-xs text-primary-600 hover:text-primary-800"
                      >
                        {team.members.every((m) => checkedMembers[m.id]) ? 'Tout décocher' : 'Tout cocher'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {team.members.map((m) => (
                        <label
                          key={m.id}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm cursor-pointer border transition-colors ${
                            checkedMembers[m.id]
                              ? 'bg-primary-50 border-primary-300 text-primary-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={!!checkedMembers[m.id]}
                            onChange={() => toggleMember(m.id)}
                          />
                          {checkedMembers[m.id] ? '✓' : '○'} {m.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extra participants */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Participants supplémentaires</label>
            <div className="flex flex-col gap-2">
              {extras.map((e, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={e}
                    onChange={(ev) => updateExtra(i, ev.target.value)}
                    placeholder="Prénom"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                  <button
                    type="button"
                    onClick={() => removeExtra(i)}
                    className="text-gray-400 hover:text-red-500 px-2 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addExtra}
                className="text-sm text-primary-600 hover:text-primary-800 font-medium text-left"
              >
                + Ajouter une personne
              </button>
            </div>
          </div>

          {/* Preview */}
          {allParticipants.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-medium text-gray-500 mb-2">
                {allParticipants.length} participant{allParticipants.length !== 1 ? 's' : ''} · {formatDuration(effectiveTime || 120)} chacun
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allParticipants.map((p, i) => (
                  <span key={i} className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs text-gray-700">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </form>

        <div className="p-6 border-t border-gray-100 flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !allParticipants.length}
            className="flex-1 rounded-xl bg-primary-600 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Création…' : 'Lancer le daily'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DailyPage() {
  const router = useRouter()
  const { teams, isLoading: teamsLoading, createTeam, updateTeam, deleteTeam } = useTeams()
  const { sessions, isLoading: sessionsLoading, createSession, deleteSession } = useDailySessions()

  const [showCreateSession, setShowCreateSession] = useState(false)
  const [teamModal, setTeamModal] = useState<{ open: boolean; team: DailyTeam | null }>({ open: false, team: null })
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  async function handleSaveTeam(name: string, members: string[]) {
    if (teamModal.team) {
      await updateTeam(teamModal.team.id, name, members, teamModal.team.color, teamModal.team.description ?? '')
    } else {
      await createTeam(name, members)
    }
  }

  const q = search.trim().toLowerCase()
  const filteredSessions = q ? sessions.filter((s) => s.name.toLowerCase().includes(q)) : sessions

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Mes dailys</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gérez vos standups quotidiens</p>
        </div>
        <button
          onClick={() => setShowCreateSession(true)}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 active:scale-95 transition-all shadow-sm shadow-primary-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Nouveau daily
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions list */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sessions récentes</h2>

          {!sessionsLoading && sessions.length > 0 && (
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un daily…"
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
          )}

          {sessionsLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
              <span className="text-4xl block mb-3">📅</span>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Aucune session pour le moment</p>
              <p className="text-gray-500 text-sm mt-1">Créez votre premier daily !</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">Aucun daily ne correspond à « {search} ».</p>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredSessions.map((session) => {
                const { label, cls } = statusLabel(session.status)
                return (
                  <div
                    key={session.id}
                    className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex items-center gap-4 hover:border-primary-200 dark:hover:border-primary-800 transition-colors cursor-pointer"
                    onClick={() => router.push(`/daily/${session.id}`)}
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950 flex items-center justify-center text-xl shrink-0">
                      📅
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{session.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {session.participants.length} participants · {formatDuration(session.timePerPerson)}/personne
                        {session.status === 'DONE' && session.startedAt && session.endedAt
                          ? ` · ${formatDate(session.startedAt)} · ${formatDuration(Math.floor((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000))}`
                          : ` · ${formatDate(session.createdAt)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${cls}`}>{label}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(session.id) }}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        title="Supprimer"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Teams sidebar */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Équipes</h2>
            <button
              onClick={() => setTeamModal({ open: true, team: null })}
              className="text-xs text-primary-600 hover:text-primary-800 font-semibold dark:text-primary-400"
            >
              + Nouvelle
            </button>
          </div>

          {teamsLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
            </div>
          ) : teams.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 text-center">
              <p className="text-gray-500 text-sm">Créez une équipe pour la réutiliser dans vos dailys</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {teams.map((team) => (
                <div key={team.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-gray-800 dark:text-white">{team.name}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setTeamModal({ open: true, team })}
                        className="text-xs text-gray-400 hover:text-primary-600 px-1.5 py-0.5 rounded transition-colors"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => deleteTeam(team.id)}
                        className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {team.members.map((m) => (
                      <span key={m.id} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-md px-2 py-0.5">
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreateSession && (
        <CreateSessionModal
          teams={teams}
          onCreate={createSession}
          onClose={() => setShowCreateSession(false)}
        />
      )}

      {teamModal.open && (
        <TeamModal
          team={teamModal.team}
          onSave={handleSaveTeam}
          onClose={() => setTeamModal({ open: false, team: null })}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">Supprimer cette session ?</h3>
            <p className="text-sm text-gray-500 mb-5">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={() => { deleteSession(confirmDelete); setConfirmDelete(null) }}
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
