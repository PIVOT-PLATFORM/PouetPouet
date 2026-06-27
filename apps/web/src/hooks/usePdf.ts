import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export interface PdfDocument {
  id: string
  ownerId: string
  folderId: string | null
  name: string
  tags: string[]
  pageCount: number
  size: number
  sizeLabel: string
  createdAt: string
  updatedAt: string
}

export interface PdfFolder {
  id: string
  name: string
  parentId: string | null
  createdAt: string
}

export interface PdfCapabilities {
  pandoc: boolean
}

// ── Liste + opérations bibliothèque ─────────────────────────────────────────

export function usePdfList(folderId?: string | null, tag?: string) {
  const [docs, setDocs] = useState<PdfDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (folderId === null) params.set('folder', 'root')
      else if (folderId) params.set('folder', folderId)
      if (tag) params.set('tag', tag)
      const qs = params.toString()
      const data = await api.get<PdfDocument[]>(`/api/pdf${qs ? `?${qs}` : ''}`)
      setDocs(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [folderId, tag])

  useEffect(() => { refresh() }, [refresh])

  const upload = useCallback(async (file: File, targetFolderId?: string | null): Promise<PdfDocument> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const params = targetFolderId ? `?folderId=${targetFolderId}` : ''
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_URL}/api/pdf/upload${params}`, {
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
    const updated = await api.patch<PdfDocument>(`/api/pdf/${id}`, { name })
    setDocs(prev => prev.map(d => d.id === id ? updated : d))
  }, [])

  const updateTags = useCallback(async (id: string, tags: string[]): Promise<void> => {
    const updated = await api.patch<PdfDocument>(`/api/pdf/${id}`, { tags })
    setDocs(prev => prev.map(d => d.id === id ? updated : d))
  }, [])

  const moveToFolder = useCallback(async (id: string, folderId: string | null): Promise<void> => {
    const updated = await api.patch<PdfDocument>(`/api/pdf/${id}`, { folderId })
    setDocs(prev => prev.map(d => d.id === id ? updated : d))
  }, [])

  const remove = useCallback(async (id: string): Promise<void> => {
    await api.delete(`/api/pdf/${id}`)
    setDocs(prev => prev.filter(d => d.id !== id))
  }, [])

  const duplicate = useCallback(async (id: string): Promise<PdfDocument> => {
    const doc = await api.post<PdfDocument>(`/api/pdf/${id}/duplicate`, {})
    setDocs(prev => [doc, ...prev])
    return doc
  }, [])

  const merge = useCallback(async (ids: string[], name: string, folderId?: string | null): Promise<PdfDocument> => {
    const doc = await api.post<PdfDocument>('/api/pdf/merge', { ids, name, folderId })
    setDocs(prev => [doc, ...prev])
    return doc
  }, [])

  return { docs, loading, error, refresh, upload, rename, updateTags, moveToFolder, remove, duplicate, merge }
}

// ── Dossiers ─────────────────────────────────────────────────────────────────

export function usePdfFolders() {
  const [folders, setFolders] = useState<PdfFolder[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<PdfFolder[]>('/api/pdf/folders')
      setFolders(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const createFolder = useCallback(async (name: string, parentId?: string | null): Promise<PdfFolder> => {
    const folder = await api.post<PdfFolder>('/api/pdf/folders', { name, parentId: parentId ?? null })
    setFolders(prev => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)))
    return folder
  }, [])

  const renameFolder = useCallback(async (id: string, name: string): Promise<void> => {
    const updated = await api.patch<PdfFolder>(`/api/pdf/folders/${id}`, { name })
    setFolders(prev => prev.map(f => f.id === id ? updated : f))
  }, [])

  const moveFolder = useCallback(async (id: string, parentId: string | null): Promise<void> => {
    const updated = await api.patch<PdfFolder>(`/api/pdf/folders/${id}/move`, { parentId })
    setFolders(prev => prev.map(f => f.id === id ? updated : f))
  }, [])

  const deleteFolder = useCallback(async (id: string): Promise<void> => {
    await api.delete(`/api/pdf/folders/${id}`)
    setFolders(prev => prev.filter(f => f.id !== id))
  }, [])

  return { folders, loading, refresh, createFolder, renameFolder, moveFolder, deleteFolder }
}

// ── Capacités serveur ─────────────────────────────────────────────────────────

export function usePdfCapabilities() {
  const [caps, setCaps] = useState<PdfCapabilities>({ pandoc: false })
  useEffect(() => {
    api.get<PdfCapabilities>('/api/pdf/capabilities').then(setCaps).catch(() => {})
  }, [])
  return caps
}

// ── Éditeur de document ───────────────────────────────────────────────────────

export function usePdfDoc(id: string) {
  const [doc, setDoc] = useState<PdfDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  const bumpVersion = useCallback(() => setVersion(v => v + 1), [])

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
    const updated = await api.post<PdfDocument>(`/api/pdf/${id}/reorder`, { pages })
    setDoc(updated)
    bumpVersion()
  }, [id, bumpVersion])

  const rotate = useCallback(async (pages: number[], deg: 90 | 180 | 270): Promise<void> => {
    const updated = await api.post<PdfDocument>(`/api/pdf/${id}/rotate`, { pages, deg })
    setDoc(updated)
    bumpVersion()
  }, [id, bumpVersion])

  const extract = useCallback(async (pages: number[], name: string): Promise<PdfDocument> => {
    return api.post<PdfDocument>(`/api/pdf/${id}/extract`, { pages, name })
  }, [id])

  const split = useCallback(async (splitAt: number[]): Promise<PdfDocument[]> => {
    return api.post<PdfDocument[]>(`/api/pdf/${id}/split`, { splitAt })
  }, [id])

  return { doc, loading, version, refresh, reorder, rotate, extract, split }
}

// ── Helpers d'export (client-side) ────────────────────────────────────────────

export function getFileUrl(id: string, v?: number) {
  return `${API_URL}/api/pdf/${id}/file${v !== undefined ? `?v=${v}` : ''}`
}

export function getExportUrl(id: string, format: 'text' | 'docx' | 'md') {
  const map = { text: 'text', docx: 'docx', md: 'md' }
  return `${API_URL}/api/pdf/${id}/${map[format]}`
}
