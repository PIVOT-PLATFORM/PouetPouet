'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export type OrgSource = 'ldap' | 'interne'
export type InnovationOrgNiveau = 'COMEX' | 'DIRECTION' | 'DIVISION' | 'DEPARTEMENT' | 'EQUIPE'

export interface ResolvedOrgUnit {
  ref: string
  nom: string
  niveau: InnovationOrgNiveau
  parentRef: string | null
  source: OrgSource
}

export interface OrgUnitsResult {
  units: ResolvedOrgUnit[]
  ldapDegraded: boolean
}

export interface InnovationCategory {
  id: string
  label: string
  orgUnitRef: string | null
  actif: boolean
  ordre: number
}

// ── Référentiel organisationnel fusionné (LDAP + interne) ───────────────────────
export function useOrgUnits() {
  const [result, setResult] = useState<OrgUnitsResult>({ units: [], ldapDegraded: false })
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.get<OrgUnitsResult>('/api/innovation/org-units')
      setResult(data)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const createUnit = useCallback(async (input: { nom: string; niveau: InnovationOrgNiveau; parentId?: string | null }) => {
    await api.post('/api/innovation/org-units', input)
    await load()
  }, [load])

  const updateUnit = useCallback(async (rawId: string, patch: Partial<{ nom: string; niveau: InnovationOrgNiveau; parentId: string | null }>) => {
    await api.patch(`/api/innovation/org-units/${rawId}`, patch)
    await load()
  }, [load])

  const deleteUnit = useCallback(async (rawId: string) => {
    await api.delete(`/api/innovation/org-units/${rawId}`)
    await load()
  }, [load])

  return { ...result, isLoading, reload: load, createUnit, updateUnit, deleteUnit }
}

// ── Catégories applicables à un périmètre (héritage descendant) ─────────────────
export function useInnovationCategories(orgUnitRef?: string | null) {
  const [categories, setCategories] = useState<InnovationCategory[]>([])

  const load = useCallback(async () => {
    const qs = orgUnitRef ? `?orgUnitRef=${encodeURIComponent(orgUnitRef)}` : ''
    const data = await api.get<InnovationCategory[]>(`/api/innovation/categories${qs}`)
    setCategories(data)
  }, [orgUnitRef])

  useEffect(() => { load() }, [load])

  const createCategory = useCallback(async (input: { label: string; orgUnitRef?: string | null }) => {
    await api.post('/api/innovation/categories', input)
    await load()
  }, [load])

  const deleteCategory = useCallback(async (id: string) => {
    await api.delete(`/api/innovation/categories/${id}`)
    await load()
  }, [load])

  return { categories, reload: load, createCategory, deleteCategory }
}
