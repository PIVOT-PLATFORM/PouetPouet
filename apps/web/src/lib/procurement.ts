// ──────────────────────────────────────────────────────────────────────────────
// Commande publique — types et helpers d'affichage (pas de calcul côté client :
// le cumul/consommation par lot de contrat et le total d'une commande sont
// renvoyés déjà calculés par l'API).
// ──────────────────────────────────────────────────────────────────────────────

export type ContratStatut = 'ACTIF' | 'EXPIRE' | 'RESILIE'
export type CommandeStatut = 'EN_COURS' | 'LIVREE' | 'SOLDEE'
// Pas de BROUILLON : une demande d'achat existe déjà côté PGI avant que l'app la
// connaisse — l'absence d'enveloppe workflow (validationStatut: null) est elle-même
// l'état "non engagée", pas un statut stocké.
export type ValidationStatut = 'EN_VALIDATION' | 'VALIDEE' | 'REJETEE'
export type OrgUnitNiveau = 'EQUIPE' | 'DEPARTEMENT' | 'DIVISION' | 'DIRECTION' | 'COMEX'
export type RoleAchat = 'CHEF_DE_PROJET' | 'VALIDEUR' | 'FINANCE' | 'CONTRACT_MANAGER'
export type PouvoirDelegation = 'COMPLET' | 'PARTIEL'
export type StatutDelegation = 'ACTIVE' | 'REVOQUEE'
export type ApprobationType = 'HIERARCHIE' | 'FINANCE'
export type StatutApprobation = 'EN_ATTENTE' | 'APPROUVEE' | 'REJETEE'
export type TypeActivite = 'REFONTE' | 'RUN' | 'NOUVEAU' | 'EVOLUTION' | 'MAINTENANCE' | 'DECOMMISSIONNEMENT' | 'AUTRE'
export type ActiviteStatut = 'ACTIF' | 'CLOTURE' | 'SUSPENDU'
export type Meteo = 'VERT' | 'ORANGE' | 'ROUGE' | 'GRIS'
export type TypeLigneBudget = 'OPEX' | 'CAPEX' | 'APCO'
export type JalonType =
  | 'A_ARRIVEE' | 'B_ETUDE' | 'C_REALISATION' | 'D_DECLARATION_GAINS' | 'E_DECOMMISSIONNEMENT'
  | 'REVUE_PROJET' | 'J7_MEP' | 'J3_RECETTE' | 'COMITE_TECHNIQUE' | 'COMITE_ARCHITECTURE' | 'COMITE_CADRAGE' | 'AUTRE'
export type RisqueStatut = 'OUVERT' | 'EN_COURS' | 'CLOS'

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ContratRecherche {
  id: string
  numero: string
  objet: string
}

export interface ContratLot {
  id: string
  contratId: string
  numero: string
  intitule: string
  titulaire: string | null
  montantMax: number | null
  order: number
  consomme: number
  restant: number | null
}

// Contrats : données externes (pod pgi-mock, type SAP) — plus de propriété/rôle, lecture
// seule dans l'app (cf. apps/api/src/lib/pgi-client.ts).
export interface Contrat {
  id: string
  numero: string
  objet: string
  dateDebut: string
  dateFin: string | null
  statut: ContratStatut
  notes: string | null
  referencePgi: string | null
  lots: ContratLot[]
  createdAt: string
  updatedAt: string
}

export interface DemandeAchatLotContratRef {
  id: string
  numero: string
  objet: string
}

export interface DemandeAchatLot {
  id: string
  demandeAchatId: string
  contratLotId: string | null
  intitule: string
  titulaire: string | null
  montant: number
  order: number
  contratLot: (ContratLot & { contrat: DemandeAchatLotContratRef }) | null
}

export interface OrgUnitRef {
  id: string
  nom: string
  niveau: OrgUnitNiveau
}

// La structure (nom/niveau/hiérarchie/manager officiel) vient du pod ldap-mock externe
// — seul seuilApprobation est propre à l'app (OrgUnitConfig), fusionné par l'API.
export interface OrgUnit extends OrgUnitRef {
  parentId: string | null
  managerEmail: string | null
  managerName: string | null
  seuilApprobation: number | null
  createdAt?: string
  updatedAt?: string
}

export interface ProfilAchat {
  id: string
  userId: string
  role: RoleAchat
  orgUnitId: string | null
  orgUnit?: OrgUnitRef | null
  createdAt: string
}

