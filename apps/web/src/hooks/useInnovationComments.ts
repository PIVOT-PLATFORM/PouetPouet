'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export interface InnovationComment {
  id: string
  ficheId: string
  body: string
  author: { id: string; name: string }
  createdAt: string
  updatedAt: string
}

// Fil de discussion à plat sur une fiche innovation (pas de réponses imbriquées).
export function useInnovationComments(ficheId: string) {
  const [comments, setComments] = useState<InnovationComment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.get<InnovationComment[]>(`/api/innovation/fiches/${ficheId}/comments`)
      setComments(data)
    } finally {
      setIsLoading(false)
    }
  }, [ficheId])

  useEffect(() => { load() }, [load])

  const addComment = useCallback(async (body: string) => {
    const comment = await api.post<InnovationComment>(`/api/innovation/fiches/${ficheId}/comments`, { body })
    setComments((prev) => [...prev, comment])
    return comment
  }, [ficheId])

  const editComment = useCallback(async (commentId: string, body: string) => {
    const comment = await api.patch<InnovationComment>(`/api/innovation/fiches/${ficheId}/comments/${commentId}`, { body })
    setComments((prev) => prev.map((c) => c.id === commentId ? comment : c))
    return comment
  }, [ficheId])

  const deleteComment = useCallback(async (commentId: string) => {
    await api.delete(`/api/innovation/fiches/${ficheId}/comments/${commentId}`)
    setComments((prev) => prev.filter((c) => c.id !== commentId))
  }, [ficheId])

  return { comments, isLoading, addComment, editComment, deleteComment }
}
