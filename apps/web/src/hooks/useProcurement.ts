import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type {
  Contrat,
  ContratLot,
  ContratStatut,
  ContratRecherche,
  Page,
  DemandeAchat,
  DemandeAchatLot,
  ValidationStatut,
  Commande,
  CommandeStatut,
  Activite,
  TypeActivite,
  ActiviteStatut,
  Meteo,
  ActiviteGain,
  ActiviteFaitMarquant,
  ActiviteBudgetLigne,
  TypeLigneBudget,
  ActiviteJalon,
  JalonType,
  ActiviteRisque,
  RisqueStatut,
  Produit,
  ProduitDetail,
  OrgUnit,
  OrgUnitNiveau,
  ProfilAchat,
  RoleAchat,
  DelegationValidation,
  PouvoirDelegation,
} from '@/lib/procurement'

export type {
  Contrat, ContratLot, ContratStatut, ContratRecherche, Page, DemandeAchat, DemandeAchatLot, ValidationStatut, Commande, CommandeStatut,
  Activite, TypeActivite, ActiviteStatut, Meteo, ActiviteGain, ActiviteFaitMarquant, ActiviteBudgetLigne,
  TypeLigneBudget, ActiviteJalon, JalonType, ActiviteRisque, RisqueStatut, Produit, ProduitDetail,
  OrgUnit, OrgUnitNiveau, ProfilAchat, RoleAchat, DelegationValidation, PouvoirDelegation,
}

// Recherche légère pour les combobox de sélection de contrat (pas une liste pour table —
// pas de pagination, juste les premiers résultats pertinents, appelée à la volée).
export async function searchContrats(q: string): Promise<ContratRecherche[]> {
  const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
  return api.get<ContratRecherche[]>(`/api/procurement/contrats/recherche${qs}`)
}

// ── Référentiels de gouvernance configurables par OrgUnit (avec héritage) ─────────

export type ChampConfigurable = 'TYPE_LIGNE_BUDGET' | 'JALON_TYPE' | 'TYPE_ACTIVITE'

export interface GovernanceValue {
  valeur: string
  actif: boolean
  obligatoire: boolean
}

export interface GovernanceEtatValue extends GovernanceValue {
  source: 'local' | 'herite' | 'defaut'
  sourceOrgUnitNom?: string
}

// Liste résolue (avec héritage) pour peupler un select — orgUnitId null/undefined
// résout sur le comportement par défaut (équivalent à l'ancien comportement figé en dur).
export function useGovernanceConfig(orgUnitId: string | null | undefined, champ: ChampConfigurable) {
  const [valeurs, setValeurs] = useState<GovernanceValue[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    const qs = new URLSearchParams({ champ })
    if (orgUnitId) qs.set('orgUnitId', orgUnitId)
    api.get<GovernanceValue[]>(`/api/procurement/governance-config?${qs}`)
      .then(setValeurs)
      .finally(() => setIsLoading(false))
  }, [orgUnitId, champ])

  return { valeurs, isLoading }
}

// Vue complète (toutes les valeurs + provenance) pour la page d'administration.
export function useGovernanceEtat(orgUnitId: string | null) {
  const [etat, setEtat] = useState<Record<ChampConfigurable, GovernanceEtatValue[]> | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!orgUnitId) { setEtat(null); return }
    setIsLoading(true)
    try {
      const result = await api.get<Record<ChampConfigurable, GovernanceEtatValue[]>>(`/api/procurement/governance-config/etat?orgUnitId=${orgUnitId}`)
      setEtat(result)
    } finally {
      setIsLoading(false)
    }
  }, [orgUnitId])

  useEffect(() => { void reload() }, [reload])

  const save = useCallback(async (champ: ChampConfigurable, valeurs: GovernanceValue[]) => {
    if (!orgUnitId) return
    await api.put('/api/procurement/governance-config', { orgUnitId, champ, valeurs })
    await reload()
  }, [orgUnitId, reload])

  const resetToInherited = useCallback(async (champ: ChampConfigurable) => {
    if (!orgUnitId) return
    await api.delete(`/api/procurement/governance-config?orgUnitId=${orgUnitId}&champ=${champ}`)
    await reload()
  }, [orgUnitId, reload])

  return { etat, isLoading, reload, save, resetToInherited }
}

