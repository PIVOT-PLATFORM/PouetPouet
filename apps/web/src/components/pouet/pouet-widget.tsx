'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const SUGGESTED_PROMPTS = [
  'Comment lancer un Scrum Poker ?',
  'Quel module pour animer un atelier d\'équipe ?',
  'Comment partager un board avec mon équipe ?',
  'Comment rejoindre une session live sans compte ?',
]

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

export function PouetWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const isBoardPage = pathname.startsWith('/boards/')

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [open, messages])

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

    // Ajouter un message assistant vide qui va se remplir en streaming
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
            // malformed line
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

  // Ne pas afficher sur les pages board (espace trop contraint)
  if (isBoardPage) return null

  return (
    <>
      {/* Panneau de chat */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-80 sm:w-96 flex flex-col rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-primary-600 text-white shrink-0">
            <span className="text-lg font-bold leading-none">Pouet</span>
            <span className="text-xs text-primary-200 font-medium">Assistant Pivot</span>
            <button
              onClick={() => setMessages([])}
              title="Effacer la conversation"
              className="ml-auto text-primary-200 hover:text-white transition-colors p-1 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
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

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 max-h-96">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Bonjour ! Je suis <strong>Pouet</strong>, l&apos;assistant de Pivot. Je peux t&apos;aider à utiliser l&apos;application.
                </p>
                <div className="space-y-1.5">
                  {SUGGESTED_PROMPTS.map((prompt) => (
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
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white rounded-br-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                  {msg.streaming && (
                    <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-current opacity-70 animate-pulse rounded-sm" />
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

      {/* Bouton flottant */}
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
