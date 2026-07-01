'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type {
  ParcourTemplateSummary,
  ParcourTemplateDetail,
  ParcourInstanceSummary,
  ParcourInstanceDetail,
  StepDef,
} from '@pouetpouet/shared'

export type { ParcourTemplateSummary, ParcourTemplateDetail, ParcourInstanceSummary, ParcourInstanceDetail, StepDef }

// ── Templates ────────────────────────────────────────────────────────────────────

export function useParcourTemplates() {
  const [templates, setTemplates] = useState<ParcourTemplateSummary[]>([])
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<ParcourTemplateSummary[]>('/api/parcours/templates'),
      api.get<string[]>('/api/parcours/stars'),
    ])
      .then(([tmpl, stars]) => { setTemplates(tmpl); setStarredIds(new Set(stars)) })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const toggleStar = useCallback(async (templateId: string) => {
    const res = await api.post<{ starred: boolean }>(`/api/parcours/templates/${templateId}/star`, {})
    setStarredIds((prev) => {
      const next = new Set(prev)
      if (res.starred) next.add(templateId)
      else next.delete(templateId)
      return next
    })
    setTemplates((prev) => prev.map((t) => t.id === templateId
      ? { ...t, starCount: t.starCount + (res.starred ? 1 : -1) }
      : t
    ))
  }, [])

  const createTemplate = useCallback(async (input: {
    name: string
    description?: string
    category?: string
    tags?: string[]
    steps: StepDef[]
    flowEdges?: import('@pouetpouet/shared').FlowEdge[]
    triggerType?: import('@pouetpouet/shared').TriggerType
    triggerConfig?: { formId?: string }
    defaultObservers?: string[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [k: string]: any
  }) => {
    const t = await api.post<ParcourTemplateDetail>('/api/parcours/templates', input)
    setTemplates((prev) => [{ ...t }, ...prev])
    return t
  }, [])

  const deleteTemplate = useCallback(async (id: string) => {
    await api.delete(`/api/parcours/templates/${id}`)
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const duplicateTemplate = useCallback(async (id: string) => {
    const copy = await api.post<ParcourTemplateDetail>(`/api/parcours/templates/${id}/duplicate`, {})
    setTemplates((prev) => [{ ...copy }, ...prev])
    return copy
  }, [])

  return { templates, starredIds, isLoading, createTemplate, deleteTemplate, duplicateTemplate, toggleStar }
}

export function useParcourTemplate(id: string) {
  const [template, setTemplate] = useState<ParcourTemplateDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)

  useEffect(() => {
    api.get<ParcourTemplateDetail>(`/api/parcours/templates/${id}`)
      .then(setTemplate)
      .catch(() => setAccessDenied(true))
      .finally(() => setIsLoading(false))
  }, [id])

  const updateTemplate = useCallback(async (patch: Partial<{
    name: string
    description: string
    category: string
    tags: string[]
    steps: StepDef[]
    flowEdges: import('@pouetpouet/shared').FlowEdge[]
    triggerType: import('@pouetpouet/shared').TriggerType
    triggerConfig: { formId?: string; cronExpression?: string; cronTitle?: string; webhookTitle?: string }
    defaultObservers: string[]
  }>) => {
    const updated = await api.patch<ParcourTemplateDetail>(`/api/parcours/templates/${id}`, patch)
    setTemplate(updated)
    return updated
  }, [id])

  const generateWebhook = useCallback(async () => {
    const res = await api.post<{ webhookToken: string }>(`/api/parcours/templates/${id}/webhook/generate`, {})
    setTemplate((prev) => prev ? { ...prev, webhookToken: res.webhookToken } : prev)
    return res.webhookToken
  }, [id])

  const deleteWebhook = useCallback(async () => {
    await api.delete(`/api/parcours/templates/${id}/webhook`)
    setTemplate((prev) => prev ? { ...prev, webhookToken: null } : prev)
  }, [id])

  return { template, isLoading, accessDenied, updateTemplate, generateWebhook, deleteWebhook }
}

// ── Instances ────────────────────────────────────────────────────────────────────

export function useParcourInstances(filters?: { status?: string }) {
  const [instances, setInstances] = useState<ParcourInstanceSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const params = filters?.status ? `?status=${filters.status}` : ''
    api.get<ParcourInstanceSummary[]>(`/api/parcours/instances${params}`)
      .then(setInstances)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [filters?.status])

  const startInstance = useCallback(async (input: {
    templateId: string
    title: string
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    dueAt?: string
  }) => {
    const i = await api.post<ParcourInstanceDetail>('/api/parcours/instances', input)
    setInstances((prev) => [{
      id: i.id,
      templateId: i.templateId,
      ownerId: i.ownerId,
      title: i.title,
      refNumber: i.refNumber,
      status: i.status,
      priority: i.priority,
      currentStep: i.currentStep,
      stepCount: i.steps.length,
      dueAt: i.dueAt,
      remindByEmail: i.remindByEmail,
      role: i.role,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    }, ...prev])
    return i
  }, [])

  return { instances, isLoading, startInstance }
}