// ── Contrats list (lecture seule — données externes, cf. apps/pgi-mock) ──────────

export interface ContratsListParams {
  q?: string
  statut?: ContratStatut | ''
  page?: number
  pageSize?: number
}

// Liste paginée/recherchable — la table des contrats peut compter plusieurs milliers de
// lignes (rustine PGI), donc tout filtrage se fait côté serveur (cf. GET /contrats).
export function useContrats(params: ContratsListParams = {}) {
  const { q = '', statut = '', page = 1, pageSize = 25 } = params
  const [data, setData] = useState<Page<Contrat>>({ items: [], total: 0, page: 1, pageSize })
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    setIsLoading(true)
    try {
      const qs = new URLSearchParams()
      if (q) qs.set('q', q)
      if (statut) qs.set('statut', statut)
      qs.set('page', String(page))
      qs.set('pageSize', String(pageSize))
      const result = await api.get<Page<Contrat>>(`/api/procurement/contrats?${qs}`)
      setData(result)
    } finally {
      setIsLoading(false)
    }
  }, [q, statut, page, pageSize])

  useEffect(() => { void reload() }, [reload])

  return { contrats: data.items, total: data.total, page: data.page, pageSize: data.pageSize, isLoading, reload }
}

// ── Single contrat (detail screen, lecture seule) ─────────────────────────────

export function useContrat(contratId: string) {
  const [contrat, setContrat] = useState<Contrat | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const c = await api.get<Contrat>(`/api/procurement/contrats/${contratId}`)
      setContrat(c)
      setIsLoading(false)
    } catch {
      setError('Contrat introuvable')
      setIsLoading(false)
    }
  }, [contratId])

  useEffect(() => { void reload() }, [reload])

  return { contrat, isLoading, error, reload }
}

// ── Demandes d'achat list ──────────────────────────────────────────────────────
// Naissent dans le PGI — l'app ne les crée pas, elle les découvre et leur attache un
// circuit de validation (cf. engagerDemandeAchat ci-dessous).

export interface DemandesAchatListParams {
  q?: string
  validationStatut?: ValidationStatut | 'NON_ENGAGEE' | ''
  page?: number
  pageSize?: number
}

export function useDemandesAchat(params: DemandesAchatListParams = {}) {
  const { q = '', validationStatut = '', page = 1, pageSize = 25 } = params
  const [data, setData] = useState<Page<DemandeAchat>>({ items: [], total: 0, page: 1, pageSize })
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    setIsLoading(true)
    try {
      const qs = new URLSearchParams()
      if (q) qs.set('q', q)
      if (validationStatut) qs.set('validationStatut', validationStatut)
      qs.set('page', String(page))
      qs.set('pageSize', String(pageSize))
      const result = await api.get<Page<DemandeAchat>>(`/api/procurement/demandes-achat?${qs}`)
      setData(result)
    } finally {
      setIsLoading(false)
    }
  }, [q, validationStatut, page, pageSize])

  useEffect(() => { void reload() }, [reload])

  return { demandesAchat: data.items, total: data.total, page: data.page, pageSize: data.pageSize, isLoading, reload }
}

// ── Single demande d'achat (detail screen) ────────────────────────────────────

