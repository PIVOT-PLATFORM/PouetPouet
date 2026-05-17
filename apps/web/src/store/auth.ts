'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/lib/api'

export interface User {
  id: string
  email: string
  name: string
  avatar: string | null
  bio: string | null
  theme: 'light' | 'dark'
  createdAt: string
}

interface AuthResponse {
  user: User
  token: string
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  clearError: () => void
  updateProfile: (data: { name?: string; bio?: string | null; theme?: 'light' | 'dark' }) => Promise<void>
  updateAvatar: (avatar: string | null) => Promise<void>
  changePassword: (current: string, next: string) => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const data = await api.post<AuthResponse>('/api/auth/login', { email, password })
          localStorage.setItem('token', data.token)
          set({ user: data.user, token: data.token, isLoading: false })
        } catch (err) {
          set({ error: (err as Error).message, isLoading: false })
          throw err
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true, error: null })
        try {
          const data = await api.post<AuthResponse>('/api/auth/register', { name, email, password })
          localStorage.setItem('token', data.token)
          set({ user: data.user, token: data.token, isLoading: false })
        } catch (err) {
          set({ error: (err as Error).message, isLoading: false })
          throw err
        }
      },

      logout: () => {
        localStorage.removeItem('token')
        set({ user: null, token: null })
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
    }),
    {
      name: 'pouetpouet-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
)
