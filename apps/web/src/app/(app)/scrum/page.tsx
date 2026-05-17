'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { ESTIMATION_SCALES } from '@/hooks/useScrum'

interface RoomSummary {
  id: string
  name: string
  code: string
  scale: string
  createdAt: string
  updatedAt: string
  tickets: { id: string; status: string }[]
}

export default function ScrumPage() {
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newScale, setNewScale] = useState('FIBONACCI')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    api.get<RoomSummary[]>('/api/scrum').then((data) => {
      setRooms(data)
      setIsLoading(false)
    })
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const room = await api.post<RoomSummary>('/api/scrum', { name: newName.trim(), scale: newScale })
      setRooms((prev) => [room, ...prev])
      setNewName('')
      setNewScale('FIBONACCI')
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

  return (
    <>
      <div className="mb-10">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Scrum Poker</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {isLoading ? '…' : `${rooms.length} salle${rooms.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-sm shadow-indigo-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Nouvelle salle
          </button>
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
          <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center mb-5">
            <span className="text-3xl">🃏</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Aucune salle pour l'instant</h2>
          <p className="text-gray-400 text-sm mb-6">Créez votre première salle de Scrum Poker</p>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Créer une salle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => {
            const done = room.tickets.filter((t) => t.status === 'DONE').length
            const scaleInfo = ESTIMATION_SCALES[room.scale] ?? ESTIMATION_SCALES.FIBONACCI
            return (
              <div
                key={room.id}
                onClick={() => router.push(`/scrum/${room.id}`)}
                className="group relative bg-white dark:bg-gray-900 border border-gray-200/80 rounded-2xl p-5 cursor-pointer hover:shadow-lg hover:shadow-gray-200/60 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                    <span className="text-lg">🃏</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 truncate">{room.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">{room.code}</p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, room.id)}
                    disabled={deletingId === room.id}
                    className="opacity-0 group-hover:opacity-100 shrink-0 rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {done}/{room.tickets.length} ticket{room.tickets.length !== 1 ? 's' : ''} estimé{done !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                    {scaleInfo.label}
                  </span>
                </div>
              </div>
            )
          })}

          <button
            onClick={() => setShowModal(true)}
            className="h-40 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2.5 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
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
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900">Nouvelle salle Scrum Poker</h2>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nom</label>
              <input
                autoFocus
                type="text"
                placeholder="Nom de la salle…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
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

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowModal(false); setNewName(''); setNewScale('FIBONACCI') }}
                className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Création…' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
