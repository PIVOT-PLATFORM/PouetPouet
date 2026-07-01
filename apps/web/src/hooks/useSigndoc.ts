import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export type SignStatus = 'DRAFT' | 'SENT' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLINED' | 'EXPIRED' | 'VOIDED'
export type SignRole = 'SIGNER' | 'APPROVER' | 'CC'
export type SignRecipientStatus = 'PENDING' | 'SENT' | 'VIEWED' | 'SIGNED' | 'DECLINED'
export type SignFieldType = 'SIGNATURE' | 'INITIALS' | 'DATE' | 'TEXT'
export type ShareRole = 'OWNER' | 'EDITOR' | 'VIEWER'

export interface EnvelopeSummary {
  id: string
  name: string
  ownerId: string
  status: SignStatus
  ordered: boolean
  pageCount: number
  globalDeadline: string | null
  recipientCount: number
  fieldCount: number
  role: ShareRole
  createdAt: string
  updatedAt: string
}

export interface SignRecipient {
  id: string
  envelopeId: string
  userId: string | null
  email: string
  name: string
  routingOrder: number
  role: SignRole
  status: SignRecipientStatus
  deadline: string | null
  createdAt: string
}

export interface SignField {
  id: string
  envelopeId: string
  recipientId: string
  page: number
  x: number
  y: number
  w: number
  h: number
  type: SignFieldType
  required: boolean
  value: string | null
}

export interface SignEvent {
  id: string
  envelopeId: string
  recipientId: string | null
  type: string
  actorLabel: string
  createdAt: string
}

export interface EnvelopeDetail {
  id: string
  ownerId: string
  name: string
  message: string | null
  status: SignStatus
  ordered: boolean
  pageCount: number
  globalDeadline: string | null
  createdAt: string
  updatedAt: string
  role: ShareRole
  recipients: SignRecipient[]
  fields: SignField[]
  events: SignEvent[]
}

// Champ tel qu'envoyé au PUT /fields (sans les colonnes serveur).
export interface FieldInput {
  recipientId: string
  page: number
  x: number
  y: number
  w: number
  h: number
  type: SignFieldType
  required: boolean
}

// ── Liste des enveloppes ────────────────────────────────────────────────────

export function useEnvelopes() {
  const [envelopes, setEnvelopes] = useState<EnvelopeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setEnvelopes(await api.get<EnvelopeSummary[]>('/api/signdoc'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const uploadEnvelope = useCallback(async (file: File): Promise<EnvelopeDetail> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_URL}/api/signdoc/upload`, {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? 'Erreur upload')
    }
    return res.json()
  }, [])

  const fromPdf = useCallback(async (pdfDocumentId: string, name?: string): Promise<EnvelopeDetail> => {
    return api.post<EnvelopeDetail>('/api/signdoc/from-pdf', { pdfDocumentId, ...(name ? { name } : {}) })
  }, [])

  const remove = useCallback(async (id: string) => {
    await api.delete(`/api/signdoc/${id}`)
    setEnvelopes((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return { envelopes, loading, error, refresh, uploadEnvelope, fromPdf, remove }
}

// ── Détail / atelier d'une enveloppe ────────────────────────────────────────

export function useEnvelope(id: string) {
  const [envelope, setEnvelope] = useState<EnvelopeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setEnvelope(await api.get<EnvelopeDetail>(`/api/signdoc/${id}`))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { refresh() }, [refresh])

  const patch = useCallback(async (data: Partial<Pick<EnvelopeDetail, 'name' | 'message' | 'ordered' | 'globalDeadline'>>) => {
    const updated = await api.patch<EnvelopeDetail>(`/api/signdoc/${id}`, data)
    setEnvelope(updated)
  }, [id])

  const addRecipient = useCallback(async (data: { email: string; name: string; routingOrder?: number; role?: SignRole; deadline?: string | null }) => {
    const r = await api.post<SignRecipient>(`/api/signdoc/${id}/recipients`, data)
    setEnvelope((prev) => (prev ? { ...prev, recipients: [...prev.recipients, r] } : prev))
    return r
  }, [id])

  const updateRecipient = useCallback(async (rid: string, data: Partial<{ email: string; name: string; routingOrder: number; role: SignRole; deadline: string | null }>) => {
    const r = await api.patch<SignRecipient>(`/api/signdoc/${id}/recipients/${rid}`, data)
    setEnvelope((prev) => (prev ? { ...prev, recipients: prev.recipients.map((x) => (x.id === rid ? r : x)) } : prev))
  }, [id])

  const removeRecipient = useCallback(async (rid: string) => {
    await api.delete(`/api/signdoc/${id}/recipients/${rid}`)
    setEnvelope((prev) =>
      prev ? { ...prev, recipients: prev.recipients.filter((x) => x.id !== rid), fields: prev.fields.filter((f) => f.recipientId !== rid) } : prev,
    )
  }, [id])

  const saveFields = useCallback(async (fields: FieldInput[]) => {
    const saved = await api.put<SignField[]>(`/api/signdoc/${id}/fields`, { fields })
    setEnvelope((prev) => (prev ? { ...prev, fields: saved } : prev))
  }, [id])

  const send = useCallback(async () => {
    setEnvelope(await api.post<EnvelopeDetail>(`/api/signdoc/${id}/send`, {}))
  }, [id])

  const voidEnvelope = useCallback(async (reason?: string) => {
    setEnvelope(await api.post<EnvelopeDetail>(`/api/signdoc/${id}/void`, reason ? { reason } : {}))
  }, [id])

  return { envelope, loading, error, refresh, patch, addRecipient, updateRecipient, removeRecipient, saveFields, send, voidEnvelope }
}

export const FILE_URL = (id: string) => `${API_URL}/api/signdoc/${id}/file`

export interface VerifyResult {
  status: SignStatus
  originalHash: string
  sealedHash: string | null
  sealLevel: string | null
  completedAt: string | null
  chainValid: boolean
  fileIntegrity: boolean | null
}

export function verifyEnvelope(id: string): Promise<VerifyResult> {
  return api.get<VerifyResult>(`/api/signdoc/${id}/verify`)
}

// Télécharge le PDF scellé (binaire) avec authentification, puis déclenche la sauvegarde.
export async function downloadSealed(id: string, name: string): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const res = await fetch(`${API_URL}/api/signdoc/${id}/sealed`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new Error('Document scellé indisponible')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}-signe.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Révocation différée : Safari peut annuler le téléchargement si l'URL blob
  // est révoquée dans la même microtask que le click.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
