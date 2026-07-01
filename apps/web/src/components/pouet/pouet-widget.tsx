'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const DEFAULT_PROMPTS = [
  'Comment lancer un Scrum Poker ?',
  'Quel module pour animer un atelier d\'équipe ?',
  'Comment partager un board avec mon équipe ?',
  'Comment rejoindre une session live sans compte ?',
]

const PROMPTS_BY_PREFIX: [string, string[]][] = [
  ['/boards/', [
    'Quels raccourcis clavier utiliser sur ce board ?',
    'Comment lancer une session live depuis ici ?',
    'Comment partager ce board ?',
    'Comment exporter le board en PDF ?',
  ]],
  ['/scrum', [
    'Comment révéler les votes simultanément ?',
    'Comment ajouter un ticket à estimer ?',
    'Comment inviter des participants sans compte ?',
    'Comment changer l\'échelle d\'estimation ?',
  ]],
  ['/daily', [
    'Comment réordonner les participants ?',
    'Comment passer un participant absent ?',
    'Comment voir l\'historique d\'une session ?',
    'Comment créer une équipe Daily ?',
  ]],
  ['/wheel', [
    'Comment activer le mode équilibré ?',
    'Comment exclure temporairement un membre ?',
    'Comment réinitialiser les probabilités ?',
    'Comment voir l\'historique des tirages ?',
  ]],
  ['/capacity', [
    'Comment créer un événement de capacité ?',
    'Comment lier Scrum Poker à la capacité ?',
    'Comment visualiser la vélocité de l\'équipe ?',
    'Comment définir des points engagés ?',
  ]],
  ['/meetops', [
    'Comment créer une réunion ?',
    'Comment générer un fichier .ics ?',
    'Comment consulter l\'historique des réunions ?',
    'Comment intégrer avec Outlook ?',
  ]],
  ['/roadmap', [
    'Comment créer un jalon dans la roadmap ?',
    'Comment déplacer une barre sur le Gantt ?',
    'Comment exporter la roadmap en PDF ?',
    'Comment filtrer par priorité ?',
  ]],
  ['/session/', [
    'Comment lancer un quiz depuis la session ?',
    'Comment voir les résultats en temps réel ?',
    'Comment inviter des participants anonymes ?',
    'Quelles activités sont disponibles ?',
  ]],
  ['/hub', [
    'Comment accéder à mes boards ?',
    'Quels modules sont disponibles dans Pivot ?',
    'Comment voir les nouveautés de l\'application ?',
    'Comment créer une équipe ?',
  ]],
]

