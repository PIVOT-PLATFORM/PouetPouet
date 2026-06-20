'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Zap, Plus, Pencil, Play, Trash2 } from 'lucide-react'

interface Quiz {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  _count: { questions: number }
}

export default function KahootPage() {
  const router = useRouter()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [launchingId, setLaunchingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    api.get<Quiz[]>('/api/kahoot').then(setQuizzes).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const quiz = await api.post<Quiz>('/api/kahoot', { title: newTitle.trim() })
      setQuizzes((prev) => [quiz, ...prev])
      setNewTitle('')
      setShowForm(false)
      router.push(`/kahoot/${quiz.id}`)
    } catch {}
    setCreating(false)
  }

  async function handleLaunch(quizId: string) {
    setLaunchingId(quizId)
    try {
      const { sessionId } = await api.post<{ sessionId: string; code: string }>(
        `/api/kahoot/${quizId}/session`, {}
      )
      router.push(`/kahoot/${quizId}/session/${sessionId}`)
    } catch {
      setLaunchingId(null)
    }
  }

  async function handleDelete(quizId: string) {
    if (!confirm('Supprimer ce quiz ?')) return
    setDeletingId(quizId)
    try {
      await api.delete(`/api/kahoot/${quizId}`)
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId))
    } catch {}
    setDeletingId(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Zap className="w-6 h-6 text-rose-500" />
            Quiz interactif
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Créez et animez des quiz style Kahoot en temps réel.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau quiz
        </button>
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
          <button
            type="submit"
            disabled={creating || !newTitle.trim()}
            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50 transition-colors"
          >
            {creating ? 'Création…' : 'Créer'}
          </button>
          <button
            type="button"
            onClick={() => { setShowForm(false); setNewTitle('') }}
            className="rounded-xl border border-gray-200 dark:border-gray-700 text-sm px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Annuler
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Chargement…</div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-16">
          <Zap className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Aucun quiz pour l'instant.</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Créez votre premier quiz pour commencer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 flex flex-col gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{quiz.title}</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {quiz._count.questions} question{quiz._count.questions !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/kahoot/${quiz.id}`}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium px-3 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Éditer
                </Link>
                <button
                  onClick={() => handleLaunch(quiz.id)}
                  disabled={launchingId === quiz.id}
                  className="flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-semibold px-3 py-1.5 text-white disabled:opacity-50 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  {launchingId === quiz.id ? 'Lancement…' : 'Lancer'}
                </button>
                <button
                  onClick={() => handleDelete(quiz.id)}
                  disabled={deletingId === quiz.id}
                  className="ml-auto flex items-center rounded-lg border border-gray-200 dark:border-gray-700 text-xs px-2.5 py-1.5 text-gray-400 hover:text-red-500 hover:border-red-200 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
