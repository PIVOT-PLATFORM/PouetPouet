import { randomUUID } from 'node:crypto'
import { createCollection, createMockService, paginate } from '@pouetpouet/mock-service-kit'
import { generateContrats, generateDemandesAchat } from './data.js'
import type { Contrat, ContratLot, DemandeAchat, Commande } from './data.js'

const PORT = Number(process.env.PORT ?? 4100)

const seedContrats = generateContrats(2000)
const contrats = createCollection<Contrat>(() => seedContrats)
const demandesAchat = createCollection<DemandeAchat>(() => generateDemandesAchat(300, seedContrats))
// Les commandes naissent uniquement quand l'app valide une demande d'achat (POST
// /commandes) — aucune commande pré-seedée, contrairement à contrats/demandes-achat.
const commandes = createCollection<Commande>(() => [])

function allContratLots(): ContratLot[] {
  return contrats.list().flatMap((c) => c.lots)
}

// Consommation par lot calculée ici (pas côté app) : ce pod a déjà Contrat et
// DemandeAchat dans le même process, pas besoin d'un aller-retour réseau pour fusionner
// les deux. Exclut volontairement aucun statut de demande (le workflow de validation —
// engagée/validée/rejetée — vit côté app, pas ici) : tout enregistrement compte comme
// une consommation tant que ce pod n'en sait pas plus.
function withConsommation(contrat: Contrat) {
  const daLots = demandesAchat.list().flatMap((d) => d.lots)
  return {
    ...contrat,
    lots: contrat.lots.map((lot) => {
      const consomme = daLots.filter((l) => l.contratLotId === lot.id).reduce((s, l) => s + l.montant, 0)
      return { ...lot, consomme, restant: lot.montantMax != null ? lot.montantMax - consomme : null }
    }),
  }
}

const service = createMockService({ name: 'pgi-mock', port: PORT })
service.registerCollection('contrats', contrats)
service.registerCollection('demandesAchat', demandesAchat)
service.registerCollection('commandes', commandes)

const { app } = service

app.get('/contrats', async (request) => {
  const query = request.query as { q?: string; statut?: string; page?: string; pageSize?: string }
  const page = paginate(contrats.list(), {
    q: query.q,
    searchFields: ['numero', 'objet'],
    filters: { statut: query.statut },
    page: query.page ? parseInt(query.page, 10) : undefined,
    pageSize: query.pageSize ? parseInt(query.pageSize, 10) : undefined,
  })
  return { ...page, items: page.items.map(withConsommation) }
})

app.get('/contrats/recherche', async (request) => {
  const query = request.query as { q?: string }
  const q = query.q?.trim().toLowerCase()
  const matches = q
    ? contrats.find((c) => c.numero.toLowerCase().includes(q) || c.objet.toLowerCase().includes(q))
    : contrats.list()
  return matches.slice(0, 15).map((c) => ({ id: c.id, numero: c.numero, objet: c.objet }))
})

app.get('/contrats/:id', async (request, reply) => {
  const { id } = request.params as { id: string }
  const contrat = contrats.get(id)
  if (!contrat) return reply.status(404).send({ error: 'Contrat introuvable' })
  return withConsommation(contrat)
})

app.get('/contrat-lots/:id', async (request, reply) => {
  const { id } = request.params as { id: string }
  const lot = allContratLots().find((l) => l.id === id)
  if (!lot) return reply.status(404).send({ error: 'Lot introuvable' })
  return lot
})

app.get('/demandes-achat', async (request) => {
  const query = request.query as { q?: string; page?: string; pageSize?: string }
  return paginate(demandesAchat.list(), {
    q: query.q,
    searchFields: ['numero', 'objet'],
    page: query.page ? parseInt(query.page, 10) : undefined,
    pageSize: query.pageSize ? parseInt(query.pageSize, 10) : undefined,
  })
})

app.get('/demandes-achat/:id', async (request, reply) => {
  const { id } = request.params as { id: string }
  const da = demandesAchat.get(id)
  if (!da) return reply.status(404).send({ error: "Demande d'achat introuvable" })
  // Enrichit chaque lot avec son lot de contrat (numero/titulaire) et le contrat parent
  // (id/numero/objet) — affichage seulement, ce pod ne fait aucune mutation ici.
  const lotsById = new Map(allContratLots().map((l) => [l.id, l]))
  const contratsById = new Map(contrats.list().map((c) => [c.id, c]))
  return {
    ...da,
    lots: da.lots.map((lot) => {
      const contratLot = lot.contratLotId ? lotsById.get(lot.contratLotId) : undefined
      if (!contratLot) return { ...lot, contratLot: null }
      const contrat = contratsById.get(contratLot.contratId)
      return {
        ...lot,
        contratLot: { ...contratLot, contrat: contrat ? { id: contrat.id, numero: contrat.numero, objet: contrat.objet } : null },
      }
    }),
  }
})

app.get('/commandes', async () => commandes.list())

app.get('/commandes/:id', async (request, reply) => {
  const { id } = request.params as { id: string }
  const commande = commandes.get(id)
  if (!commande) return reply.status(404).send({ error: 'Commande introuvable' })
  return commande
})

app.get('/commandes/by-demande-achat/:demandeAchatId', async (request, reply) => {
  const { demandeAchatId } = request.params as { demandeAchatId: string }
  const commande = commandes.find((c) => c.demandeAchatId === demandeAchatId)[0]
  if (!commande) return reply.status(404).send({ error: 'Aucune commande pour cette demande' })
  return commande
})

app.post('/commandes', async (request, reply) => {
  const body = request.body as { demandeAchatId: string; numero?: string; referencePgi?: string | null }
  if (!body.demandeAchatId) return reply.status(400).send({ error: 'demandeAchatId requis' })
  const now = new Date().toISOString()
  const commande: Commande = {
    id: randomUUID(),
    demandeAchatId: body.demandeAchatId,
    numero: body.numero?.trim() || `CMD-${Math.floor(100000 + Math.random() * 899999)}`,
    referencePgi: body.referencePgi ?? null,
    statut: 'EN_COURS',
    dateEmission: now,
    createdAt: now,
    updatedAt: now,
  }
  commandes.create(commande)
  return reply.status(201).send(commande)
})

app.put('/commandes/:id', async (request, reply) => {
  const { id } = request.params as { id: string }
  const body = request.body as Partial<{ numero: string; referencePgi: string | null; statut: Commande['statut'] }>
  const updated = commandes.update(id, {
    ...(body.numero !== undefined ? { numero: body.numero } : {}),
    ...(body.referencePgi !== undefined ? { referencePgi: body.referencePgi } : {}),
    ...(body.statut !== undefined ? { statut: body.statut } : {}),
    updatedAt: new Date().toISOString(),
  })
  if (!updated) return reply.status(404).send({ error: 'Commande introuvable' })
  return updated
})

service.start().catch((err) => {
  console.error('[pgi-mock] échec démarrage', err)
  process.exit(1)
})