export function useDemandeAchat(demandeAchatId: string) {
  const [demandeAchat, setDemandeAchat] = useState<DemandeAchat | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const d = await api.get<DemandeAchat>(`/api/procurement/demandes-achat/${demandeAchatId}`)
      setDemandeAchat(d)
      setIsLoading(false)
    } catch {
      setError("Demande d'achat introuvable")
      setIsLoading(false)
    }
  }, [demandeAchatId])

  useEffect(() => { void reload() }, [reload])

  // Engage la demande dans un circuit de validation (orgUnit + activité optionnelle) —
  // remplace l'ancienne création + soumission, la demande existe déjà côté PGI.
  const engagerDemandeAchat = useCallback(async (input: { orgUnitId: string; activiteId?: string | null }) => {
    const updated = await api.post<DemandeAchat>(`/api/procurement/demandes-achat/${demandeAchatId}/engager`, input)
    setDemandeAchat(updated)
    return updated
  }, [demandeAchatId])

  const updateDemandeAchat = useCallback(async (patch: { activiteId?: string | null }) => {
    const updated = await api.put<DemandeAchat>(`/api/procurement/demandes-achat/${demandeAchatId}`, patch)
    setDemandeAchat(updated)
    return updated
  }, [demandeAchatId])

  // Abandonne le circuit de validation (revient à "non engagée" — la demande reste
  // visible côté PGI, seule l'enveloppe workflow disparaît).
  const abandonnerEngagement = useCallback(async () => {
    await api.delete(`/api/procurement/demandes-achat/${demandeAchatId}`)
    await reload()
  }, [demandeAchatId, reload])

  const decideApprobation = useCallback(async (approbationId: string, decision: 'APPROUVEE' | 'REJETEE', commentaire?: string) => {
    const updated = await api.post<DemandeAchat>(`/api/procurement/commande-approbations/${approbationId}/decider`, { decision, commentaire })
    setDemandeAchat(updated)
    return updated
  }, [])

  return { demandeAchat, isLoading, error, reload, engagerDemandeAchat, updateDemandeAchat, abandonnerEngagement, decideApprobation }
}

// ── Commandes (rustine PGI, lecture + édition légère) ─────────────────────────

export function useCommandes() {
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const c = await api.get<Commande[]>('/api/procurement/commandes')
      setCommandes(c)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const updateCommande = useCallback(async (id: string, patch: Partial<{ numero: string; referencePgi: string | null; statut: CommandeStatut }>) => {
    await api.put(`/api/procurement/commandes/${id}`, patch)
    await reload()
  }, [reload])

  return { commandes, isLoading, reload, updateCommande }
}

// ── Activités list ────────────────────────────────────────────────────────────

export interface CreateActiviteInput {
  nom: string
  type?: TypeActivite
  description?: string | null
}

export interface UpdateActiviteInput {
  nom: string
  type: TypeActivite
  statut: ActiviteStatut
  meteo: Meteo
  description: string | null
  enjeux: boolean
  pmt: string | null
  planProduction: boolean
  schemaDirecteur: boolean
  hopexLien: string | null
  piloteEmail: string | null
  produitId: string | null
  departementId: string | null
  pole: string | null
  domaineMetier: string | null
  sousDomaineMetier: string | null
  capaciteMetier: string | null
  sousCapaciteMetier: string | null
  prioriteMetier: string | null
}

export function useActivites() {
  const [activites, setActivites] = useState<Activite[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get<Activite[]>('/api/procurement/activites')
      .then((a) => { setActivites(a); setIsLoading(false) })
      .catch(() => setIsLoading(false))
  }, [])

  const createActivite = useCallback(async (input: CreateActiviteInput) => {
    const activite = await api.post<Activite>('/api/procurement/activites', input)
    setActivites((prev) => [activite, ...prev])
    return activite
  }, [])

  const deleteActivite = useCallback(async (id: string) => {
    await api.delete(`/api/procurement/activites/${id}`)
    setActivites((prev) => prev.filter((a) => a.id !== id))
  }, [])

  return { activites, isLoading, createActivite, deleteActivite }
}

// ── Single activité (detail screen) ───────────────────────────────────────────

