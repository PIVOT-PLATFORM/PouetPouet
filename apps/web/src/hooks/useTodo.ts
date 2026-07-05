'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export type TodoPriority = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'
export type TodoItemStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED'
export type TodoRole = 'OWNER' | 'EDITOR' | 'VIEWER'

export interface TodoCollaborator {
  id: string
  name: string
  email: string
}

export interface TodoListSummary {
  id: string
  name: string
  description: string | null
  ownerId: string
  dashboardId: string | null
  itemCount: number
  doneCount: number
  isFavorite: boolean
  role: TodoRole
  createdAt: string
  updatedAt: string
}

export interface TodoItem {
  id: string
  listId: string
  title: string
  notes: string | null
  status: TodoItemStatus
  priority: TodoPriority
  dueDate: string | null
  order: number
  assigneeIds: string[]
  createdAt: string
  updatedAt: string
}

export interface TodoListDetail {
  id: string
  name: string
  description: string | null
  ownerId: string
  dashboardId: string | null
  items: TodoItem[]
  isFavorite: boolean
  role: TodoRole
  createdAt: string
  updatedAt: string
}

export interface TodoListInput {
  name: string
  description?: string | null
}

export interface TodoItemInput {
  title: string
  notes?: string | null
  priority?: TodoPriority
  dueDate?: string | null
  assigneeIds?: string[]
}

export interface TodoListFilters {
  mine?: boolean
  favorite?: boolean
}

// ── Liste des listes (page /todo) ────────────────────────────────────────────
export function useTodoLists(filters: TodoListFilters = {}) {
  const [lists, setLists] = useState<TodoListSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.mine) params.set('mine', 'true')
      if (filters.favorite) params.set('favorite', 'true')
      const qs = params.toString()
      const data = await api.get<TodoListSummary[]>(`/api/todo/lists${qs ? `?${qs}` : ''}`)
      setLists(data)
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.mine, filters.favorite])

  useEffect(() => { load() }, [load])

  const createList = useCallback(async (input: TodoListInput) => {
    const list = await api.post<TodoListSummary>('/api/todo/lists', input)
    setLists((prev) => [list, ...prev])
    return list
  }, [])

  const toggleFavorite = useCallback(async (id: string) => {
    const result = await api.post<{ isFavorite: boolean }>(`/api/todo/lists/${id}/favorite`, {})
    setLists((prev) => prev.map((l) => l.id === id ? { ...l, isFavorite: result.isFavorite } : l))
  }, [])

  return { lists, isLoading, load, createList, toggleFavorite }
}

// ── Détail d'une liste (page /todo/[id]) ─────────────────────────────────────
export function useTodoList(id: string) {
  const [list, setList] = useState<TodoListDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.get<TodoListDetail>(`/api/todo/lists/${id}`)
      setList(data)
      setNotFound(false)
    } catch {
      setNotFound(true)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const updateList = useCallback(async (patch: Partial<TodoListInput>) => {
    const updated = await api.patch<TodoListDetail>(`/api/todo/lists/${id}`, patch)
    setList(updated)
    return updated
  }, [id])

  const toggleFavorite = useCallback(async () => {
    const result = await api.post<{ isFavorite: boolean }>(`/api/todo/lists/${id}/favorite`, {})
    setList((prev) => prev ? { ...prev, isFavorite: result.isFavorite } : prev)
  }, [id])

  const addItem = useCallback(async (input: TodoItemInput) => {
    const item = await api.post<TodoItem>(`/api/todo/lists/${id}/items`, input)
    setList((prev) => prev ? { ...prev, items: [...prev.items, item] } : prev)
    return item
  }, [id])

  const updateItem = useCallback(async (itemId: string, patch: Partial<TodoItemInput & { status: TodoItemStatus }>) => {
    const updated = await api.patch<TodoItem>(`/api/todo/lists/${id}/items/${itemId}`, patch)
    setList((prev) => prev ? { ...prev, items: prev.items.map((i) => i.id === itemId ? updated : i) } : prev)
    return updated
  }, [id])

  const deleteItem = useCallback(async (itemId: string) => {
    await api.delete(`/api/todo/lists/${id}/items/${itemId}`)
    setList((prev) => prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : prev)
  }, [id])

  return { list, isLoading, notFound, updateList, toggleFavorite, addItem, updateItem, deleteItem }
}

// ── Collaborateurs assignables (propriétaire + partagés) ────────────────────
export function useTodoListCollaborators(listId: string, currentUser: TodoCollaborator | null, isOwner: boolean, enabled: boolean) {
  const [collaborators, setCollaborators] = useState<TodoCollaborator[]>([])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    api.get<{ user: TodoCollaborator }[]>(`/api/shares/todolist/${listId}`)
      .then((shares) => {
        if (cancelled) return
        const list = shares.map((s) => s.user)
        if (isOwner && currentUser && !list.some((u) => u.id === currentUser.id)) list.unshift(currentUser)
        setCollaborators(list)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [listId, currentUser, isOwner, enabled])

  return collaborators
}
