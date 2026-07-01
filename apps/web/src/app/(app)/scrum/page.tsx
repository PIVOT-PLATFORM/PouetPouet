'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { ESTIMATION_SCALES } from '@/hooks/useScrum'
import { ModuleShareModal } from '@/components/share/module-share-modal'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { Target } from 'lucide-react'

interface TeamSummary {
  id: string
  name: string
}

interface RoomSummary {
  id: string
  name: string
  code: string
  scale: string
  createdAt: string
  updatedAt: string
  tickets: { id: string; status: string }[]
  team: TeamSummary | null
  role: 'OWNER' | 'EDITOR' | 'VIEWER'
}

export default function ScrumPage() {
  useFlagGuard('module.scrum')
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newScale, setNewScale] = useState('FIBONACCI')
  const [newTeamId, setNewTeamId] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [shareRoom, setShareRoom] = useState<RoomSummary | null>(null)
  const [search, setSearch] = useState('')
  const router = useRouter()

  useEffect(() => {
    Promise.all([
      api.get<RoomSummary[]>('/api/scrum'),
      api.get<TeamSummary[]>('/api/teams').catch(() => [] as TeamSummary[]),
    ]).then(([roomData, teamData]) => {
      setRooms(roomData)
      setTeams(teamData)
      setIsLoading(false)
    })
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const room = await api.post<RoomSummary>('/api/scrum', {
        name: newName.trim(),
        scale: newScale,
        ...(newTeamId ? { teamId: newTeamId } : {}),
      })
      setRooms((prev) => [room, ...prev])
      setNewName('')
      setNewScale('FIBONACCI')
      setNewTeamId('')
      setShowModal(false)
      router.push(`/scrum/${room.id}`)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('Supprimer cette salle ?')) return
    setDeletingId(id)
    try {
      await api.delete(`/api/scrum/${id}`)
      setRooms((prev) => prev.filter((r) => r.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const q = search.trim().toLowerCase()
  const filteredRooms = q
    ? rooms.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.team?.name.toLowerCase().includes(q))
    : rooms

  return (
    <>
      <div className="mb-8">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2"><Target size={28} style={{ color: '#f59e0b' }} />Scrum Poker</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {isLoading ? '…' : `${rooms.length} salle${rooms.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 active:scale-95 transition-all shadow-sm shadow-primary-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Nouvelle salle
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
            placeholder="Rechercher une salle…"
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

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-3xl bg-primary-50 flex items-center justify-center mb-5">
            <span className="text-3xl">🃏</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Aucune salle pour l'instant</h2>
          <p className="text-gray-500 text-sm mb-6">Créez votre première salle de Scrum Poker</p>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
          >
            Créer une salle
          </button>
        </div>
      ) : filteredRooms.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">Aucune salle ne correspond à « {search} ».</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map((room) => {
            const done = room.tickets.filter((t) => t.status === 'DONE').length
            const scaleInfo = ESTIMATION_SCALES[room.scale] ?? ESTIMATION_SCALES.FIBONACCI
            return (
              <div
                key={room.id}
                onClick={() => router.push(`/scrum/${room.id}`)}
                className="group relative bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 cursor-pointer hover:shadow-lg hover:shadow-gray-200/60 dark:hover:shadow-gray-900/60 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center shrink-0">
                    <span className="text-lg">🃏</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">{room.name}</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono">{room.code}</p>
                  </div>
                  {room.role === 'OWNER' ? (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShareRoom(room) }}
                        title="Partager"
                        className="p-1.5 rounded-lg text-gray-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                          <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, room.id)}
                        disabled={deletingId === room.id}
                        title="Supprimer"
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary-50 dark:bg-secondary-950 text-secondary-600 dark:text-secondary-400">
                      Partagé · {room.role === 'EDITOR' ? 'Éditeur' : 'Lecteur'}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                    {done}/{room.tickets.length} ticket{room.tickets.length !== 1 ? 's' : ''} estimé{done !== 1 ? 's' : ''}
                    {room.team && <span className="ml-1.5 text-primary-400">· {room.team.name}</span>}
                  </span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 shrink-0">
                    {scaleInfo.label}
                  </span>
                </div>
              </div>
            )
          })}

          <button
            onClick={() => setShowModal(true)}
            className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex flex-col items-center justify-center gap-2.5 text-gray-400 dark:text-gray-500 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/50 dark:hover:bg-primary-950/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 group-hover:bg-primary-100 dark:group-hover:bg-primary-950 flex items-center justify-center transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm font-medium">Nouvelle salle</span>
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <form
            onSubmit={handleCreate}
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Nouvelle salle Scrum Poker</h2>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nom</label>
              <input
                autoFocus
                type="text"
                placeholder="Nom de la salle…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Échelle d'estimation</label>
              <div className="flex gap-2">
                {Object.entries(ESTIMATION_SCALES).map(([key, info]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setNewScale(key)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                      newScale === key
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    {info.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {newScale === 'FIBONACCI' ? 'Valeurs : 1, 2, 3, 5, 8, 13, 21…' : 'Valeurs : 0.5h, 1h, 2h, 4h, 6h, 8h, 1j, 2j…'}
              </p>
            </div>

            {teams.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Équipe <span className="font-normal normal-case text-gray-400">(optionnel — alimente la Capacité)</span>
                </label>
                <select
                  value={newTeamId}
                  onChange={(e) => setNewTeamId(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  <option value="">Aucune équipe</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowModal(false); setNewName(''); setNewScale('FIBONACCI'); setNewTeamId('') }}
                className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Création…' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {shareRoom && (
        <ModuleShareModal
          module="scrum"
          resourceId={shareRoom.id}
          resourceName={shareRoom.name}
          onClose={() => setShareRoom(null)}
        />
      )}
    </>
  )
}
