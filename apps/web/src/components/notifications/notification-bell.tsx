'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { connectSocket } from '@/lib/socket'
import {
  useNotificationsStore,
  type ActivityNotification,
  type NotificationType,
  type PatchNote,
} from '@/store/notifications'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Relative French time, coarse-grained — enough for a notifications feed.
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  if (d < 7) return `il y a ${d} j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const TYPE_ICON: Record<NotificationType, { color: string; path: string }> = {
  BOARD_SHARED: { color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950', path: 'M13 7l5 5m0 0l-5 5m5-5H6' },
  ROLE_CHANGED: { color: 'text-amber-500 bg-amber-50 dark:bg-amber-950', path: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  ACCESS_REVOKED: { color: 'text-rose-500 bg-rose-50 dark:bg-rose-950', path: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
  BOARD_DELETED: { color: 'text-gray-500 bg-gray-100 dark:bg-gray-800', path: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
  DAILY_SESSION_ENDED: { color: 'text-sky-500 bg-sky-50 dark:bg-sky-950', path: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z' },
  SCRUM_ALL_ESTIMATED: { color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950', path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
}

function ActivityRow({
  n,
  onActivate,
  onRemove,
}: {
  n: ActivityNotification
  onActivate: (n: ActivityNotification) => void
  onRemove: (id: string) => void
}) {
  const icon = TYPE_ICON[n.type] ?? TYPE_ICON.BOARD_SHARED
  return (
    <div
      onClick={() => onActivate(n)}
      className={`group relative flex gap-3 px-4 py-3 cursor-pointer transition-colors ${
        n.readAt === null ? 'bg-indigo-50/50 dark:bg-indigo-950/30' : ''
      } hover:bg-gray-50 dark:hover:bg-gray-800/60`}
    >
      {n.readAt === null && <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500" />}
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${icon.color}`}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon.path} />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-800 dark:text-gray-100 leading-snug">{n.title}</p>
        {n.body && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.body}</p>}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{timeAgo(n.createdAt)}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(n.id) }}
        title="Supprimer"
        className="shrink-0 self-start opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-600 dark:hover:text-gray-200 transition-opacity"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// Full-screen detailed view of a single release, with prev/next navigation
