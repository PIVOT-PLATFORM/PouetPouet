import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export interface Board {
  id: string
  name: string
  description: string | null
  coverImage: string | null
  maxParticipants: number | null
  enabledActivities: string[] | null
  ownerId: string
  role: 'OWNER' | 'EDITOR' | 'VIEWER'
  shareCount: number
  isFavorite: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateBoardInput {
  name: string
  description?: string
  coverImage?: string | null
  maxParticipants?: number | null
  enabledActivities?: string[] | null
  templateId?: string
}

export interface UpdateBoardInput {
  name?: string
  description?: string | null
  coverImage?: string | null
  maxParticipants?: number | null
  enabledActivities?: string[] | null
}

export function useBoards() {
  const [boards, setBoards] = useState<Board[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [boardPresence, setBoardPresence] = useState<Record<string, number>>({})

  const fetchBoards = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.get<Board[]>('/api/boards')
      setBoards(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchPresence = useCallback(async () => {
    try {
      const data = await api.get<Record<string, number>>('/api/boards/presence')
      setBoardPresence(data)
    } catch {}
  }, [])

  useEffect(() => {
    fetchBoards()
  }, [fetchBoards])

  useEffect(() => {
    fetchPresence()
    const interval = setInterval(fetchPresence, 30000)
    return () => clearInterval(interval)
  }, [fetchPresence])

  const createBoard = async (input: CreateBoardInput) => {
    const board = await api.post<Board>('/api/boards', input)
    // Server returns the created board; refetch to ensure shareCount/isFavorite consistency when from template
    await fetchBoards()
    return board
  }

  const deleteBoard = async (id: string) => {
    await api.delete<void>(`/api/boards/${id}`)
    setBoards((prev) => prev.filter((b) => b.id !== id))
  }

  const updateBoard = async (id: string, input: UpdateBoardInput) => {
    const updated = await api.patch<Board>(`/api/boards/${id}`, input)
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, ...updated } : b)))
    return updated
  }

  const toggleFavorite = async (id: string) => {
    const current = boards.find((b) => b.id === id)
    const willFavorite = !current?.isFavorite
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, isFavorite: willFavorite } : b)))
    try {
      if (willFavorite) await api.post<{ isFavorite: boolean }>(`/api/boards/${id}/favorite`, {})
      else await api.delete<{ isFavorite: boolean }>(`/api/boards/${id}/favorite`)
    } catch (err) {
      // revert on failure
      setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, isFavorite: !willFavorite } : b)))
      throw err
    }
  }

  return { boards, isLoading, error, boardPresence, createBoard, deleteBoard, updateBoard, toggleFavorite, refetch: fetchBoards }
}
