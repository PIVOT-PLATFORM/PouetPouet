import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export interface Board {
  id: string
  name: string
  description: string | null
  ownerId: string
  createdAt: string
  updatedAt: string
}

export function useBoards() {
  const [boards, setBoards] = useState<Board[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    fetchBoards()
  }, [fetchBoards])

  const createBoard = async (name: string, description?: string) => {
    const board = await api.post<Board>('/api/boards', { name, description })
    setBoards((prev) => [board, ...prev])
    return board
  }

  const deleteBoard = async (id: string) => {
    await api.delete<void>(`/api/boards/${id}`)
    setBoards((prev) => prev.filter((b) => b.id !== id))
  }

  return { boards, isLoading, error, createBoard, deleteBoard, refetch: fetchBoards }
}
