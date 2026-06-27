import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export interface PdfDocument {
  id: string
  ownerId: string
  name: string
  pageCount: number
  size: number
  sizeLabel: string
  createdAt: string
  updatedAt: string
}

export function usePdfList() {
  const [docs, setDocs] = useState<PdfDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<PdfDocument[]>('/api/pdf')
      setDocs(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const upload = useCallback(async (file: File): Promise<PdfDocument> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_URL}/api/pdf/upload`, {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? 'Erreur upload')
    }
    const doc: PdfDocument = await res.json()
    setDocs(prev => [doc, ...prev])
    return doc
  }, [])

  const rename = useCallback(async (id: string, name: string): Promise<void> => {
    const updated: PdfDocument = await api.patch(`/api/pdf/${id}`, { name })
    setDocs(prev => prev.map(d => d.id === id ? updated : d))
  }, [])

  const remove = useCallback(async (id: string): Promise<void> => {
    await api.delete(`/api/pdf/${id}`)
    setDocs(prev => prev.filter(d => d.id !== id))
  }, [])

  const duplicate = useCallback(async (id: string): Promise<PdfDocument> => {
    const doc: PdfDocument = await api.post(`/api/pdf/${id}/duplicate`, {})
    setDocs(prev => [doc, ...prev])
    return doc
  }, [])

  const merge = useCallback(async (ids: string[], name: string): Promise<PdfDocument> => {
    const doc: PdfDocument = await api.post('/api/pdf/merge', { ids, name })
    setDocs(prev => [doc, ...prev])
    return doc
  }, [])

  return { docs, loading, error, refresh, upload, rename, remove, duplicate, merge }
}

export function usePdfDoc(id: string) {
  const [doc, setDoc] = useState<PdfDocument | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<PdfDocument>(`/api/pdf/${id}`)
      setDoc(data)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { refresh() }, [refresh])

  const reorder = useCallback(async (pages: number[]): Promise<void> => {
    const updated: PdfDocument = await api.post(`/api/pdf/${id}/reorder`, { pages })
    setDoc(updated)
  }, [id])

  const rotate = useCallback(async (pages: number[], deg: 90 | 180 | 270): Promise<void> => {
    const updated: PdfDocument = await api.post(`/api/pdf/${id}/rotate`, { pages, deg })
    setDoc(updated)
  }, [id])

  const extract = useCallback(async (pages: number[], name: string): Promise<PdfDocument> => {
    return api.post(`/api/pdf/${id}/extract`, { pages, name })
  }, [id])

  const split = useCallback(async (splitAt: number[]): Promise<PdfDocument[]> => {
    return api.post(`/api/pdf/${id}/split`, { splitAt })
  }, [id])

  return { doc, loading, refresh, reorder, rotate, extract, split }
}
