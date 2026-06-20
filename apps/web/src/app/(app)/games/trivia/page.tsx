'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

const QUESTION_TIME = 15
const QUESTIONS_PER_GAME = 10

const ALL_QUESTIONS = [
  { q: "Quelle est la durée recommandée d'un Daily Scrum ?", options: ["5 minutes", "15 minutes", "30 minutes", "1 heure"], correct: 1 },
  { q: "Qui est responsable du Product Backlog dans Scrum ?", options: ["Scrum Master", "Product Owner", "Dev Team", "Sponsor"], correct: 1 },
  { q: "Que signifie 'MVP' ?", options: ["Most Valuable Player", "Minimum Viable Product", "Maximum Value Package", "Minimum Value Proposal"], correct: 1 },
  { q: "Quel artefact Scrum résume le travail restant sur un sprint ?", options: ["Backlog produit", "Burndown chart", "Kanban board", "Story map"], correct: 1 },
  { q: "Combien de valeurs fondamentales compte le Manifeste Agile ?", options: ["2", "4", "6", "12"], correct: 1 },
  { q: "Que signifie 'WIP' dans un contexte Kanban ?", options: ["Work In Progress", "Work Is Priority", "Weekly Issue Plan", "Work Item Process"], correct: 0 },
  { q: "Quel rôle facilite les cérémonies Scrum ?", options: ["Product Owner", "Dev Lead", "Scrum Master", "Sponsor"], correct: 2 },
  { q: "Une 'user story' se rédige du point de vue de qui ?", options: ["Du développeur", "De l'utilisateur final", "Du Product Owner", "Du Scrum Master"], correct: 1 },
  { q: "Que représente la 'vélocité' d'une équipe Scrum ?", options: ["Le nombre de bugs résolus", "La quantité de story points livrés par sprint", "La vitesse de déploiement", "Le nombre de réunions par semaine"], correct: 1 },
  { q: "Quelle est la durée typique d'un sprint Scrum ?", options: ["1 semaine", "2 semaines", "1 mois", "3 mois"], correct: 1 },
  { q: "Qu'est-ce qu'un 'spike' en Agile ?", options: ["Un bug critique", "Une tâche d'exploration ou de recherche", "Une user story épique", "Un déploiement en urgence"], correct: 1 },
  { q: "Que teste une 'Definition of Done' ?", options: ["Les critères d'acceptation d'une story", "Si une tâche peut être démarrée", "La qualité globale du produit", "Les compétences de l'équipe"], correct: 0 },
  { q: "Quelle cérémonie Scrum permet à l'équipe de s'améliorer ?", options: ["Sprint Review", "Sprint Planning", "Daily Scrum", "Sprint Retrospective"], correct: 3 },
  { q: "Que signifie 'INVEST' pour une bonne user story ?", options: ["Independent, Negotiable, Valuable, Estimable, Small, Testable", "Integrated, Named, Validated, Evaluated, Staged, Tested", "Innovative, New, Valuable, Essential, Sorted, Timely", "Incremental, Nested, Versioned, Easy, Simple, Tested"], correct: 0 },
  { q: "Dans Kanban, qu'est-ce qu'une 'limite WIP' ?", options: ["La durée maximale d'une tâche", "Le nombre maximum de tâches simultanées dans une colonne", "Le budget maximal du sprint", "Le nombre de membres de l'équipe"], correct: 1 },
  { q: "Qu'est-ce qu'une 'épic' en Agile ?", options: ["Un très grand bug", "Une user story trop grande pour un sprint", "Un sprint de 3 mois", "Un document de spécification"], correct: 1 },
  { q: "Quel outil visuel est souvent utilisé en Kanban ?", options: ["Diagramme de Gantt", "Tableau avec colonnes (À faire / En cours / Fait)", "PERT chart", "Mind map"], correct: 1 },
  { q: "Que signifie 'PI Planning' en SAFe ?", options: ["Product Increment Planning", "Program Increment Planning", "Project Initiation Planning", "Priority Items Planning"], correct: 1 },
  { q: "Qu'est-ce qu'un 'impediment' en Scrum ?", options: ["Un ticket trop complexe", "Un obstacle bloquant l'équipe", "Un nouveau membre de l'équipe", "Une fonctionnalité ajoutée en cours de sprint"], correct: 1 },
  { q: "Quel principe Agile favorise les individus et les interactions sur quoi ?", options: ["Les outils et procédures", "Les processus et les outils", "La documentation et les contrats", "Le planning et le budget"], correct: 1 },
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

type Answer = { questionIndex: number; chosen: number; correct: boolean }
type Phase = 'idle' | 'playing' | 'done'

export default function TriviaPage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [questions, setQuestions] = useState<typeof ALL_QUESTIONS>([])
  const [current, setCurrent] = useState(0)
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME)
  const [chosen, setChosen] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [showFeedback, setShowFeedback] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phaseRef = useRef<Phase>('idle')
  const currentRef = useRef(0)
  const answersRef = useRef<Answer[]>([])

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { currentRef.current = current }, [current])
  useEffect(() => { answersRef.current = answers }, [answers])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const goNextQuestion = useCallback(() => {
    const next = currentRef.current + 1
    if (next >= QUESTIONS_PER_GAME) {
      stopTimer()
      setPhase('done')
      phaseRef.current = 'done'
      return
    }
    setCurrent(next)
    currentRef.current = next
    setChosen(null)
    setShowFeedback(false)
    setTimeLeft(QUESTION_TIME)
  }, [stopTimer])

  const handleAnswer = useCallback((optIdx: number, qs: typeof ALL_QUESTIONS) => {
    if (chosen !== null) return
    stopTimer()
    const q = qs[currentRef.current]
    const correct = optIdx === q.correct
    setChosen(optIdx)
    setShowFeedback(true)

    const ans: Answer = { questionIndex: currentRef.current, chosen: optIdx, correct }
    setAnswers((prev) => {
      const next = [...prev, ans]
      answersRef.current = next
      return next
    })

    setTimeout(goNextQuestion, 1200)
  }, [chosen, stopTimer, goNextQuestion])

  const startTimer = useCallback((qs: typeof ALL_QUESTIONS) => {
    stopTimer()
    setTimeLeft(QUESTION_TIME)
    let t = QUESTION_TIME
    timerRef.current = setInterval(() => {
      t -= 1
      setTimeLeft(t)
      if (t <= 0) {
        stopTimer()
        // timeout = wrong
        handleAnswer(-1, qs)
      }
    }, 1000)
  }, [stopTimer, handleAnswer])

  const startGame = useCallback(() => {
    const picked = shuffle(ALL_QUESTIONS).slice(0, QUESTIONS_PER_GAME)
    setQuestions(picked)
    setPhase('playing')
    phaseRef.current = 'playing'
    setCurrent(0)
    currentRef.current = 0
    setChosen(null)
    setAnswers([])
    answersRef.current = []
    setShowFeedback(false)
    setTimeLeft(QUESTION_TIME)
    setTimeout(() => startTimer(picked), 50)
  }, [startTimer])

  // When current question changes during play, restart the timer
  // (but not on initial mount — startGame already handles first question)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (phase === 'playing' && !showFeedback) {
      startTimer(questions)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, phase])

  useEffect(() => () => stopTimer(), [stopTimer])

  const score = answers.filter((a) => a.correct).length
  const timerProgress = (timeLeft / QUESTION_TIME) * 100

  const q = questions[current]

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/games"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Retour aux jeux"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">🧠 Trivia Agile</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">10 questions · 15 secondes par question</p>
        </div>
      </div>

      {/* Idle */}
      {phase === 'idle' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-10 flex flex-col items-center gap-6">
          <div className="text-5xl">🧠</div>
          <div className="text-center space-y-1">
            <p className="font-semibold text-gray-900 dark:text-white">Testez vos connaissances Agile</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">10 questions tirées au hasard parmi 20</p>
          </div>
          <button
            onClick={startGame}
            className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
          >
            Commencer le quiz
          </button>
        </div>
      )}

      {/* Playing */}
      {phase === 'playing' && q && (
        <div className="space-y-4">
          {/* Progress */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Question {current + 1} / {QUESTIONS_PER_GAME}</span>
            <span className={`font-mono font-bold ${timeLeft <= 5 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
              {timeLeft}s
            </span>
          </div>

          {/* Timer bar */}
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                timeLeft <= 5 ? 'bg-red-500' : timeLeft <= 10 ? 'bg-amber-400' : 'bg-primary-500'
              }`}
              style={{ width: `${timerProgress}%` }}
            />
          </div>

          {/* Question */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
            <p className="font-semibold text-gray-900 dark:text-white text-sm leading-relaxed">{q.q}</p>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 gap-2.5">
            {q.options.map((opt, i) => {
              let style = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-primary-400 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/30 cursor-pointer'
              if (showFeedback) {
                if (i === q.correct) {
                  style = 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300'
                } else if (i === chosen) {
                  style = 'bg-red-50 dark:bg-red-950/40 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300'
                } else {
                  style = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 opacity-60'
                }
              }

              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i, questions)}
                  disabled={showFeedback}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${style}`}
                >
                  <span className="font-bold mr-2 text-xs opacity-60">{String.fromCharCode(65 + i)}.</span>
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Done */}
      {phase === 'done' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center space-y-3">
            <div className="text-4xl">{score >= 8 ? '🏆' : score >= 5 ? '🎯' : '📚'}</div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{score} / {QUESTIONS_PER_GAME}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {score >= 8 ? 'Expert Agile !' : score >= 5 ? 'Bon niveau !' : 'Continuez à apprendre !'}
            </p>
            <button
              onClick={startGame}
              className="mt-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
            >
              Rejouer
            </button>
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Résumé</p>
            {answers.map((ans, idx) => {
              const qData = questions[ans.questionIndex]
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-3 rounded-xl px-4 py-3 text-xs ${
                    ans.correct
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900'
                      : 'bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900'
                  }`}
                >
                  <span className={`mt-0.5 shrink-0 font-bold ${ans.correct ? 'text-emerald-500' : 'text-red-500'}`}>
                    {ans.correct ? '✓' : '✗'}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 dark:text-gray-200 leading-snug">{qData.q}</p>
                    {!ans.correct && (
                      <p className="text-emerald-600 dark:text-emerald-400 mt-0.5">
                        Réponse : {qData.options[qData.correct]}
                      </p>
                    )}
                    {ans.chosen === -1 && (
                      <p className="text-gray-500 dark:text-gray-400 mt-0.5 italic">Temps écoulé</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