export interface DelegationValidation {
  id: string
  delegantId: string
  delegueId: string
  orgUnitId: string
  pouvoir: PouvoirDelegation
  pourcentage: number | null
  seuilEuro: number | null
  dateDebut: string | null
  dateFin: string | null
  statut: StatutDelegation
  orgUnit?: OrgUnitRef
  delegant?: { id: string; name: string; email: string }
  delegue?: { id: string; name: string; email: string }
  createdAt: string
}

export interface CommandeApprobation {
  id: string
  demandeAchatId: string
  order: number
  type: ApprobationType
  orgUnitId: string | null
  statut: StatutApprobation
  validateurId: string | null
  decidedAt: string | null
  commentaire: string | null
  orgUnit?: OrgUnitRef | null
  validateur?: { id: string; name: string } | null
  createdAt: string
}

export interface Produit {
  id: string
  ownerId: string
  nom: string
  createdAt: string
  _count?: { activites: number }
}

export interface ProduitRisqueAgrege {
  id: string
  activiteId: string
  activiteNom: string
  titre: string
  description: string | null
  categorie: string | null
  probabilite: number
  impact: number
  criticite: number
  planMitigation: string | null
  responsable: string | null
  jiraLien: string | null
  statut: RisqueStatut
  dateIdentification: string
  dateRevue: string | null
}

export interface ProduitDetail extends Produit {
  activites: { id: string; nom: string; statut: ActiviteStatut; meteo: Meteo; type: TypeActivite }[]
  gainsTotal: number
  gainsParTypologie: Record<string, number>
  risques: ProduitRisqueAgrege[]
  budgetParAnneeType: { annee: number; type: TypeLigneBudget; montantMo: number; montantHmo: number }[]
}

export interface ActiviteGain {
  id: string
  activiteId: string
  montant: number
  typologie: string
  commentaire: string | null
  order: number
}

export interface ActiviteFaitMarquant {
  id: string
  activiteId: string
  date: string
  texte: string
  createdAt: string
}

export interface ActiviteBudgetLigne {
  id: string
  activiteId: string
  annee: number
  type: TypeLigneBudget
  montantMo: number | null
  montantHmo: number | null
  utilisateurMetier: string | null
  priorite: string | null
  objetGestion: string | null
  jalonPhase: JalonType | null
  contratId: string | null
  contrat?: { id: string; numero: string; objet: string } | null
}

export interface ActiviteJalon {
  id: string
  activiteId: string
  type: JalonType
  libelle: string | null
  datePrevue: string | null
  dateReelle: string | null
  decision: string | null
  commentaire: string | null
  order: number
  obligatoire: boolean
}

export interface ActiviteRisque {
  id: string
  activiteId: string
  titre: string
  description: string | null
  categorie: string | null
  probabilite: number
  impact: number
  planMitigation: string | null
  responsable: string | null
  jiraLien: string | null
  statut: RisqueStatut
  dateIdentification: string
  dateRevue: string | null
}

export interface Activite {
  id: string
  ownerId: string
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
  piloteId: string | null
  produitId: string | null
  departementId: string | null
  pole: string | null
  domaineMetier: string | null
  sousDomaineMetier: string | null
  capaciteMetier: string | null
  sousCapaciteMetier: string | null
  prioriteMetier: string | null
  pilote?: { id: string; name: string; email: string } | null
  produit?: { id: string; nom: string } | null
  departement?: OrgUnitRef | null
  gains: ActiviteGain[]
  faitsMarquants: ActiviteFaitMarquant[]
  budgetLignes: ActiviteBudgetLigne[]
  jalons: ActiviteJalon[]
  risques: ActiviteRisque[]
  demandesAchat: { id: string; numero: string; objet: string; validationStatut: ValidationStatut }[]
  role?: 'OWNER' | 'EDITOR' | 'VIEWER'
  createdAt: string
  updatedAt: string
}

// Rustine PGI : reflet minimal du bon de commande émis côté ERP, créé automatiquement
// à la validation finale d'une demande d'achat.
export interface Commande {
  id: string
  demandeAchatId: string
  numero: string
  referencePgi: string | null
  statut: CommandeStatut
  dateEmission: string
  createdAt: string
  updatedAt: string
}

// Demandes d'achat : naissent dans le PGI (numero/objet/lots/montants), pas dans l'app.
// validationStatut null = "non engagée" (existe côté PGI, pas encore prise en charge par
// un circuit de validation) — cf. POST /demandes-achat/:externalId/engager.
export interface DemandeAchat {
  id: string
  numero: string
  objet: string
  dateDemande: string
  notes: string | null
  lots: DemandeAchatLot[]
  total: number
  validationStatut: ValidationStatut | null
  orgUnit: OrgUnitRef | null
  activiteId: string | null
  role: 'OWNER' | 'EDITOR' | 'VIEWER' | null
  activite?: { id: string; nom: string } | null
  approbations?: CommandeApprobation[]
  commande?: Commande | null
  createdAt: string
}

