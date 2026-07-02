'use client'

import { create } from 'zustand'
import { api } from '@/lib/api'

export type NotificationType = 'BOARD_SHARED' | 'ROLE_CHANGED' | 'ACCESS_REVOKED' | 'BOARD_DELETED' | 'DAILY_SESSION_ENDED' | 'SCRUM_ALL_ESTIMATED' | 'WHEEL_DRAW' | 'BOARD_IMPORTED'

export interface ActivityNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  readAt: string | null
  createdAt: string
}

export interface PatchNoteSection {
  heading: string
  items: string[]
}

export interface PatchNote {
  version: string
  date: string
  title: string
  summary: string
  sections: PatchNoteSection[]
}

interface NotificationsPayload {
  activity: ActivityNotification[]
  unreadActivity: number
  patchNotes: PatchNote[]
  patchNotesSeenAt: string | null
  patchNotesSeenVersion: string | null
  hasUnreadPatchNotes: boolean
}

interface NotificationsState {
  activity: ActivityNotification[]
  patchNotes: PatchNote[]
  patchNotesSeenVersion: string | null
  hasUnreadPatchNotes: boolean
  loaded: boolean
  // Bumped to ask the NotificationBell to open straight onto the patch notes tab
  // (e.g. from the version badge in the navbar).
  patchNotesSignal: number
  openPatchNotes: () => void
  fetch: () => Promise<void>
  /** Live insert from the socket. */
  receive: (n: ActivityNotification) => void
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  remove: (id: string) => Promise<void>
  markPatchNotesSeen: () => Promise<void>
  reset: () => void
}

// True when the latest patch note hasn't been acknowledged. Compares versions,
// not dates: two releases shipped the same day must each light the badge (#219).
function computeUnreadPatchNotes(patchNotes: PatchNote[], seenVersion: string | null): boolean {
  const latest = patchNotes[0]?.version
  if (!latest) return false
  return latest !== seenVersion
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  activity: [],
  patchNotes: [],
  patchNotesSeenVersion: null,
  hasUnreadPatchNotes: false,
  loaded: false,
  patchNotesSignal: 0,

  openPatchNotes: () => set((s) => ({ patchNotesSignal: s.patchNotesSignal + 1 })),

  fetch: async () => {
    try {
      const data = await api.get<NotificationsPayload>('/api/notifications')
      set({
        activity: data.activity,
        patchNotes: data.patchNotes,
        patchNotesSeenVersion: data.patchNotesSeenVersion,
        hasUnreadPatchNotes: data.hasUnreadPatchNotes,
        loaded: true,
      })
    } catch {
      // Non-fatal: the bell simply shows no notifications.
    }
  },

  receive: (n) =>
    set((state) =>
      state.activity.some((x) => x.id === n.id)
        ? state
        : { activity: [n, ...state.activity] }
    ),

  markRead: async (id) => {
    set((state) => ({
      activity: state.activity.map((n) =>
        n.id === id && n.readAt === null ? { ...n, readAt: new Date().toISOString() } : n
      ),
    }))
    try {
      await api.post(`/api/notifications/${id}/read`, {})
    } catch { /* optimistic */ }
  },

  markAllRead: async () => {
    const now = new Date().toISOString()
    set((state) => ({
      activity: state.activity.map((n) => (n.readAt === null ? { ...n, readAt: now } : n)),
    }))
    try {
      await api.post('/api/notifications/read-all', {})
    } catch { /* optimistic */ }
  },

  remove: async (id) => {
    set((state) => ({ activity: state.activity.filter((n) => n.id !== id) }))
    try {
      await api.delete(`/api/notifications/${id}`)
    } catch { /* optimistic */ }
  },

  markPatchNotesSeen: async () => {
    if (!get().hasUnreadPatchNotes) return
    set({ hasUnreadPatchNotes: false, patchNotesSeenVersion: get().patchNotes[0]?.version ?? null })
    try {
      await api.post('/api/notifications/patch-notes/seen', {})
    } catch { /* optimistic */ }
  },

  reset: () =>
    set({
      activity: [],
      patchNotes: [],
      patchNotesSeenVersion: null,
      hasUnreadPatchNotes: false,
      loaded: false,
    }),
}))

export { computeUnreadPatchNotes }
