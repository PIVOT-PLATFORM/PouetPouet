'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export interface InnovationLink {
  id: string
  ficheId: string
  label: string
  url: string
  createdAt: string
}

// Liens externes rattachés à une fiche (distincts des pièces jointes : pas de fichier).
export function useInnovationLinks(ficheId: string) {
  const [links, setLinks] = useState<InnovationLink[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.get<InnovationLink[]>(`/api/innovation/fiches/${ficheId}/links`)
      setLinks(data)
    } finally {
      setIsLoading(false)
    }
  }, [ficheId])

  useEffect(() => { load() }, [load])

  const addLink = useCallback(async (label: string, url: string) => {
    const link = await api.post<InnovationLink>(`/api/innovation/fiches/${ficheId}/links`, { label, url })
    setLinks((prev) => [...prev, link])
    return link
  }, [ficheId])

  const deleteLink = useCallback(async (linkId: string) => {
    await api.delete(`/api/innovation/links/${linkId}`)
    setLinks((prev) => prev.filter((l) => l.id !== linkId))
  }, [])

  return { links, isLoading, addLink, deleteLink }
}
