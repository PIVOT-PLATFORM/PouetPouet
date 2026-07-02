import { createExternalServiceClient } from './external-client.js'

export type ContratStatut = 'ACTIF' | 'EXPIRE' | 'RESILIE'
export type CommandeStatut = 'EN_COURS' | 'LIVREE' | 'SOLDEE'

export interface PgiContratLot {
  id: string
  contratId: string
  numero: string
  intitule: string
  titulaire: string | null
  montantMax: number | null
  order: number
  // Calculés par le pod (il a Contrat et DemandeAchat dans le même process) — absents
  // sur la réponse de /contrat-lots/:id (lookup brut, sans le contexte du contrat).
  consomme?: number
  restant?: number | null
}

export interface PgiContrat {
  id: string
  numero: string
  objet: string
  dateDebut: string
  dateFin: string | null
  statut: ContratStatut
  notes: string | null
  referencePgi: string | null
  createdAt: string
  updatedAt: string
  lots: PgiContratLot[]
}

export interface PgiContratRecherche {
  id: string
  numero: string
  objet: string
}

export interface PgiDemandeAchatLot {
  id: string
  demandeAchatId: string
  contratLotId: string | null
  intitule: string
  titulaire: string | null
  montant: number
  order: number
}

export interface PgiDemandeAchat {
  id: string
  numero: string
  objet: string
  dateDemande: string
  notes: string | null
  createdAt: string
  lots: PgiDemandeAchatLot[]
}

export interface PgiCommande {
  id: string
  demandeAchatId: string
  numero: string
  referencePgi: string | null
  statut: CommandeStatut
  dateEmission: string
  createdAt: string
  updatedAt: string
}

export interface PgiPage<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

const client = createExternalServiceClient({ baseUrlEnv: 'PGI_API_URL', defaultTtlSeconds: 30 })

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

export const pgiClient = {
  listContrats(params: { q?: string; statut?: string; page?: number; pageSize?: number }) {
    return client.get<PgiPage<PgiContrat>>(`/contrats${qs(params)}`, 30)
  },
  getContrat(id: string) {
    return client.getOrNull<PgiContrat>(`/contrats/${id}`, 300)
  },
  searchContrats(q: string) {
    return client.get<PgiContratRecherche[]>(`/contrats/recherche${qs({ q })}`, 30)
  },
  getContratLot(id: string) {
    return client.getOrNull<PgiContratLot>(`/contrat-lots/${id}`, 300)
  },
  listDemandesAchat(params: { q?: string; page?: number; pageSize?: number }) {
    return client.get<PgiPage<PgiDemandeAchat>>(`/demandes-achat${qs(params)}`, 30)
  },
  getDemandeAchat(id: string) {
    return client.getOrNull<PgiDemandeAchat>(`/demandes-achat/${id}`, 30)
  },
  listCommandes() {
    return client.get<PgiCommande[]>('/commandes', 30)
  },
  getCommande(id: string) {
    return client.getOrNull<PgiCommande>(`/commandes/${id}`, 30)
  },
  getCommandeByDemandeAchatId(demandeAchatId: string) {
    return client.getOrNull<PgiCommande>(`/commandes/by-demande-achat/${demandeAchatId}`, 30)
  },
  async createCommande(input: { demandeAchatId: string; numero?: string; referencePgi?: string | null }) {
    const result = await client.post<PgiCommande>('/commandes', input)
    await client.invalidate('/commandes')
    return result
  },
  async updateCommande(id: string, patch: Partial<{ numero: string; referencePgi: string | null; statut: CommandeStatut }>) {
    const result = await client.put<PgiCommande>(`/commandes/${id}`, patch)
    await client.invalidate('/commandes')
    return result
  },
}
