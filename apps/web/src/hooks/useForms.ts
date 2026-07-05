'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { FormSummary, FormDetail, FormFieldDef, FormResponseEntry, FormRecipientEntry } from '@pouetpouet/shared'

export type { FormSummary, FormDetail, FormFieldDef, FormResponseEntry, FormRecipientEntry }

// ── Liste ──────────────────────────────────────────────────────────────────────

export function useForms() {
  const [forms, setForms] = useState<FormSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get<FormSummary[]>('/api/forms')
      .then(setForms)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const createForm = useCallback(async (title: string) => {
    const f = await api.post<FormDetail>('/api/forms', { title })
    return f
  }, [])

  const deleteForm = useCallback(async (id: string) => {
    await api.delete(`/api/forms/${id}`)
    setForms((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const duplicateForm = useCallback(async (id: string) => {
    const copy = await api.post<FormDetail>(`/api/forms/${id}/duplicate`, {})
    setForms((prev) => [{ ...copy, fieldCount: copy.fields.length }, ...prev])
    return copy
  }, [])

  return { forms, isLoading, createForm, deleteForm, duplicateForm }
}

// ── Détail / édition ─────────────────────────────────────────────────────────────

export function useForm(id: string) {
  const [form, setForm] = useState<FormDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)

  useEffect(() => {
    api.get<FormDetail>(`/api/forms/${id}`)
      .then(setForm)
      .catch(() => setAccessDenied(true))
      .finally(() => setIsLoading(false))
  }, [id])

  const updateForm = useCallback(async (patch: Partial<{
    title: string
    description: string | null
    fields: FormFieldDef[]
    isPublished: boolean
    acceptingResponses: boolean
    limitOneResponse: boolean
    notifyOnResponse: boolean
    confirmationMessage: string | null
    redirectUrl: string | null
    closesAt: string | null
    maxResponses: number | null
    remindersEnabled: boolean
    reminderFrequencyDays: number
  }>) => {
    const updated = await api.patch<FormDetail>(`/api/forms/${id}`, patch)
    setForm(updated)
    return updated
  }, [id])

  return { form, isLoading, accessDenied, updateForm }
}

// ── Réponses ─────────────────────────────────────────────────────────────────────

export function useFormResponses(id: string) {
  const [responses, setResponses] = useState<FormResponseEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get<FormResponseEntry[]>(`/api/forms/${id}/responses`)
      .then(setResponses)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [id])

  const deleteResponse = useCallback(async (responseId: string) => {
    await api.delete(`/api/forms/${id}/responses/${responseId}`)
    setResponses((prev) => prev.filter((r) => r.id !== responseId))
  }, [id])

  return { responses, isLoading, deleteResponse }
}

// ── Destinataires nommés (sans compte) ──────────────────────────────────────────

export function useFormRecipients(id: string) {
  const [recipients, setRecipients] = useState<FormRecipientEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(() => {
    return api.get<FormRecipientEntry[]>(`/api/forms/${id}/recipients`).then(setRecipients).catch(() => {})
  }, [id])

  useEffect(() => { load().finally(() => setIsLoading(false)) }, [load])

  const addRecipients = useCallback(async (list: { name: string; email: string }[]) => {
    const result = await api.post<{ created: number; skipped: number }>(`/api/forms/${id}/recipients`, { recipients: list })
    await load()
    return result
  }, [id, load])

  const removeRecipient = useCallback(async (rid: string) => {
    await api.delete(`/api/forms/${id}/recipients/${rid}`)
    setRecipients((prev) => prev.filter((r) => r.id !== rid))
  }, [id])

  const sendInvites = useCallback(async (recipientIds?: string[]) => {
    const result = await api.post<{ sent: number }>(`/api/forms/${id}/recipients/send`, recipientIds ? { recipientIds } : {})
    await load()
    return result
  }, [id, load])

  const remind = useCallback(async (rid: string) => {
    await api.post(`/api/forms/${id}/recipients/${rid}/remind`, {})
    await load()
  }, [id, load])

  return { recipients, isLoading, addRecipients, removeRecipient, sendInvites, remind }
}