function getSuggestedPrompts(pathname: string): string[] {
  for (const [prefix, prompts] of PROMPTS_BY_PREFIX) {
    if (pathname.startsWith(prefix)) return prompts
  }
  return DEFAULT_PROMPTS
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

function moduleFromPathname(pathname: string): string | undefined {
  if (pathname.startsWith('/boards/')) return 'Boards collaboratifs'
  if (pathname.startsWith('/scrum')) return 'Scrum Poker'
  if (pathname.startsWith('/daily')) return 'Daily Standup'
  if (pathname.startsWith('/wheel')) return 'La Roue'
  if (pathname.startsWith('/capacity')) return 'Capacité'
  if (pathname.startsWith('/meetops')) return 'MeetOps'
  if (pathname.startsWith('/session/')) return 'Sessions live'
  if (pathname.startsWith('/hub')) return 'Hub'
  return undefined
}

function inlineFormat(str: string): React.ReactNode {
  const parts = str.split(/(\*\*[^*]+\*\*|__[^_]+__)/g)
  return parts.map((part, i) => {
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function renderMarkdown(text: string, streaming: boolean): React.ReactNode {
  const cursor = streaming
    ? <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-current opacity-70 animate-pulse rounded-sm" />
    : null

  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let key = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const isLast = i === lines.length - 1

    // Table block: collect all consecutive pipe lines
    if (line.trimStart().startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      const isTailLast = i >= lines.length
      const rows = tableLines
        .filter(l => !/^\s*\|[\s|:-]+\|\s*$/.test(l))
        .map(l => l.split('|').slice(1, -1).map(c => c.trim()))
      if (rows.length > 0) {
        const [header, ...body] = rows
        nodes.push(
          <div key={key++} className="overflow-x-auto my-1">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  {header.map((cell, ci) => (
                    <th key={ci} className="border border-gray-300 dark:border-gray-600 px-2 py-1 bg-gray-200 dark:bg-gray-700 font-semibold text-left whitespace-nowrap">
                      {inlineFormat(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri} className="even:bg-gray-50 dark:even:bg-gray-900/40">
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                        {inlineFormat(cell)}
                        {isTailLast && ri === body.length - 1 && ci === row.length - 1 ? cursor : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      continue
    }

    // Heading
    if (/^#{1,3}\s/.test(line)) {
      nodes.push(
        <p key={key++} className="font-semibold mt-1">
          {inlineFormat(line.replace(/^#{1,3}\s/, ''))}{isLast ? cursor : null}
        </p>
      )
      i++; continue
    }

    // List item
    if (/^[-*]\s/.test(line)) {
      nodes.push(
        <div key={key++} className="flex gap-1.5">
          <span className="shrink-0 mt-0.5">•</span>
          <span>{inlineFormat(line.slice(2))}{isLast ? cursor : null}</span>
        </div>
      )
      i++; continue
    }

    // Empty line
    if (line.trim() === '') {
      nodes.push(<div key={key++} className="h-1" />)
      i++; continue
    }

    // Paragraph
    nodes.push(<p key={key++}>{inlineFormat(line)}{isLast ? cursor : null}</p>)
    i++
  }

  return <div className="space-y-0.5">{nodes}</div>
}

export function PouetWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const isBoardPage = pathname.startsWith('/boards/')
  const suggestedPrompts = getSuggestedPrompts(pathname)

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [open, messages])

  // Auto-expand when opening from a board page (canvas is precious space)
  useEffect(() => {
    if (isBoardPage && open) setExpanded(true)
  }, [isBoardPage, open])

  const copyMessage = (content: string, idx: number) => {
    void navigator.clipboard.writeText(content).then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 2000)
    })
  }

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: Message = { role: 'user', content: text.trim() }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const abort = new AbortController()
    abortRef.current = abort

    setMessages((prev) => [...prev, { role: 'assistant', content: '', streaming: true }])

    try {
      const res = await fetch(`${API_URL}/api/pouet/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: abort.signal,
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          context: {
            route: pathname,
            module: moduleFromPathname(pathname),
          },
        }),
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Erreur inconnue' })) as { error?: string }
        setMessages((prev) => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: err.error ?? 'Erreur inconnue', streaming: false }
          return copy
        })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data) as { token?: string; error?: string }
            if (parsed.error) {
              accumulated = parsed.error
            } else if (parsed.token) {
              accumulated += parsed.token
            }
            setMessages((prev) => {
              const copy = [...prev]
              copy[copy.length - 1] = { role: 'assistant', content: accumulated, streaming: true }
              return copy
            })
          } catch {
            // malformed SSE line
          }
        }
      }

      setMessages((prev) => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content: accumulated, streaming: false }
        return copy
      })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: 'Je suis temporairement indisponible. Réessaie dans un moment.', streaming: false }
          return copy
        })
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [messages, loading, pathname])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void sendMessage(input)
  }

  const handleStop = () => {
    abortRef.current?.abort()
    setMessages((prev) => {
      const copy = [...prev]
      if (copy[copy.length - 1]?.streaming) {
        copy[copy.length - 1] = { ...copy[copy.length - 1], streaming: false }
      }
      return copy
    })
    setLoading(false)
  }

  const panelClass = expanded
    ? 'fixed inset-4 sm:inset-8 z-50 flex flex-col rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden'
    : 'fixed bottom-20 right-6 z-50 w-80 sm:w-96 flex flex-col rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden'

  return (
    <>
      {open && (
        <div className={panelClass}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-primary-600 text-white shrink-0">
            <span className="text-lg font-bold leading-none">Pouet</span>
            <span className="text-xs text-primary-200 font-medium">Assistant Pivot</span>
            <div className="ml-auto flex items-center gap-0.5">
              <button
                onClick={() => setMessages([])}
                title="Effacer la conversation"
                className="text-primary-200 hover:text-white transition-colors p-1 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={() => setExpanded((v) => !v)}
                title={expanded ? 'Réduire' : 'Agrandir'}
                className="text-primary-200 hover:text-white transition-colors p-1 rounded"
              >
                {expanded ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0h5m-5 0v5M15 9l5-5m0 0h-5m5 0v5M9 15l-5 5m0 0h5m-5 0v-5M15 15l5 5m0 0h-5m5 0v-5" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setOpen(false)}
                title="Fermer"
                className="text-primary-200 hover:text-white transition-colors p-1 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className={`flex-1 overflow-y-auto p-4 space-y-3 min-h-0 ${expanded ? '' : 'max-h-96'}`}>
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Bonjour ! Je suis <strong>Pouet</strong>, l&apos;assistant de Pivot. Je peux t&apos;aider à utiliser l&apos;application.
                </p>
                <div className="space-y-1.5">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => void sendMessage(prompt)}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-950/50 hover:text-primary-700 dark:hover:text-primary-300 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-800 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="group relative max-w-[85%]">
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary-600 text-white rounded-br-sm whitespace-pre-wrap'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm'
                    }`}
                  >
                    {msg.role === 'user'
                      ? <>{msg.content}</>
                      : renderMarkdown(msg.content, !!msg.streaming)
                    }
                  </div>
                  {msg.role === 'assistant' && !msg.streaming && msg.content && (
                    <button
                      onClick={() => copyMessage(msg.content, i)}
                      title="Copier la réponse"
                      className="absolute -bottom-5 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                    >
                      {copiedIdx === i ? (
                        <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              placeholder="Pose ta question…"
              className="flex-1 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 disabled:opacity-50"
            />
            {loading ? (
              <button
                type="button"
                onClick={handleStop}
                title="Arrêter"
                className="shrink-0 p-2 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                title="Envoyer"
                className="shrink-0 p-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white disabled:text-gray-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            )}
          </form>
        </div>
      )}

      {/* Bouton flottant — visible sur toutes les pages y compris le board */}
      <button
        onClick={() => setOpen((v) => !v)}
        title={open ? 'Fermer Pouet' : 'Assistant Pouet'}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2zm-2 10H6V10h12v2zm0-3H6V7h12v2z" />
          </svg>
        )}
      </button>
    </>
  )
}
