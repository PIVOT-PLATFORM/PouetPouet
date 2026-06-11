'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, setOnUnauthorized } from '@/lib/api'

export interface User {
  id: string
  email: string
  name: string
  avatar: string | null
  bio: string | null
  theme: 'light' | 'dark'
  emailVerified: boolean
  favoriteModules: string[]
  createdAt: string
}

interface AuthResponse {
  user: User
  token: string
}

// Register either logs the user in (test bypass) or leaves the account pending verification.
export type RegisterResult =
  | { status: 'logged-in' }
  | { status: 'pending'; email: string; emailSent: boolean; devLink?: string }

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
  sessionExpired: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, bypass?: boolean) => Promise<RegisterResult>
  verifyEmail: (token: string) => Promise<void>
  resendVerification: (email: string) => Promise<{ devLink?: string }>
  forgotPassword: (email: string) => Promise<{ devLink?: string }>
  resetPassword: (token: string, password: string) => Promise<void>
  logout: () => void
  expireSession: () => void
  refreshSession: () => Promise<void>
  clearError: () => void
  updateProfile: (data: { name?: string; bio?: string | null; theme?: 'light' | 'dark' }) => Promise<void>
  updateAvatar: (avatar: string | null) => Promise<void>
  changePassword: (current: string, next: string) => Promise<void>
  deleteAccount: (password: string) => Promise<void>
  toggleModuleFavorite: (moduleId: string) => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,
      sessionExpired: false,

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const data = await api.post<AuthResponse>('/api/auth/login', { email, password })
          localStorage.setItem('token', data.token)
          set({ user: data.user, token: data.token, isLoading: false, sessionExpired: false })
        } catch (err) {
          set({ error: (err as Error).message, isLoading: false })
          throw err
        }
      },

      register: async (name, email, password, bypass = false) => {
        set({ isLoading: true, error: null })
        try {
          const data = await api.post<
            AuthResponse | { pending: true; email: string; emailSent: boolean; devLink?: string }
          >('/api/auth/register', { name, email, password, bypass })
          if ('token' in data) {
            localStorage.setItem('token', data.token)
            set({ user: data.user, token: data.token, isLoading: false, sessionExpired: false })
            return { status: 'logged-in' }
          }
          set({ isLoading: false })
          return { status: 'pending', email: data.email, emailSent: data.emailSent, devLink: data.devLink }
        } catch (err) {
          set({ error: (err as Error).message, isLoading: false })
          throw err
        }
      },

      verifyEmail: async (token) => {
        const data = await api.post<AuthResponse>('/api/auth/verify-email', { token })
        localStorage.setItem('token', data.token)
        set({ user: data.user, token: data.token, isLoading: false, sessionExpired: false })
      },

      resendVerification: async (email) => {
        return api.post<{ ok: true; devLink?: string }>('/api/auth/resend-verification', { email })
      },

      forgotPassword: async (email) => {
        return api.post<{ ok: true; devLink?: string }>('/api/auth/forgot-password', { email })
      },

      resetPassword: async (token, password) => {
        await api.post('/api/auth/reset-password', { token, password })
      },

      logout: () => {
        localStorage.removeItem('token')
        set({ user: null, token: null, sessionExpired: false })
      },

      expireSession: () => set({ sessionExpired: true }),

      // Slides the session forward: swaps the stored token for a fresh one.
      refreshSession: async () => {
        try {
          const { token } = await api.post<{ token: string }>('/api/auth/refresh', {})
          localStorage.setItem('token', token)
          set({ token })
        } catch {
          // A failed refresh (e.g. already expired) is handled by the 401 → expireSession path.
        }
      },

      clearError: () => set({ error: null }),

      updateProfile: async (data: { name?: string; bio?: string | null; theme?: 'light' | 'dark' }) => {
        const updated = await api.patch<User>('/api/auth/profile', data)
        set((state) => ({ user: state.user ? { ...state.user, ...updated } : null }))
      },

      updateAvatar: async (avatar) => {
        const updated = await api.post<User>('/api/auth/avatar', { avatar })
        set((state) => ({ user: state.user ? { ...state.user, ...updated } : null }))
      },

      changePassword: async (current, next) => {
        await api.patch('/api/auth/password', { current, next })
      },

      deleteAccount: async (password) => {
        await api.post('/api/auth/delete-account', { password })
        localStorage.removeItem('token')
        set({ user: null, token: null, sessionExpired: false })
      },

      toggleModuleFavorite: async (moduleId) => {
        // Optimistic update
        set((state) => {
          if (!state.user) return state
          const favs = state.user.favoriteModules
          const next = favs.includes(moduleId) ? favs.filter((m) => m !== moduleId) : [...favs, moduleId]
          return { user: { ...state.user, favoriteModules: next } }
        })
        try {
          const updated = await api.post<User>('/api/auth/favorites/modules', { moduleId })
          set((state) => ({ user: state.user ? { ...state.user, ...updated } : null }))
        } catch {
          // Revert on failure by refetching
        }
      },
    }),
    {
      name: 'pouetpouet-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
)

// Server-side JWT rejection (expired/invalid) flips the session into the expired state.
setOnUnauthorized(() => useAuthStore.getState().expireSession())