export function useActivite(activiteId: string) {
  const [activite, setActivite] = useState<Activite | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const a = await api.get<Activite>(`/api/procurement/activites/${activiteId}`)
      setActivite(a)
      setIsLoading(false)
    } catch {
      setError('Activité introuvable')
      setIsLoading(false)
    }
  }, [activiteId])

  useEffect(() => { void reload() }, [reload])

  const updateActivite = useCallback(async (patch: Partial<UpdateActiviteInput>) => {
    const updated = await api.put<Activite>(`/api/procurement/activites/${activiteId}`, patch)
    setActivite(updated)
    return updated
  }, [activiteId])

  const addGain = useCallback(async (input: { montant: number; typologie: string; commentaire?: string | null }) => {
    await api.post(`/api/procurement/activites/${activiteId}/gains`, input)
    await reload()
  }, [activiteId, reload])
  const updateGain = useCallback(async (gainId: string, patch: Partial<{ montant: number; typologie: string; commentaire: string | null }>) => {
    await api.put(`/api/procurement/activite-gains/${gainId}`, patch)
    await reload()
  }, [reload])
  const deleteGain = useCallback(async (gainId: string) => {
    await api.delete(`/api/procurement/activite-gains/${gainId}`)
    await reload()
  }, [reload])

  const addFaitMarquant = useCallback(async (input: { date: string; texte: string }) => {
    await api.post(`/api/procurement/activites/${activiteId}/faits-marquants`, input)
    await reload()
  }, [activiteId, reload])
  const deleteFaitMarquant = useCallback(async (faitId: string) => {
    await api.delete(`/api/procurement/activite-faits-marquants/${faitId}`)
    await reload()
  }, [reload])

  const addBudgetLigne = useCallback(async (input: {
    annee: number; type: TypeLigneBudget; montantMo?: number | null; montantHmo?: number | null
    utilisateurMetier?: string | null; priorite?: string | null; objetGestion?: string | null
    jalonPhase?: JalonType | null; contratId?: string | null
  }) => {
    await api.post(`/api/procurement/activites/${activiteId}/budget-lignes`, input)
    await reload()
  }, [activiteId, reload])
  const updateBudgetLigne = useCallback(async (ligneId: string, patch: Record<string, unknown>) => {
    await api.put(`/api/procurement/activite-budget-lignes/${ligneId}`, patch)
    await reload()
  }, [reload])
  const deleteBudgetLigne = useCallback(async (ligneId: string) => {
    await api.delete(`/api/procurement/activite-budget-lignes/${ligneId}`)
    await reload()
  }, [reload])

  const addJalon = useCallback(async (input: { type: JalonType; libelle?: string | null; datePrevue?: string | null; dateReelle?: string | null; decision?: string | null; commentaire?: string | null }) => {
    await api.post(`/api/procurement/activites/${activiteId}/jalons`, input)
    await reload()
  }, [activiteId, reload])
  const updateJalon = useCallback(async (jalonId: string, patch: Partial<{ libelle: string | null; datePrevue: string | null; dateReelle: string | null; decision: string | null; commentaire: string | null }>) => {
    await api.put(`/api/procurement/activite-jalons/${jalonId}`, patch)
    await reload()
  }, [reload])
  const deleteJalon = useCallback(async (jalonId: string) => {
    await api.delete(`/api/procurement/activite-jalons/${jalonId}`)
    await reload()
  }, [reload])

  const addRisque = useCallback(async (input: {
    titre: string; description?: string | null; categorie?: string | null; probabilite: number; impact: number
    planMitigation?: string | null; responsable?: string | null; jiraLien?: string | null
  }) => {
    await api.post(`/api/procurement/activites/${activiteId}/risques`, input)
    await reload()
  }, [activiteId, reload])
  const updateRisque = useCallback(async (risqueId: string, patch: Record<string, unknown>) => {
    await api.put(`/api/procurement/activite-risques/${risqueId}`, patch)
    await reload()
  }, [reload])
  const deleteRisque = useCallback(async (risqueId: string) => {
    await api.delete(`/api/procurement/activite-risques/${risqueId}`)
    await reload()
  }, [reload])

  return {
    activite, isLoading, error, reload, updateActivite,
    addGain, updateGain, deleteGain,
    addFaitMarquant, deleteFaitMarquant,
    addBudgetLigne, updateBudgetLigne, deleteBudgetLigne,
    addJalon, updateJalon, deleteJalon,
    addRisque, updateRisque, deleteRisque,
  }
}

// ── Produits (rustine, liste de référence + agrégation) ───────────────────────

export function useProduits() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const p = await api.get<Produit[]>('/api/procurement/produits')
      setProduits(p)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const createProduit = useCallback(async (nom: string) => {
    const produit = await api.post<Produit>('/api/procurement/produits', { nom })
    await reload()
    return produit
  }, [reload])

  const deleteProduit = useCallback(async (id: string) => {
    await api.delete(`/api/procurement/produits/${id}`)
    await reload()
  }, [reload])

  return { produits, isLoading, reload, createProduit, deleteProduit }
}

