import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export type TestBookStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'ARCHIVED'
export type TestCaseStatus = 'TODO' | 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIP'

export interface TestCase {
  id: string
  sectionId: string
  title: string
  precondition: string | null
  steps: string | null
  expected: string | null
  status: TestCaseStatus
  order: number
  createdAt: string
}

export interface TestSection {
  id: string
  bookId: string
  title: string
  order: number
  createdAt: string
  cases: TestCase[]
}

export interface TestBook {
  id: string
  ownerId: string
  title: string
  description: string | null
  version: string | null
  status: TestBookStatus
  createdAt: string
  updatedAt: string
  _count?: { sections: number }
}

export interface TestBookDetail extends TestBook {
  sections: TestSection[]
}

// ── Liste des cahiers ──────────────────────────────────────────────────────────

export function useTestBooks() {
  const [books, setBooks] = useState<TestBook[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    const data = await api.get<TestBook[]>('/api/testbooks')
    setBooks(data)
    setIsLoading(false)
  }, [])

  useEffect(() => { reload().catch(() => setIsLoading(false)) }, [reload])

  const createBook = useCallback(async (input: { title: string; description?: string; version?: string }) => {
    const book = await api.post<TestBook>('/api/testbooks', input)
    setBooks((prev) => [book, ...prev])
    return book
  }, [])

  const deleteBook = useCallback(async (id: string) => {
    await api.delete(`/api/testbooks/${id}`)
    setBooks((prev) => prev.filter((b) => b.id !== id))
  }, [])

  return { books, isLoading, reload, createBook, deleteBook }
}

// ── Détail d'un cahier ─────────────────────────────────────────────────────────

export function useTestBook(id: string) {
  const [book, setBook] = useState<TestBookDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const data = await api.get<TestBookDetail>(`/api/testbooks/${id}`)
      setBook(data)
      setIsLoading(false)
    } catch {
      setError('Cahier introuvable')
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => { void reload() }, [reload])

  const updateBook = useCallback(async (patch: Partial<{ title: string; description: string | null; version: string | null; status: TestBookStatus }>) => {
    const updated = await api.patch<TestBookDetail>(`/api/testbooks/${id}`, patch)
    setBook(updated)
    return updated
  }, [id])

  const addSection = useCallback(async (title: string) => {
    const section = await api.post<TestSection>(`/api/testbooks/${id}/sections`, { title })
    setBook((prev) => prev ? { ...prev, sections: [...prev.sections, section] } : prev)
    return section
  }, [id])

  const updateSection = useCallback(async (sectionId: string, patch: Partial<{ title: string; order: number }>) => {
    const updated = await api.patch<TestSection>(`/api/testbooks/sections/${sectionId}`, patch)
    setBook((prev) => prev ? {
      ...prev,
      sections: prev.sections.map((s) => s.id === sectionId ? { ...s, ...updated } : s),
    } : prev)
    return updated
  }, [])

  const deleteSection = useCallback(async (sectionId: string) => {
    await api.delete(`/api/testbooks/sections/${sectionId}`)
    setBook((prev) => prev ? {
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
    } : prev)
  }, [])

  const addCase = useCallback(async (sectionId: string, input: { title: string; precondition?: string; steps?: string; expected?: string }) => {
    const tc = await api.post<TestCase>(`/api/testbooks/sections/${sectionId}/cases`, input)
    setBook((prev) => prev ? {
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, cases: [...s.cases, tc] } : s,
      ),
    } : prev)
    return tc
  }, [])

  const updateCase = useCallback(async (caseId: string, patch: Partial<{ title: string; precondition: string | null; steps: string | null; expected: string | null; status: TestCaseStatus; order: number }>) => {
    const updated = await api.patch<TestCase>(`/api/testbooks/cases/${caseId}`, patch)
    setBook((prev) => prev ? {
      ...prev,
      sections: prev.sections.map((s) => ({
        ...s,
        cases: s.cases.map((c) => c.id === caseId ? { ...c, ...updated } : c),
      })),
    } : prev)
    return updated
  }, [])

  const deleteCase = useCallback(async (caseId: string) => {
    await api.delete(`/api/testbooks/cases/${caseId}`)
    setBook((prev) => prev ? {
      ...prev,
      sections: prev.sections.map((s) => ({
        ...s,
        cases: s.cases.filter((c) => c.id !== caseId),
      })),
    } : prev)
  }, [])

  const deleteBook = useCallback(async () => {
    await api.delete(`/api/testbooks/${id}`)
  }, [id])

  return {
    book, isLoading, error, reload,
    updateBook, deleteBook,
    addSection, updateSection, deleteSection,
    addCase, updateCase, deleteCase,
  }
}
