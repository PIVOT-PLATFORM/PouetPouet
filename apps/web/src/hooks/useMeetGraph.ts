import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export interface GraphStatus {
  configured: boolean // variables MS_GRAPH_* présentes côté serveur
  connected: boolean // l'utilisateur a lié un compte Microsoft
  email: string | null
}

/** État de la connexion Microsoft Graph de l'utilisateur + actions connect/disconnect. */
export function useMeetGraph() {
  const [status, setStatus] = useState<GraphStatus | null>(null)

  const reload = useCallback(async () => {
    const s = await api.get<GraphStatus>('/api/meetops/graph/status')
    setStatus(s)
  }, [])

  useEffect(() => { void reload().catch(() => setStatus({ configured: false, connected: false, email: null })) }, [reload])

  // Redirige le navigateur vers le consentement Microsoft.
  const connect = useCallback(async () => {
    const { url } = await api.get<{ url: string }>('/api/meetops/graph/connect')
    window.location.href = url
  }, [])

  const disconnect = useCallback(async () => {
    await api.delete('/api/meetops/graph/disconnect')
    await reload()
  }, [reload])

  return { status, reload, connect, disconnect }
}