// (buttons + arrow keys). Rendered in a portal so it sits above everything.
function PatchNoteModal({
  notes,
  index,
  isNew,
  onNavigate,
  onClose,
}: {
  notes: PatchNote[]
  index: number
  isNew: (date: string) => boolean
  onNavigate: (i: number) => void
  onClose: () => void
}) {
  const pn = notes[index]
  const hasPrev = index > 0
  const hasNext = index < notes.length - 1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && hasPrev) onNavigate(index - 1)
      else if (e.key === 'ArrowRight' && hasNext) onNavigate(index + 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, hasPrev, hasNext, onNavigate, onClose])

  if (!pn) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">v{pn.version}</span>
              {isNew(pn.date) && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-rose-600 bg-rose-50 dark:bg-rose-950 dark:text-rose-400 rounded px-1.5 py-0.5">Nouveau</span>
              )}
            </div>
            <h2 className="mt-0.5 text-lg font-bold text-gray-900 dark:text-gray-50 leading-tight">{pn.title}</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(pn.date)}</p>
          </div>
          <button
            onClick={onClose}
            title="Fermer"
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-5">
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{pn.summary}</p>
          {pn.sections.map((sec) => (
            <div key={sec.heading}>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">{sec.heading}</h3>
              <ul className="space-y-1.5">
                {sec.items.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    <span className="text-indigo-400 mt-1 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between gap-2 px-6 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
          <button
            disabled={!hasPrev}
            onClick={() => hasPrev && onNavigate(index - 1)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 enabled:hover:text-indigo-600 dark:enabled:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-default transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {hasPrev ? `v${notes[index - 1].version}` : 'Plus récent'}
          </button>
          <span className="text-xs text-gray-400 dark:text-gray-500">{index + 1} / {notes.length}</span>
          <button
            disabled={!hasNext}
            onClick={() => hasNext && onNavigate(index + 1)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 enabled:hover:text-indigo-600 dark:enabled:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-default transition-colors"
          >
            {hasNext ? `v${notes[index + 1].version}` : 'Plus ancien'}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function NotificationBell() {
  const router = useRouter()
  const {
    activity, patchNotes, patchNotesSeenAt, hasUnreadPatchNotes, loaded, patchNotesSignal,
    fetch, receive, markRead, markAllRead, remove, markPatchNotesSeen,
  } = useNotificationsStore()

  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'activity' | 'patch'>('activity')
  // Frozen "seen" timestamp so the "Nouveau" badges stay visible while the user reads,
  // even though opening the tab immediately persists the acknowledgement.
  const [patchSnapshot, setPatchSnapshot] = useState<string | null>(null)
  // Index of the patch note opened in the full detail modal, or null when closed.
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const unreadActivity = activity.filter((n) => n.readAt === null).length
  const showDot = unreadActivity > 0 || hasUnreadPatchNotes

  // Initial load + live socket updates.
  useEffect(() => {
    if (!loaded) void fetch()
    const socket = connectSocket()
    const onNew = (n: ActivityNotification) => receive(n)
    socket.on('notification:new', onNew)
    return () => { socket.off('notification:new', onNew) }
  }, [loaded, fetch, receive])

  // Close on outside click / Escape — but defer to the detail modal while it's open
  // (it owns its own backdrop click + Escape + arrow keys).
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (detailIndex !== null) return
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && detailIndex === null) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, detailIndex])

  // External trigger (e.g. the navbar version badge): open straight onto the patch notes.
  useEffect(() => {
    if (patchNotesSignal === 0) return
    if (!loaded) void fetch()
    setOpen(true)
    setTab('patch')
    setPatchSnapshot(patchNotesSeenAt)
    void markPatchNotesSeen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patchNotesSignal])

  function toggle() {
    setOpen((v) => {
      const next = !v
      if (next && !loaded) void fetch()
      return next
    })
  }

  function openPatchTab() {
    setTab('patch')
    setPatchSnapshot(patchNotesSeenAt)
    void markPatchNotesSeen()
  }

  function activate(n: ActivityNotification) {
    if (n.readAt === null) void markRead(n.id)
    if (n.link) { setOpen(false); router.push(n.link) }
  }

  function isPatchNew(date: string): boolean {
    return patchSnapshot === null || new Date(date) > new Date(patchSnapshot)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        title="Notifications"
        className="relative flex items-center justify-center w-9 h-9 rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {showDot && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-gray-900">
            {unreadActivity > 0 ? (unreadActivity > 9 ? '9+' : unreadActivity) : ''}
          </span>
        )}
      </button>

      {open && (
        // The bell (h-9) is centred in the h-14 navbar, so it sits 10px above the bar's
        // bottom; +18px from the bell lands the panel 8px below the navbar, matching the
        // gap used by the app's other anchored popups.
        <div className="absolute right-0 mt-[18px] w-[360px] max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-50">
          {/* Tabs */}
          <div className="flex items-center border-b border-gray-100 dark:border-gray-800">
            <button
              onClick={() => setTab('activity')}
              className={`relative flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === 'activity' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Activité
              {unreadActivity > 0 && <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold align-middle">{unreadActivity}</span>}
              {tab === 'activity' && <span className="absolute bottom-0 inset-x-0 h-0.5 bg-indigo-600 dark:bg-indigo-400" />}
            </button>
            <button
              onClick={openPatchTab}
              className={`relative flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === 'patch' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Nouveautés
              {hasUnreadPatchNotes && tab !== 'patch' && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-rose-500 align-middle" />}
              {tab === 'patch' && <span className="absolute bottom-0 inset-x-0 h-0.5 bg-indigo-600 dark:bg-indigo-400" />}
            </button>
          </div>

          {/* Activity tab */}
          {tab === 'activity' && (
            <>
              {unreadActivity > 0 && (
                <div className="flex justify-end px-4 py-1.5 border-b border-gray-50 dark:border-gray-800/50">
                  <button onClick={() => void markAllRead()} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                    Tout marquer comme lu
                  </button>
                </div>
              )}
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800/50">
                {activity.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <p className="text-sm text-gray-400 dark:text-gray-500">Aucune notification pour le moment.</p>
                  </div>
                ) : (
                  activity.map((n) => (
                    <ActivityRow key={n.id} n={n} onActivate={activate} onRemove={(id) => void remove(id)} />
                  ))
                )}
              </div>
            </>
          )}

          {/* Patch notes tab — vertical timeline; click an entry to open the full detail */}
          {tab === 'patch' && (
            <div className="max-h-[60vh] overflow-y-auto px-4 py-4">
              {patchNotes.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Aucune note de version.</p>
              ) : (
                <ol className="relative">
                  {patchNotes.map((pn, i) => {
                    const isNew = isPatchNew(pn.date)
                    const isLast = i === patchNotes.length - 1
                    return (
                      <li key={pn.version} className="relative pl-7 pb-5 last:pb-0">
                        {/* Connecting line */}
                        {!isLast && (
                          <span className="absolute left-[5px] top-3 bottom-0 w-px bg-gray-200 dark:bg-gray-700" aria-hidden />
                        )}
                        {/* Dot — filled/ringed when the release is new */}
                        <span
                          className={`absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full border-2 ${
                            isNew
                              ? 'bg-rose-500 border-rose-200 dark:border-rose-900'
                              : 'bg-indigo-400 border-white dark:border-gray-900'
                          }`}
                          aria-hidden
                        />
                        <button
                          onClick={() => setDetailIndex(i)}
                          className="group block w-full text-left -mt-0.5 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">v{pn.version}</span>
                            <span className="text-[11px] text-gray-400 dark:text-gray-500">{formatDate(pn.date)}</span>
                            {isNew && (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-rose-600 bg-rose-50 dark:bg-rose-950 dark:text-rose-400 rounded px-1.5 py-0.5">Nouveau</span>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm font-semibold text-gray-800 dark:text-gray-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                            {pn.title}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{pn.summary}</p>
                          <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-indigo-500 dark:text-indigo-400 opacity-70 group-hover:opacity-100 group-hover:gap-1 transition-all">
                            Détails
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          )}
        </div>
      )}

      {detailIndex !== null && patchNotes[detailIndex] && (
        <PatchNoteModal
          notes={patchNotes}
          index={detailIndex}
          isNew={isPatchNew}
          onNavigate={setDetailIndex}
          onClose={() => setDetailIndex(null)}
        />
      )}
    </div>
  )
}
