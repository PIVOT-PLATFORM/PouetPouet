'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

type Role = 'VIEWER' | 'EDITOR'

interface ShareEntry {
  id: string
  role: Role | 'OWNER'
  user: { id: string; name: string; email: string; avatar: string | null }
}

interface Team {
  id: string
  name: string
}

interface Props {
  module: string
  resourceId: string
  resourceName?: string
  onClose: () => void
}

// Modale de partage réutilisable pour les ressources de module (Scrum, Daily, …).
// Invite par email + gestion des rôles. Appelle /api/shares/:module/:resourceId/*.
export function ModuleShareModal({ module, resourceId, resourceName, onClose }: Props) {
  const base = `/api/shares/${module}/${resourceId}`
  const [shares, setShares] = useState<ShareEntry[] | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('EDITOR')
  const [error, setError] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)

  // Team invite section
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [teamId, setTeamId] = useState('')
  const [teamRole, setTeamRole] = useState<Role>('EDITOR')
  const [teamError, setTeamError] = useState<string | null>(null)
  const [invitingTeam, setInvitingTeam] = useState(false)
  const [showTeamSection, setShowTeamSection] = useState(false)

  useEffect(() => {
    api.get<ShareEntry[]>(base).then(setShares).catch(() => setShares([]))
  }, [base])

  function openTeamSection() {
    setShowTeamSection(true)
    if (!teams) {
      api.get<Team[]>('/api/teams').then((t) => { setTeams(t); if (t.length > 0) setTeamId(t[0].id) }).catch(() => setTeams([]))
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInviting(true)
    try {
      const share = await api.post<ShareEntry>(`${base}/invite`, { email: email.trim(), role })
      setShares((prev) => [...(prev ?? []).filter((s) => s.user.id !== share.user.id), share])
      setEmail('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setInviting(false)
    }
  }

  async function changeRole(id: string, r: Role) {
    setShares((prev) => prev?.map((s) => (s.id === id ? { ...s, role: r } : s)) ?? prev)
    await api.patch(`${base}/${id}`, { role: r }).catch(() => {})
  }

  async function revoke(id: string) {
    setShares((prev) => prev?.filter((s) => s.id !== id) ?? prev)
    await api.delete(`${base}/${id}`).catch(() => {})
  }

  async function inviteTeam(e: React.FormEvent) {
    e.preventDefault()
    setTeamError(null)
    setInvitingTeam(true)
    try {
      const newShares = await api.post<ShareEntry[]>(`${base}/invite-team`, { teamId, role: teamRole })
      setShares((prev) => {
        const merged = [...(prev ?? [])]
        for (const s of newShares) {
          const idx = merged.findIndex((x) => x.user.id === s.user.id)
          if (idx >= 0) merged[idx] = s
          else merged.push(s)
        }
        return merged
      })
      setShowTeamSection(false)
    } catch (err) {
      setTeamError((err as Error).message)
    } finally {
      setInvitingTeam(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Partager{resourceName ? ` « ${resourceName} »` : ''}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Invite par email */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Inviter par email</span>
          <form onSubmit={invite} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null) }}
              placeholder="email@exemple.com"
              className="flex-1 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-2 py-2 focus:outline-none focus:ring-1 focus:ring-primary-400"
            >
              <option value="VIEWER">Lecture</option>
              <option value="EDITOR">Édition</option>
            </select>
            <button
              type="submit"
              disabled={inviting || !email.trim()}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {inviting ? '…' : 'Inviter'}
            </button>
          </form>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <p className="text-[11px] text-gray-400">L'invité doit déjà avoir un compte. Éditeur = peut piloter ; Lecteur = lecture seule.</p>
        </div>

        {/* Inviter via une équipe */}
        {!showTeamSection ? (
          <button
            type="button"
            onClick={openTeamSection}
            className="self-start text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            + Partager à une équipe
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Partager à une équipe</span>
            {teams === null ? (
              <p className="text-xs text-gray-400">Chargement…</p>
            ) : teams.length === 0 ? (
              <p className="text-xs text-gray-400">Aucune équipe disponible.</p>
            ) : (
              <form onSubmit={inviteTeam} className="flex gap-2">
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="flex-1 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <select
                  value={teamRole}
                  onChange={(e) => setTeamRole(e.target.value as Role)}
                  className="text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-2 py-2 focus:outline-none focus:ring-1 focus:ring-primary-400"
                >
                  <option value="VIEWER">Lecture</option>
                  <option value="EDITOR">Édition</option>
                </select>
                <button
                  type="submit"
                  disabled={invitingTeam}
                  className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {invitingTeam ? '…' : 'Inviter'}
                </button>
              </form>
            )}
            {teamError && <p className="text-xs text-red-500">{teamError}</p>}
          </div>
        )}

        {/* Partages existants */}
        {shares && shares.length > 0 && (
          <>
            <hr className="border-gray-100 dark:border-gray-800" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Accès partagés</span>
              {shares.map((share) => (
                <div key={share.id} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 group">
                  <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center shrink-0">
                    {share.user.avatar ? (
                      <img src={share.user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold text-primary-600 dark:text-primary-300">
                        {share.user.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{share.user.name}</p>
                    <p className="text-xs text-gray-400 truncate">{share.user.email}</p>
                  </div>
                  <select
                    value={share.role === 'OWNER' ? 'EDITOR' : share.role}
                    onChange={(e) => changeRole(share.id, e.target.value as Role)}
                    className="text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400"
                  >
                    <option value="VIEWER">Lecture</option>
                    <option value="EDITOR">Édition</option>
                  </select>
                  <button
                    onClick={() => revoke(share.id)}
                    title="Retirer l'accès"
                    className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
