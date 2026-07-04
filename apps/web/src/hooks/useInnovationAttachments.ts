'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export interface InnovationAttachment {
  id: string
  ficheId: string
  filename: string
  mimeType: string
  sizeBytes: number
  uploader: { id: string; name: string }
  createdAt: string
}

// Pièces jointes (texte/image/vidéo) sur une fiche innovation — upload direct vers GCS
// via URL signée (pattern ParcourDocument), l'API ne stocke que les métadonnées.
export function useInnovationAttachments(ficheId: string) {
  const [attachments, setAttachments] = useState<InnovationAttachment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.get<InnovationAttachment[]>(`/api/innovation/fiches/${ficheId}/attachments`)
      setAttachments(data)
    } finally {
      setIsLoading(false)
    }
  }, [ficheId])

  useEffect(() => { load() }, [load])

  const getUploadUrl = useCallback(async (filename: string, mimeType: string) => {
    return api.post<{ uploadUrl: string; key: string }>(`/api/innovation/fiches/${ficheId}/attachments/upload-url`, { filename, mimeType })
  }, [ficheId])

  const registerAttachment = useCallback(async (doc: { storageKey: string; filename: string; mimeType: string; sizeBytes: number }) => {
    const attachment = await api.post<InnovationAttachment>(`/api/innovation/fiches/${ficheId}/attachments`, doc)
    setAttachments((prev) => [...prev, attachment])
    return attachment
  }, [ficheId])

  const uploadFile = useCallback(async (file: File) => {
    const { uploadUrl, key } = await getUploadUrl(file.name, file.type)
    const res = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
    if (!res.ok) throw new Error(`Upload échoué : ${res.status}`)
    return registerAttachment({ storageKey: key, filename: file.name, mimeType: file.type, sizeBytes: file.size })
  }, [getUploadUrl, registerAttachment])

  const getDownloadUrl = useCallback(async (attachmentId: string) => {
    return api.get<{ url: string; filename: string; mimeType: string }>(`/api/innovation/attachments/${attachmentId}/url`)
  }, [])

  const deleteAttachment = useCallback(async (attachmentId: string) => {
    await api.delete(`/api/innovation/attachments/${attachmentId}`)
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
  }, [])

  return { attachments, isLoading, uploadFile, getDownloadUrl, deleteAttachment }
}
