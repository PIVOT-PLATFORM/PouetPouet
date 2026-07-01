'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBoards, type Board } from '@/hooks/useBoards'
import { useTemplates } from '@/hooks/useTemplates'
import { CreateBoardModal } from '@/components/dashboard/create-board-modal'
import { TemplatesSection } from '@/components/dashboard/templates-section'
import { LayoutDashboard } from 'lucide-react'

const BOARD_THEMES = [
  { gradient: 'from-violet-500 to-primary-600', light: 'bg-violet-50', text: 'text-violet-600' },
  { gradient: 'from-blue-500 to-cyan-600', light: 'bg-blue-50', text: 'text-blue-600' },
  { gradient: 'from-emerald-500 to-teal-600', light: 'bg-emerald-50', text: 'text-emerald-600' },
  { gradient: 'from-orange-500 to-amber-500', light: 'bg-orange-50', text: 'text-orange-600' },
  { gradient: 'from-pink-500 to-rose-500', light: 'bg-pink-50', text: 'text-pink-600' },
  { gradient: 'from-secondary-500 to-fuchsia-600', light: 'bg-secondary-50', text: 'text-secondary-600' },
]

function getBoardTheme(id: string) {
  const n = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return BOARD_THEMES[n % BOARD_THEMES.length]
}

function BoardIcon({ gradient, src }: { gradient: string; src?: string | null }) {
  if (src) {
    return <img src={src} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
  }
  return (
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    </div>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="w-4 h-4" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  )
}

export default function DashboardPage() {
  const { boards, isLoading, error, boardPresence, createBoard, deleteBoard, toggleFavorite } = useBoards()
  const { templates, createTemplate, deleteTemplate, editTemplateContent, toggleTemplateFavorite } = useTemplates()
  const [showModal, setShowModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const router = useRouter()

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('Supprimer ce board ?')) return
    setDeletingId(id)
    try { await deleteBoard(id) } finally { setDeletingId(null) }
  }

  async function handleToggleFavorite(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    await toggleFavorite(id)
  }

  const q = search.trim().toLowerCase()
  const filtered = q ? boards.filter((b) => b.name.toLowerCase().includes(q) || b.description?.toLowerCase().includes(q)) : boards

  // Sort: favorites first, then by updatedAt (already done by API)
  const sortBoards = (arr: Board[]) =>
    [...arr].sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  const myBoards = sortBoards(filtered.filter((b) => b.role === 'OWNER'))
  const sharedBoards = sortBoards(filtered.filter((b) => b.role !== 'OWNER'))

  function BoardGrid({ items, showNewCard }: { items: Board[]; showNewCard?: boolean }) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((board) => {
          const theme = getBoardTheme(board.id)
          return (
            <div
              key={board.id}
              onClick={() => router.push(`/boards/${board.id}`)}
              className="group relative bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 cursor-pointer hover:shadow-lg hover:shadow-gray-200/60 dark:hover:shadow-gray-900/60 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-start gap-3 mb-4">
                <BoardIcon gradient={theme.gradient} src={board.coverImage} />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">{board.name}</h3>
                  {board.description && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">{board.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => handleToggleFavorite(e, board.id)}
                    title={board.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    className={`rounded-lg p-1.5 transition-all ${
                      board.isFavorite
                        ? 'text-amber-400 hover:text-amber-500 hover:bg-amber-50'
                        : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'
                    }`}
                  >
                    <StarIcon filled={board.isFavorite} />
                  </button>
                  {(boardPresence[board.id] ?? 0) > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      {boardPresence[board.id]}
                    </span>
                  )}
                  {board.shareCount > 0 && (
                    <span className="text-gray-300" title={`Partagé avec ${board.shareCount} personne${board.shareCount > 1 ? 's' : ''}`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </span>
                  )}
                  {board.role === 'OWNER' && (
                    <button
                      onClick={(e) => handleDelete(e, board.id)}
                      disabled={deletingId === board.id}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Modifié {new Date(board.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
                {board.role !== 'OWNER' ? (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${board.role === 'VIEWER' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {board.role === 'VIEWER' ? 'Lecture' : 'Éditeur'}
                  </span>
                ) : (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${theme.light} ${theme.text}`}>
                    Board
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {showNewCard && (
          <button
            onClick={() => setShowModal(true)}
            className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex flex-col items-center justify-center gap-2.5 text-gray-400 dark:text-gray-500 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/50 dark:hover:bg-primary-950/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 group-hover:bg-primary-100 dark:group-hover:bg-primary-950 flex items-center justify-center transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm font-medium">Nouveau board</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2"><LayoutDashboard size={28} style={{ color: '#6366f1' }} />Mes boards</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {isLoading ? '…' : `${boards.length} board${boards.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 active:scale-95 transition-all shadow-sm shadow-primary-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Nouveau board
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
            placeholder="Rechercher un board…"
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
          <div className="w-20 h-20 rounded-3xl bg-primary-50 dark:bg-primary-950 flex items-center justify-center mb-5">
            <svg className="w-10 h-10 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Aucun board pour l'instant</h2>
          <p className="text-gray-500 dark:text-gray-500 text-sm mb-6">Créez votre premier espace collaboratif</p>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
          >
            Créer un board
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {/* Section : mes boards */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Mes boards
              {myBoards.length > 0 && <span className="ml-2 text-gray-400 font-normal normal-case tracking-normal">({myBoards.length})</span>}
            </h2>
            {myBoards.length === 0 && !q ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-3xl bg-primary-50 dark:bg-primary-950 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                </div>
                <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">Vous n'avez pas encore créé de board</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
                >
                  Créer un board
                </button>
              </div>
            ) : myBoards.length === 0 && q ? (
              <p className="text-sm text-gray-400 py-4">Aucun résultat</p>
            ) : (
              <BoardGrid items={myBoards} showNewCard={!q} />
            )}
          </section>

          {/* Section : boards partagés */}
          {(sharedBoards.length > 0 || (!q && boards.some((b) => b.role !== 'OWNER'))) && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Partagés avec moi
                {sharedBoards.length > 0 && <span className="ml-2 text-gray-400 font-normal normal-case tracking-normal">({sharedBoards.length})</span>}
              </h2>
              {sharedBoards.length === 0 ? (
                <p className="text-sm text-gray-400 py-4">Aucun résultat</p>
              ) : (
                <BoardGrid items={sharedBoards} />
              )}
            </section>
          )}

          {/* Section : templates */}
          <TemplatesSection
            templates={templates}
            onDelete={deleteTemplate}
            onCreate={createTemplate}
            onEditContent={editTemplateContent}
            onToggleFavorite={toggleTemplateFavorite}
            ownedBoards={boards.filter((b) => b.role === 'OWNER').map((b) => ({ id: b.id, name: b.name }))}
          />
        </div>
      )}

      {showModal && (
        <CreateBoardModal
          onClose={() => setShowModal(false)}
          onCreate={createBoard}
          templates={templates}
        />
      )}
    </>
  )
}
