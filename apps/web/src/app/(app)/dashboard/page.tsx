'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBoards } from '@/hooks/useBoards'
import { CreateBoardModal } from '@/components/dashboard/create-board-modal'

const BOARD_THEMES = [
  { gradient: 'from-violet-500 to-indigo-600', light: 'bg-violet-50', text: 'text-violet-600' },
  { gradient: 'from-blue-500 to-cyan-600', light: 'bg-blue-50', text: 'text-blue-600' },
  { gradient: 'from-emerald-500 to-teal-600', light: 'bg-emerald-50', text: 'text-emerald-600' },
  { gradient: 'from-orange-500 to-amber-500', light: 'bg-orange-50', text: 'text-orange-600' },
  { gradient: 'from-pink-500 to-rose-500', light: 'bg-pink-50', text: 'text-pink-600' },
  { gradient: 'from-purple-500 to-fuchsia-600', light: 'bg-purple-50', text: 'text-purple-600' },
]

function getBoardTheme(id: string) {
  const n = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return BOARD_THEMES[n % BOARD_THEMES.length]
}

function BoardIcon({ gradient }: { gradient: string }) {
  return (
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    </div>
  )
}

export default function DashboardPage() {
  const { boards, isLoading, error, createBoard, deleteBoard } = useBoards()
  const [showModal, setShowModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('Supprimer ce board ?')) return
    setDeletingId(id)
    try { await deleteBoard(id) } finally { setDeletingId(null) }
  }

  return (
    <>
      {/* Hero */}
      <div className="mb-10">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Mes boards</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {isLoading ? '…' : `${boards.length} board${boards.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-sm shadow-indigo-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Nouveau board
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-3xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mb-5">
            <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Aucun board pour l'instant</h2>
          <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">Créez votre premier espace collaboratif</p>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Créer un board
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((board) => {
            const theme = getBoardTheme(board.id)
            return (
              <div
                key={board.id}
                onClick={() => router.push(`/boards/${board.id}`)}
                className="group relative bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 cursor-pointer hover:shadow-lg hover:shadow-gray-200/60 dark:hover:shadow-gray-900/60 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="flex items-start gap-3 mb-4">
                  <BoardIcon gradient={theme.gradient} />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">{board.name}</h3>
                    {board.description && (
                      <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">{board.description}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, board.id)}
                    disabled={deletingId === board.id}
                    className="opacity-0 group-hover:opacity-100 shrink-0 rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    Modifié {new Date(board.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${theme.light} ${theme.text}`}>
                    Board
                  </span>
                </div>
              </div>
            )
          })}

          {/* Card nouvelle board */}
          <button
            onClick={() => setShowModal(true)}
            className="h-40 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col items-center justify-center gap-2.5 text-gray-400 dark:text-gray-500 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-950 flex items-center justify-center transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm font-medium">Nouveau board</span>
          </button>
        </div>
      )}

      {showModal && (
        <CreateBoardModal onClose={() => setShowModal(false)} onCreate={createBoard} />
      )}
    </>
  )
}
