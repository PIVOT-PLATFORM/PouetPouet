import { randomUUID } from 'node:crypto'

export type ContratStatut = 'ACTIF' | 'EXPIRE' | 'RESILIE'
export type CommandeStatut = 'EN_COURS' | 'LIVREE' | 'SOLDEE'

export interface ContratLot {
  id: string
  contratId: string
  numero: string
  intitule: string
  titulaire: string | null
  montantMax: number | null
  order: number
}

export interface Contrat {
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
  lots: ContratLot[]
}

export interface DemandeAchatLot {
  id: string
  demandeAchatId: string
  contratLotId: string | null
  intitule: string
  titulaire: string | null
  montant: number
  order: number
}

export interface DemandeAchat {
  id: string
  numero: string
  objet: string
  dateDemande: string
  notes: string | null
  createdAt: string
  lots: DemandeAchatLot[]
}

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

// ── Génération aléatoire ────────────────────────────────────────────────────────

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}
function randomDateBetween(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

const COMPANY_ROOTS = ['Atlas', 'Nova', 'Orion', 'Vertex', 'Lumen', 'Axion', 'Delta', 'Mercure', 'Helio', 'Quanta', 'Strato', 'Cobalt', 'Argon', 'Nexus', 'Pixel', 'Cedar', 'Falcon', 'Granite', 'Indigo', 'Jasper', 'Meridian', 'Nimbus', 'Onyx', 'Photon', 'Quartz', 'Solstice', 'Titan']
const COMPANY_SUFFIXES = ['SAS', 'SARL', 'SA', 'Services', 'Solutions', 'Consulting', 'Technologies', 'Group']
function randomCompany(): string {
  return `${pick(COMPANY_ROOTS)} ${pick(COMPANY_SUFFIXES)}`
}

const CONTRAT_OBJETS = [
  'Accord-cadre maintenance applicative', 'Marché de prestations intellectuelles', 'Marché infrastructure cloud',
  'Accord-cadre développement logiciel', 'Marché de fourniture de matériel informatique', "Marché d'assistance technique",
  'Accord-cadre conseil en architecture', 'Marché de tierce maintenance applicative', 'Marché de services télécom',
  'Accord-cadre formation', 'Marché de prestations de sécurité', "Marché d'hébergement", "Marché d'intégration de progiciel",
  'Accord-cadre support utilisateur', 'Marché de prestations data',
]
const CONTRAT_DOMAINES = ['RH', 'Finance', 'SI', 'Logistique', 'Production', 'Relation Client', 'Achats']
const LOT_INTITULES = ['Développement applicatif', 'Tierce maintenance applicative', 'Support niveau 2', 'Conseil et expertise', 'Hébergement', 'Formation', 'Sécurité', 'Intégration', 'Exploitation', 'Recette']
const CONTRAT_STATUTS_WEIGHTED: ContratStatut[] = ['ACTIF', 'ACTIF', 'ACTIF', 'ACTIF', 'ACTIF', 'ACTIF', 'EXPIRE', 'EXPIRE', 'EXPIRE', 'RESILIE']
const DA_OBJETS = ['Prestation de développement', 'Achat de licences', 'Renouvellement support', 'Audit technique', 'Formation équipe', 'Matériel poste de travail', 'Prestation de conseil', 'Abonnement SaaS', 'Maintenance évolutive', 'Étude de cadrage']

export function generateContrats(count: number): Contrat[] {
  const contrats: Contrat[] = []
  for (let i = 0; i < count; i++) {
    const seq = i + 1
    const dateDebut = randomDateBetween(new Date('2022-01-01'), new Date('2026-06-01'))
    const dateFin = Math.random() < 0.7 ? new Date(dateDebut.getTime() + randomInt(365, 1095) * 86_400_000) : null
    const contratId = randomUUID()
    const lotCount = randomInt(1, 3)
    const lots: ContratLot[] = Array.from({ length: lotCount }, (_, li) => ({
      id: randomUUID(),
      contratId,
      numero: `Lot ${li + 1}`,
      intitule: pick(LOT_INTITULES),
      titulaire: randomCompany(),
      montantMax: randomInt(5, 500) * 1000,
      order: li,
    }))
    const now = new Date().toISOString()
    contrats.push({
      id: contratId,
      numero: `MP-2026-${String(seq).padStart(5, '0')}`,
      objet: `${pick(CONTRAT_OBJETS)} (${pick(CONTRAT_DOMAINES)})`,
      dateDebut: dateDebut.toISOString(),
      dateFin: dateFin ? dateFin.toISOString() : null,
      statut: pick(CONTRAT_STATUTS_WEIGHTED),
      notes: null,
      referencePgi: Math.random() < 0.6 ? `PGI-CTR-${randomInt(10000, 99999)}` : null,
      createdAt: now,
      updatedAt: now,
      lots,
    })
  }
  return contrats
}

// 90% des lots restent "courants" (1-50k€), 10% sont volontairement plus gros
// (50-250k€) pour qu'une partie des demandes d'achat dépasse les seuils
// d'approbation des niveaux les plus hauts (Direction/COMEX) — sinon aucune demande
// ne remonterait jamais jusqu'en haut du circuit de validation.
function randomMontant(): number {
  return Math.random() < 0.9 ? randomInt(1, 50) * 1000 : randomInt(50, 250) * 1000
}

export function generateDemandesAchat(count: number, contrats: Contrat[]): DemandeAchat[] {
  const allLots = contrats.flatMap((c) => c.lots)
  const demandes: DemandeAchat[] = []
  for (let i = 0; i < count; i++) {
    const seq = i + 1
    const lotCount = randomInt(1, 2)
    const useContratLot = Math.random() < 0.7 && allLots.length > 0
    const demandeAchatId = randomUUID()
    const lots: DemandeAchatLot[] = Array.from({ length: lotCount }, (_, li) => {
      if (useContratLot) {
        const ref = pick(allLots)
        return {
          id: randomUUID(), demandeAchatId, contratLotId: ref.id,
          intitule: pick(DA_OBJETS), titulaire: null, montant: randomMontant(), order: li,
        }
      }
      return {
        id: randomUUID(), demandeAchatId, contratLotId: null,
        intitule: pick(DA_OBJETS), titulaire: randomCompany(), montant: randomMontant(), order: li,
      }
    })
    demandes.push({
      id: demandeAchatId,
      numero: `DA-2026-${String(seq).padStart(4, '0')}`,
      objet: pick(DA_OBJETS),
      dateDemande: randomDateBetween(new Date('2026-01-01'), new Date('2026-06-30')).toISOString(),
      notes: null,
      createdAt: new Date().toISOString(),
      lots,
    })
  }
  return demandes
}
