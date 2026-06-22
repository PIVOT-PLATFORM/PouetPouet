'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { Zap, Plus, Play } from 'lucide-react'
import { ModuleShareModal } from '@/components/share/module-share-modal'

interface Quiz {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  isFavorite: boolean
  shareCount: number
  _count: { questions: number }
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="w-4 h-4" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  )
}

export default function QuizPage() {
  useFlagGuard('module.quiz')
  const router = useRouter()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [launchingId, setLaunchingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [shareModal, setShareModal] = useState<{ id: string; title: string } | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get<Quiz[]>('/api/quiz').then(setQuizzes).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const quiz = await api.post<Quiz>('/api/quiz', { title: newTitle.trim() })
      setQuizzes((prev) => [quiz, ...prev])
      setNewTitle('')
      setShowForm(false)
      router.push(`/quiz/${quiz.id}`)
    } catch {}
    setCreating(false)
  }

  async function handleLaunch(e: React.MouseEvent, quizId: string) {
    e.stopPropagation()
    setLaunchingId(quizId)
    try {
      const { sessionId } = await api.post<{ sessionId: string; code: string }>(
        `/api/quiz/${quizId}/session`, {}
      )
      router.push(`/quiz/${quizId}/session/${sessionId}`)
    } catch {
      setLaunchingId(null)
    }
  }

  async function handleDelete(e: React.MouseEvent, quizId: string) {
    e.stopPropagation()
    if (!confirm('Supprimer ce quiz ?')) return
    setDeletingId(quizId)
    try {
      await api.delete(`/api/quiz/${quizId}`)
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId))
    } catch {}
    setDeletingId(null)
  }

  async function handleToggleFavorite(e: React.MouseEvent, quizId: string) {
    e.stopPropagation()
    const { isFavorite } = await api.patch<{ isFavorite: boolean }>(`/api/quiz/${quizId}/favorite`, {})
    setQuizzes((prev) =>
      prev
        .map((q) => (q.id === quizId ? { ...q, isFavorite } : q))
        .sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    )
  }

  const q = search.trim().toLowerCase()
  const filtered = q ? quizzes.filter((quiz) => quiz.title.toLowerCase().includes(q)) : quizzes

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Quiz interactif</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {loading ? '…' : `${quizzes.length} quiz`}
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold px-4 py-2.5 active:scale-95 transition-all shadow-sm shadow-rose-200"
        >
          <Plus className="w-4 h-4" />
          Nouveau quiz
        </button>
      </div>

      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un quiz…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-400 transition-all"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex gap-3">
          <input
            autoFocus
            type="text"
            placeholder="Titre du quiz…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-rose-400 dark:text-gray-100"
          />
          <button type="submit" disabled={creating || !newTitle.trim()} className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50 transition-colors">
            {creating ? 'Création…' : 'Créer'}
          </button>
          <button type="button" onClick={() => { setShowForm(false); setNewTitle('') }} className="rounded-xl border border-gray-200 dark:border-gray-700 text-sm px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Annuler
          </button>
        </form>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-36 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-16">
          <Zap className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Aucun quiz pour l'instant.</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Créez votre premier quiz pour commencer.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">Aucun résultat</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((quiz) => (
            <div
              key={quiz.id}
              onClick={() => router.push(`/quiz/${quiz.id}`)}
              className="group relative bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 cursor-pointer hover:shadow-lg hover:shadow-gray-200/60 dark:hover:shadow-gray-900/60 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">{quiz.title}</h3>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                    {quiz._count.questions} question{quiz._count.questions !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => handleToggleFavorite(e, quiz.id)}
                    title={quiz.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    className={`rounded-lg p-1.5 transition-all ${quiz.isFavorite ? 'text-amber-400 hover:text-amber-500 hover:bg-amber-50' : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'}`}
                  >
                    <StarIcon filled={quiz.isFavorite} />
                  </button>
                  {quiz.shareCount > 0 && (
                    <span className="text-gray-300" title={`Partagé avec ${quiz.shareCount} personne${quiz.shareCount > 1 ? 's' : ''}`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShareModal({ id: quiz.id, title: quiz.title }) }}
                    title="Partager"
                    className="p-1.5 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, quiz.id)}
                    disabled={deletingId === quiz.id}
                    title="Supprimer"
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Modifié {new Date(quiz.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
                <button
                  onClick={(e) => handleLaunch(e, quiz.id)}
                  disabled={launchingId === quiz.id || quiz._count.questions === 0}
                  className="flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-semibold px-3 py-1.5 text-white disabled:opacity-40 transition-colors"
                >
                  <Play className="w-3 h-3" />
                  {launchingId === quiz.id ? 'Lancement…' : 'Lancer'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {shareModal && (
        <ModuleShareModal
          module="quiz"
          resourceId={shareModal.id}
          resourceName={shareModal.title}
          onClose={() => setShareModal(null)}
        />
      )}
    </div>
  )
}
