import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export interface Board {
  id: string
  name: string
  description: string | null
  ownerId: string
  role: 'OWNER' | 'EDITOR' | 'VIEWER'
  shareCount: number
  createdAt: string
  updatedAt: string
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

  const createBoard = async (name: string, description?: string) => {
    const board = await api.post<Board>('/api/boards', { name, description })
    setBoards((prev) => [{ ...board, shareCount: 0 }, ...prev])
    return board
  }

  const deleteBoard = async (id: string) => {
    await api.delete<void>(`/api/boards/${id}`)
    setBoards((prev) => prev.filter((b) => b.id !== id))
  }

  return { boards, isLoading, error, boardPresence, createBoard, deleteBoard, refetch: fetchBoards }
}