export function useProduit(produitId: string) {
  const [produit, setProduit] = useState<ProduitDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const p = await api.get<ProduitDetail>(`/api/procurement/produits/${produitId}`)
      setProduit(p)
      setIsLoading(false)
    } catch {
      setError('Produit introuvable')
      setIsLoading(false)
    }
  }, [produitId])

  useEffect(() => { void reload() }, [reload])

  return { produit, isLoading, error, reload }
}

// ── Organigramme (structure lue depuis le LDAP externe, seuil éditable côté app) ──

export function useOrgUnits() {
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const units = await api.get<OrgUnit[]>('/api/procurement/org-units')
      setOrgUnits(units)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  // Seul le seuil d'approbation est éditable — la structure vient du LDAP externe.
  const updateOrgUnit = useCallback(async (id: string, patch: { seuilApprobation: number | null }) => {
    await api.put(`/api/procurement/org-units/${id}`, patch)
    await reload()
  }, [reload])

  return { orgUnits, isLoading, error, reload, updateOrgUnit }
}

// ── Profils achat ─────────────────────────────────────────────────────────────

export function useMesProfils() {
  const [profils, setProfils] = useState<ProfilAchat[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get<ProfilAchat[]>('/api/procurement/profils')
      .then((p) => { setProfils(p); setIsLoading(false) })
      .catch(() => setIsLoading(false))
  }, [])

  const has = useCallback((role: RoleAchat, orgUnitId?: string) => (
    profils.some((p) => p.role === role && (orgUnitId === undefined || p.orgUnitId === orgUnitId))
  ), [profils])

  return { profils, isLoading, has }
}

export interface ProfilAchatWithUser extends ProfilAchat {
  user?: { id: string; name: string; email: string }
}

// userId: profils d'un utilisateur précis ; 'all' (admin) : tous les profils, tous utilisateurs confondus.
export function useProfils(userId?: string | 'all') {
  const [profils, setProfils] = useState<ProfilAchatWithUser[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const query = userId === 'all' ? '?all=true' : userId ? `?userId=${userId}` : ''
      const p = await api.get<ProfilAchatWithUser[]>(`/api/procurement/profils${query}`)
      setProfils(p)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => { void reload() }, [reload])

  const addProfil = useCallback(async (input: { email: string; role: RoleAchat; orgUnitId?: string | null }) => {
    await api.post('/api/procurement/profils', input)
    await reload()
  }, [reload])

  const deleteProfil = useCallback(async (id: string) => {
    await api.delete(`/api/procurement/profils/${id}`)
    await reload()
  }, [reload])

  return { profils, isLoading, reload, addProfil, deleteProfil }
}

// ── Mes validations en attente ────────────────────────────────────────────────

export interface MaValidation {
  id: string
  demandeAchatId: string
  order: number
  type: 'HIERARCHIE' | 'FINANCE'
  orgUnitId: string | null
  orgUnit?: OrgUnit | null
  montant: number
  demandeAchat: { id: string; numero: string; objet: string; dateDemande: string }
}

export function useMesValidations() {
  const [validations, setValidations] = useState<MaValidation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const v = await api.get<MaValidation[]>('/api/procurement/mes-validations')
      setValidations(v)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const decide = useCallback(async (approbationId: string, decision: 'APPROUVEE' | 'REJETEE', commentaire?: string) => {
    await api.post(`/api/procurement/commande-approbations/${approbationId}/decider`, { decision, commentaire })
    await reload()
  }, [reload])

  return { validations, isLoading, reload, decide }
}

// ── Délégations de validation ─────────────────────────────────────────────────

export function useDelegations() {
  const [delegations, setDelegations] = useState<DelegationValidation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const d = await api.get<DelegationValidation[]>('/api/procurement/delegations')
      setDelegations(d)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const createDelegation = useCallback(async (input: {
    delegueEmail: string
    orgUnitId: string
    pouvoir: PouvoirDelegation
    pourcentage?: number | null
    seuilEuro?: number | null
    dateDebut?: string | null
    dateFin?: string | null
  }) => {
    await api.post('/api/procurement/delegations', input)
    await reload()
  }, [reload])

  const revokeDelegation = useCallback(async (id: string) => {
    await api.delete(`/api/procurement/delegations/${id}`)
    await reload()
  }, [reload])

  return { delegations, isLoading, reload, createDelegation, revokeDelegation }
}
