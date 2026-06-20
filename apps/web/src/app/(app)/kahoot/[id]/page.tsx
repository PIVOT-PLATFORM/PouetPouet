'use client'

import { use, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { ArrowLeft, Plus, Trash2, Play, GripVertical, Check } from 'lucide-react'
import Link from 'next/link'

interface Question {
  id: string
  quizId: string
  text: string
  options: string[]
  correct: number
  timeLimit: number
  points: number
  order: number
}

interface Quiz {
  id: string
  title: string
}

const OPTION_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500']
const OPTION_LABELS = ['A', 'B', 'C', 'D']

function QuestionForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Question>
  onSave: (data: { text: string; options: string[]; correct: number; timeLimit: number; points: number }) => Promise<void>
  onCancel: () => void
}) {
  const [text, setText] = useState(initial?.text ?? '')
  const [options, setOptions] = useState<string[]>(initial?.options ?? ['', '', '', ''])
  const [correct, setCorrect] = useState(initial?.correct ?? 0)
  const [timeLimit, setTimeLimit] = useState(initial?.timeLimit ?? 30)
  const [points, setPoints] = useState(initial?.points ?? 1000)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const filled = options.filter((o) => o.trim())
    if (!text.trim() || filled.length < 2) return
    setSaving(true)
    await onSave({ text: text.trim(), options: filled, correct: Math.min(correct, filled.length - 1), timeLimit, points })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Question</label>
        <input
          autoFocus
          type="text"
          placeholder="De quelle couleur est le ciel ?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-rose-400 dark:text-gray-100"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
          Options (cliquer sur la bonne réponse)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCorrect(idx)}
                className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-white text-xs font-bold transition-all ${OPTION_COLORS[idx] ?? 'bg-gray-400'} ${correct === idx ? 'ring-2 ring-offset-2 ring-rose-500 scale-110' : 'opacity-70 hover:opacity-100'}`}
              >
                {correct === idx ? <Check className="w-4 h-4" /> : OPTION_LABELS[idx]}
              </button>
              <input
                type="text"
                placeholder={`Option ${OPTION_LABELS[idx]}`}
                value={opt}
                onChange={(e) => setOptions(options.map((o, i) => (i === idx ? e.target.value : o)))}
                className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-rose-400 dark:text-gray-100"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Durée (s)</label>
          <select
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value))}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-rose-400 dark:text-gray-100"
          >
            {[10, 20, 30, 60, 90, 120].map((v) => <option key={v} value={v}>{v}s</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Points</label>
          <select
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-rose-400 dark:text-gray-100"
          >
            {[500, 1000, 2000].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="rounded-xl border border-gray-200 dark:border-gray-700 text-sm px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          Annuler
        </button>
        <button type="submit" disabled={saving || !text.trim() || options.filter((o) => o.trim()).length < 2} className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold px-5 py-2 disabled:opacity-50 transition-colors">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}

export default function KahootEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: quizId } = use(params)
  const router = useRouter()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const dragIdx = useRef<number | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<Quiz>(`/api/kahoot/${quizId}`).catch(() => null),
      api.get<Question[]>(`/api/kahoot/${quizId}/questions`),
    ]).then(([q, qs]) => {
      if (q) setQuiz(q)
      setQuestions(qs ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [quizId])

  // If GET /api/kahoot/:id doesn't exist, build from questions response
  useEffect(() => {
    if (!quiz && questions.length > 0) {
      setQuiz({ id: quizId, title: 'Quiz' })
    }
  }, [quiz, questions, quizId])

  async function handleAddQuestion(data: { text: string; options: string[]; correct: number; timeLimit: number; points: number }) {
    const q = await api.post<Question>(`/api/kahoot/${quizId}/questions`, {
      ...data,
      order: questions.length,
    })
    setQuestions((prev) => [...prev, q])
    setShowAddForm(false)
  }

  async function handleEditQuestion(qId: string, data: { text: string; options: string[]; correct: number; timeLimit: number; points: number }) {
    const updated = await api.put<Question>(`/api/kahoot/questions/${qId}`, data)
    setQuestions((prev) => prev.map((q) => (q.id === qId ? updated : q)))
    setEditingId(null)
  }

  async function handleDeleteQuestion(qId: string) {
    if (!confirm('Supprimer cette question ?')) return
    setDeletingId(qId)
    await api.delete(`/api/kahoot/questions/${qId}`)
    setQuestions((prev) => prev.filter((q) => q.id !== qId))
    setDeletingId(null)
  }

  async function handleLaunch() {
    setLaunching(true)
    try {
      const { sessionId } = await api.post<{ sessionId: string; code: string }>(
        `/api/kahoot/${quizId}/session`, {}
      )
      router.push(`/kahoot/${quizId}/session/${sessionId}`)
    } catch {
      setLaunching(false)
    }
  }

  // HTML5 drag-to-reorder
  function handleDragStart(idx: number) { dragIdx.current = idx }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    const from = dragIdx.current
    if (from === null || from === idx) return
    setQuestions((prev) => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(idx, 0, item)
      dragIdx.current = idx
      return next
    })
  }
  async function handleDragEnd() {
    dragIdx.current = null
    await api.post(`/api/kahoot/${quizId}/reorder`, { order: questions.map((q) => q.id) }).catch(() => {})
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400 text-sm">Chargement…</div>
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/kahoot" className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{quiz?.title ?? 'Quiz'}</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{questions.length} question{questions.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={handleLaunch}
          disabled={launching || questions.length === 0}
          className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-50 transition-colors"
        >
          <Play className="w-4 h-4" />
          {launching ? 'Lancement…' : 'Lancer une session'}
        </button>
      </div>

      {/* Question list */}
      <div className="flex flex-col gap-3">
        {questions.map((q, idx) =>
          editingId === q.id ? (
            <QuestionForm
              key={q.id}
              initial={q}
              onSave={(data) => handleEditQuestion(q.id, data)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={q.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex items-start gap-3 cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Q{idx + 1} · {q.timeLimit}s · {q.points} pts</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{q.text}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {q.options.map((opt, oi) => (
                    <div
                      key={oi}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium ${
                        oi === q.correct
                          ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 ring-1 ring-green-300 dark:ring-green-700'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded shrink-0 flex items-center justify-center text-white text-[10px] font-bold ${OPTION_COLORS[oi] ?? 'bg-gray-400'}`}>
                        {OPTION_LABELS[oi]}
                      </span>
                      {opt}
                      {oi === q.correct && <Check className="w-3 h-3 ml-auto text-green-500" />}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => setEditingId(q.id)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                </button>
                <button
                  onClick={() => handleDeleteQuestion(q.id)}
                  disabled={deletingId === q.id}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        )}

        {showAddForm ? (
          <QuestionForm
            onSave={handleAddQuestion}
            onCancel={() => setShowAddForm(false)}
          />
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 py-4 text-sm text-gray-400 dark:text-gray-500 hover:border-rose-300 hover:text-rose-500 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter une question
          </button>
        )}
      </div>
    </div>
  )
}