export function useParcourInstance(id: string) {
  const [instance, setInstance] = useState<ParcourInstanceDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)

  const reload = useCallback(() => {
    // setIsLoading(true) intentionnellement absent : le mettre à true démonterait
    // StepRenderer et détruirait uploadedKey, bloquant le bouton Valider.
    // L'état isLoading(true) initial suffit pour le premier chargement.
    api.get<ParcourInstanceDetail>(`/api/parcours/instances/${id}`)
      .then(setInstance)
      .catch(() => setAccessDenied(true))
      .finally(() => setIsLoading(false))
  }, [id])

  useEffect(() => { reload() }, [reload])

  const completeStep = useCallback(async (stepIdx: number, input: {
    action: 'complete' | 'reject'
    data?: Record<string, unknown>
    comment?: string
  }) => {
    await api.post(`/api/parcours/instances/${id}/steps/${stepIdx}`, input)
    reload()
  }, [id, reload])

  const restartInstance = useCallback(async () => {
    await api.post(`/api/parcours/instances/${id}/restart`, {})
    reload()
  }, [id, reload])

  const skipStep = useCallback(async (stepIdx: number, comment?: string) => {
    await api.post(`/api/parcours/instances/${id}/steps/${stepIdx}/skip`, { comment })
    reload()
  }, [id, reload])

  const cancelInstance = useCallback(async (comment?: string) => {
    await api.post(`/api/parcours/instances/${id}/cancel`, { comment })
    reload()
  }, [id, reload])

  const reopenStep = useCallback(async (stepIdx: number) => {
    await api.post(`/api/parcours/instances/${id}/steps/${stepIdx}/reopen`, {})
    reload()
  }, [id, reload])

  const forceCompleteStep = useCallback(async (stepIdx: number, data?: Record<string, unknown>, comment?: string) => {
    await api.post(`/api/parcours/instances/${id}/steps/${stepIdx}/force-complete`, { data, comment })
    reload()
  }, [id, reload])

  const resetStep = useCallback(async (stepIdx: number) => {
    await api.post(`/api/parcours/instances/${id}/steps/${stepIdx}/reset`, {})
    reload()
  }, [id, reload])

  const updateStepData = useCallback(async (stepIdx: number, data: Record<string, unknown>) => {
    await api.patch(`/api/parcours/instances/${id}/steps/${stepIdx}/data`, { data })
    reload()
  }, [id, reload])

  const addComment = useCallback(async (comment: string) => {
    await api.post(`/api/parcours/instances/${id}/comment`, { comment })
    reload()
  }, [id, reload])

  const addStepComment = useCallback(async (stepIdx: number, comment: string) => {
    await api.post(`/api/parcours/instances/${id}/steps/${stepIdx}/comment`, { comment })
    reload()
  }, [id, reload])

  const updateInstance = useCallback(async (patch: {
    title?: string
    priority?: string
    dueAt?: string | null
    remindByEmail?: boolean
  }) => {
    await api.patch(`/api/parcours/instances/${id}`, patch)
    reload()
  }, [id, reload])

  const getDocumentUrl = useCallback(async (docId: string) => {
    return api.get<{ url: string; filename: string; mimeType: string }>(`/api/parcours/documents/${docId}/url`)
  }, [])

  const deleteDocument = useCallback(async (docId: string) => {
    await api.delete(`/api/parcours/documents/${docId}`)
    reload()
  }, [reload])

  const getUploadUrl = useCallback(async (filename: string, mimeType: string) => {
    return api.post<{ uploadUrl: string; key: string }>(`/api/parcours/instances/${id}/documents/upload-url`, { filename, mimeType })
  }, [id])

  const registerDocument = useCallback(async (doc: {
    storageKey: string
    filename: string
    mimeType: string
    sizeBytes: number
    classification?: 'C0' | 'C1' | 'C2' | 'C3'
    stepIndex?: number
  }) => {
    await api.post(`/api/parcours/instances/${id}/documents`, doc)
    reload()
  }, [id, reload])

  return { instance, isLoading, accessDenied, completeStep, restartInstance, skipStep, cancelInstance, reopenStep, forceCompleteStep, resetStep, updateStepData, addComment, addStepComment, updateInstance, getDocumentUrl, deleteDocument, getUploadUrl, registerDocument }
}
