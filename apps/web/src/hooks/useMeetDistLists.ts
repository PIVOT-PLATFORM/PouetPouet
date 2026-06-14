import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { MeetDistList, MeetDistMember } from '@/lib/meetops'

export type { MeetDistList, MeetDistMember }

interface MemberInput { email: string; name?: string | null; role?: string | null }

/** Bibliothèque de listes de diffusion de l'utilisateur. eventId optionnel pour
 * inclure les listes locales à un événement en plus des listes globales. */
export function useMeetDistLists(eventId?: string) {
  const [lists, setLists] = useState<MeetDistList[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    const qs = eventId ? `?eventId=${eventId}` : ''
    const data = await api.get<MeetDistList[]>(`/api/meetops/distlists${qs}`)
    setLists(data)
    setIsLoading(false)
  }, [eventId])

  useEffect(() => { void reload().catch(() => setIsLoading(false)) }, [reload])

  const createList = useCallback(async (name: string, members: MemberInput[] = [], evId?: string | null) => {
    const list = await api.post<MeetDistList>('/api/meetops/distlists', { name, members, eventId: evId ?? null })
    setLists((prev) => [...prev, list].sort((a, b) => a.name.localeCompare(b.name)))
    return list
  }, [])

  const renameList = useCallback(async (id: string, name: string) => {
    const list = await api.patch<MeetDistList>(`/api/meetops/distlists/${id}`, { name })
    setLists((prev) => prev.map((l) => (l.id === id ? list : l)).sort((a, b) => a.name.localeCompare(b.name)))
  }, [])

  const deleteList = useCallback(async (id: string) => {
    await api.delete(`/api/meetops/distlists/${id}`)
    setLists((prev) => prev.filter((l) => l.id !== id))
  }, [])

  const addMember = useCallback(async (listId: string, input: MemberInput) => {
    const member = await api.post<MeetDistMember>(`/api/meetops/distlists/${listId}/members`, input)
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, members: [...l.members, member] } : l)))
  }, [])

  const removeMember = useCallback(async (listId: string, memberId: string) => {
    await api.delete(`/api/meetops/distlist-members/${memberId}`)
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, members: l.members.filter((m) => m.id !== memberId) } : l)))
  }, [])

  return { lists, isLoading, reload, createList, renameList, deleteList, addMember, removeMember }
}