// ── Labels ──────────────────────────────────────────────────────────────────

export const CONTRAT_STATUT_LABELS: Record<ContratStatut, { label: string; cls: string }> = {
  ACTIF: { label: 'Actif', cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' },
  EXPIRE: { label: 'Expiré', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  RESILIE: { label: 'Résilié', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
}

export const COMMANDE_STATUT_LABELS: Record<CommandeStatut, { label: string; cls: string }> = {
  EN_COURS: { label: 'En cours', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
  LIVREE: { label: 'Livrée', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
  SOLDEE: { label: 'Soldée', cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' },
}

export const ACTIVITE_STATUT_LABELS: Record<ActiviteStatut, { label: string; cls: string }> = {
  ACTIF: { label: 'Actif', cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' },
  CLOTURE: { label: 'Clôturé', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  SUSPENDU: { label: 'Suspendu', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
}

export const TYPE_ACTIVITE_LABELS: Record<TypeActivite, string> = {
  REFONTE: 'Refonte',
  RUN: 'Run',
  NOUVEAU: 'Nouveau',
  EVOLUTION: 'Évolution',
  MAINTENANCE: 'Maintenance',
  DECOMMISSIONNEMENT: 'Décommissionnement',
  AUTRE: 'Autre',
}

export const METEO_LABELS: Record<Meteo, { label: string; emoji: string; cls: string }> = {
  VERT: { label: 'Vert', emoji: '🟢', cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' },
  ORANGE: { label: 'Orange', emoji: '🟠', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
  ROUGE: { label: 'Rouge', emoji: '🔴', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
  GRIS: { label: 'Non démarré', emoji: '⚪', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
}

export const TYPE_LIGNE_BUDGET_LABELS: Record<TypeLigneBudget, string> = {
  OPEX: 'OPEX',
  CAPEX: 'CAPEX',
  APCO: 'APCO',
}

export const JALON_TYPE_LABELS: Record<JalonType, string> = {
  A_ARRIVEE: 'A — Arrivée',
  B_ETUDE: 'B — Étude',
  C_REALISATION: 'C — Réalisation',
  D_DECLARATION_GAINS: 'D — Déclaration des gains',
  E_DECOMMISSIONNEMENT: 'E — Décommissionnement',
  REVUE_PROJET: 'Revue de projet',
  J7_MEP: 'J7 — Mise en production',
  J3_RECETTE: 'J3 — Recette',
  COMITE_TECHNIQUE: 'Comité technique',
  COMITE_ARCHITECTURE: 'Comité architecture',
  COMITE_CADRAGE: 'Comité de cadrage',
  AUTRE: 'Autre',
}

export const RISQUE_STATUT_LABELS: Record<RisqueStatut, { label: string; cls: string }> = {
  OUVERT: { label: 'Ouvert', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
  EN_COURS: { label: 'En cours de traitement', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
  CLOS: { label: 'Clos', cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' },
}

// Criticité = probabilité × impact (1-5 chacun, donc 1-25).
export function criticiteClass(criticite: number): string {
  if (criticite >= 15) return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
  if (criticite >= 8) return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
  return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
}

export const VALIDATION_STATUT_LABELS: Record<ValidationStatut, { label: string; cls: string }> = {
  EN_VALIDATION: { label: 'En validation', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
  VALIDEE: { label: 'Validée', cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' },
  REJETEE: { label: 'Rejetée', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
}

// "Non engagée" n'est pas un ValidationStatut stocké (validationStatut === null côté
// DemandeAchat) — label/style séparé pour l'affichage.
export const NON_ENGAGEE_LABEL = { label: 'Non engagée', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' }

export const ORG_UNIT_NIVEAU_LABELS: Record<OrgUnitNiveau, string> = {
  EQUIPE: 'Équipe',
  DEPARTEMENT: 'Département',
  DIVISION: 'Division',
  DIRECTION: 'Direction',
  COMEX: 'COMEX',
}

export const ROLE_ACHAT_LABELS: Record<RoleAchat, string> = {
  CHEF_DE_PROJET: 'Chef de projet',
  VALIDEUR: 'Valideur',
  FINANCE: 'Finance',
  CONTRACT_MANAGER: 'Contract manager',
}

export const STATUT_APPROBATION_LABELS: Record<StatutApprobation, { label: string; cls: string }> = {
  EN_ATTENTE: { label: 'En attente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
  APPROUVEE: { label: 'Approuvée', cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' },
  REJETEE: { label: 'Rejetée', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
}

export function formatMontant(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function toDateInput(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}
