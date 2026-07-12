import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { prisma } from '../../lib/prisma.js'

// ──────────────────────────────────────────────────────────────────────────────
// Tests d'intégration du backend procurement (DB réelle pouetpouet_test).
//
// Les pods externes PGI/LDAP sont mockés (pas de vrai service) : chaque test contrôle
// les demandes d'achat / la structure organisationnelle / les commandes via des maps
// en mémoire (cf. `h` ci-dessous). Le reste (workflow, circuit d'approbation, profils,
// délégations, OrgUnitConfig) vit dans la vraie base et exerce le vrai code applicatif.
//
// Couverture priorisée sur les correctifs C1 (decider) et C2 (engager), R1 (commande
// non créée), et la logique cœur (buildApprobationChain / canDecide*).
// ──────────────────────────────────────────────────────────────────────────────

type LdapUnit = {
  id: string
  nom: string
  niveau: 'EQUIPE' | 'DEPARTEMENT' | 'DIVISION' | 'DIRECTION' | 'COMEX'
  parentId: string | null
  managerEmail: string | null
  managerName: string | null
}

const h = vi.hoisted(() => {
  const ldapUnits = new Map<string, LdapUnit>()
  const demandes = new Map<string, unknown>()
  const commandes = new Map<string, unknown>() // clé = demandeAchatId
  const createCommande = vi.fn()
  return { ldapUnits, demandes, commandes, createCommande }
})

vi.mock('../../lib/ldap-client.js', () => ({
  ldapClient: {
    getOrgUnit: async (id: string) => h.ldapUnits.get(id) ?? null,
    listOrgUnits: async () => [...h.ldapUnits.values()],
  },
}))

vi.mock('../../lib/pgi-client.js', () => ({
  pgiClient: {
    getDemandeAchat: async (id: string) => h.demandes.get(id) ?? null,
    getCommandeByDemandeAchatId: async (id: string) => h.commandes.get(id) ?? null,
    createCommande: h.createCommande,
    // Non sollicités par les chemins testés — présents pour un mock complet.
    listContrats: async () => ({ items: [], total: 0, page: 1, pageSize: 25 }),
    getContrat: async () => null,
    searchContrats: async () => [],
    getContratLot: async () => null,
    listDemandesAchat: async () => ({ items: [], total: 0, page: 1, pageSize: 25 }),
    listCommandes: async () => [],
    getCommande: async () => null,
    updateCommande: async () => ({}),
  },
}))

// Import APRÈS les vi.mock (hoistés) pour que le code sous test reçoive les mocks.
const { procurementRoutes } = await import('./procurement.routes.js')
const { buildApprobationChain, canDecideHierarchie, canDecideFinance } = await import('./validation.js')

const SUFFIX = '@procurement.int.test'
const ROOT = 'proc-int-root'
const PARENT = 'proc-int-parent'
const GP = 'proc-int-gp'

function setDemande(externalId: string, montant: number) {
  h.demandes.set(externalId, {
    id: externalId,
    numero: `DA-${externalId}`,
    objet: 'Objet test',
    dateDemande: new Date().toISOString(),
    notes: null,
    createdAt: new Date().toISOString(),
    lots: [{ id: `${externalId}-l1`, demandeAchatId: externalId, contratLotId: null, intitule: 'Lot', titulaire: null, montant, order: 0 }],
  })
}

async function ensureConfig(id: string, ownerId: string, seuilApprobation: number | null = null) {
  await prisma.orgUnitConfig.upsert({
    where: { id },
    create: { id, ownerId, seuilApprobation },
    update: { seuilApprobation },
  })
}

describe('procurement — intégration', () => {
  let app: FastifyInstance
  let decider: Awaited<ReturnType<typeof createTestUser>> // VALIDEUR@ROOT + FINANCE
  let chef: Awaited<ReturnType<typeof createTestUser>>     // CHEF_DE_PROJET@ROOT
  let manager: Awaited<ReturnType<typeof createTestUser>>  // manager LDAP de ROOT

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    // Nettoyage défensif des OrgUnitConfig d'un run précédent avorté (cascade sur
    // workflows/approbations/profils/délégations qui les référencent).
    await prisma.orgUnitConfig.deleteMany({ where: { id: { in: [ROOT, PARENT, GP] } } })

    app = await buildTestApp([{ plugin: procurementRoutes, prefix: '/api/procurement' }])
    decider = await createTestUser(app, `decider${SUFFIX}`)
    chef = await createTestUser(app, `chef${SUFFIX}`)
    manager = await createTestUser(app, `manager${SUFFIX}`)

    h.ldapUnits.set(ROOT, { id: ROOT, nom: 'Équipe Test', niveau: 'EQUIPE', parentId: PARENT, managerEmail: manager.user.email, managerName: 'Manager Test' })
    h.ldapUnits.set(PARENT, { id: PARENT, nom: 'Département Test', niveau: 'DEPARTEMENT', parentId: GP, managerEmail: null, managerName: null })
    h.ldapUnits.set(GP, { id: GP, nom: 'Direction Test', niveau: 'DIRECTION', parentId: null, managerEmail: null, managerName: null })

    await ensureConfig(ROOT, decider.user.id, null)
    await prisma.profilAchat.createMany({
      data: [
        { userId: decider.user.id, role: 'VALIDEUR', orgUnitId: ROOT },
        { userId: decider.user.id, role: 'FINANCE', orgUnitId: null },
        { userId: chef.user.id, role: 'CHEF_DE_PROJET', orgUnitId: ROOT },
      ],
    })
  })

  afterAll(async () => {
    await prisma.orgUnitConfig.deleteMany({ where: { id: { in: [ROOT, PARENT, GP] } } })
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  beforeEach(() => {
    h.demandes.clear()
    h.commandes.clear()
    h.createCommande.mockReset()
    h.createCommande.mockImplementation(async ({ demandeAchatId }: { demandeAchatId: string }) => {
      const c = { id: `cmd-${demandeAchatId}`, demandeAchatId, numero: `CMD-${demandeAchatId}`, referencePgi: null, statut: 'EN_COURS', dateEmission: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      h.commandes.set(demandeAchatId, c)
      return c
    })
  })

  // Seed d'un workflow + circuit d'approbation directement en base (indépendant de
  // `engager`), pour contrôler la forme exacte de la chaîne dans les tests de `decider`.
  async function seedWorkflow(externalId: string, steps: { type: 'HIERARCHIE' | 'FINANCE'; orgUnitId: string | null; statut?: 'EN_ATTENTE' | 'APPROUVEE' | 'REJETEE' }[]) {
    const wf = await prisma.demandeAchatWorkflow.create({
      data: { demandeAchatExternalId: externalId, ownerId: decider.user.id, orgUnitId: ROOT, validationStatut: 'EN_VALIDATION' },
    })
    await prisma.commandeApprobation.createMany({
      data: steps.map((s, order) => ({ demandeAchatWorkflowId: wf.id, order, type: s.type, orgUnitId: s.orgUnitId, statut: s.statut ?? 'EN_ATTENTE' })),
    })
    const approbations = await prisma.commandeApprobation.findMany({ where: { demandeAchatWorkflowId: wf.id }, orderBy: { order: 'asc' } })
    return { wf, approbations }
  }

  function decide(approbationId: string, decision: 'APPROUVEE' | 'REJETEE', token: string) {
    return app.inject({
      method: 'POST',
      url: `/api/procurement/commande-approbations/${approbationId}/decider`,
      headers: { authorization: `Bearer ${token}` },
      payload: { decision },
    })
  }

  // ── C2 : engager ──────────────────────────────────────────────────────────────

  describe('engager (C2)', () => {
    it('crée le workflow + le circuit (chemin nominal, sans remontée)', async () => {
      await ensureConfig(ROOT, decider.user.id, null) // pas de seuil → pas de remontée
      const ext = 'ENG-ok'
      setDemande(ext, 500)
      const res = await app.inject({
        method: 'POST', url: `/api/procurement/demandes-achat/${ext}/engager`,
        headers: { authorization: `Bearer ${chef.token}` }, payload: { orgUnitId: ROOT },
      })
      expect(res.statusCode).toBe(201)
      const wf = await prisma.demandeAchatWorkflow.findUnique({ where: { demandeAchatExternalId: ext }, include: { approbations: true } })
      expect(wf).not.toBeNull()
      expect(wf!.approbations.map((a) => a.type)).toEqual(['HIERARCHIE', 'FINANCE'])
      expect(h.createCommande).not.toHaveBeenCalled()
    })

    it('bloque le ré-engagement d\'une DA déjà engagée (400)', async () => {
      const ext = 'ENG-dup'
      setDemande(ext, 100)
      await seedWorkflow(ext, [{ type: 'FINANCE', orgUnitId: null }])
      const res = await app.inject({
        method: 'POST', url: `/api/procurement/demandes-achat/${ext}/engager`,
        headers: { authorization: `Bearer ${chef.token}` }, payload: { orgUnitId: ROOT },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/déjà engagée/i)
    })

    it('rollback complet quand createMany échoue → aucun workflow orphelin', async () => {
      // Déclencheur : la chaîne remonte au niveau PARENT (montant > seuil ROOT), mais
      // PARENT n'a pas d'OrgUnitConfig → la FK de CommandeApprobation.orgUnitId casse
      // le createMany. C2 (transaction) doit alors annuler aussi le workflow.create.
      // NB : ce déclencheur exploite un bug latent (cf. résumé, bug #2).
      await ensureConfig(ROOT, decider.user.id, 100)
      await prisma.orgUnitConfig.deleteMany({ where: { id: { in: [PARENT, GP] } } })
      const ext = 'ENG-rollback'
      setDemande(ext, 1000) // > seuil ROOT (100) → chaîne = [ROOT, PARENT, FINANCE]
      const res = await app.inject({
        method: 'POST', url: `/api/procurement/demandes-achat/${ext}/engager`,
        headers: { authorization: `Bearer ${chef.token}` }, payload: { orgUnitId: ROOT },
      })
      expect(res.statusCode).toBe(500) // FK violation, non catchée → 500
      // Le point clé de C2 : le workflow n'a PAS été persisté (rollback).
      const wf = await prisma.demandeAchatWorkflow.findUnique({ where: { demandeAchatExternalId: ext } })
      expect(wf).toBeNull()
    })
  })

  // ── C1 : decider ──────────────────────────────────────────────────────────────

  describe('decider (C1)', () => {
    it('approuve toute la chaîne → workflow VALIDEE + 1 seule commande', async () => {
      const ext = 'DEC-nominal'
      setDemande(ext, 500)
      const { approbations } = await seedWorkflow(ext, [
        { type: 'HIERARCHIE', orgUnitId: ROOT },
        { type: 'FINANCE', orgUnitId: null },
      ])

      const r0 = await decide(approbations[0].id, 'APPROUVEE', decider.token)
      expect(r0.statusCode).toBe(200)
      let wf = await prisma.demandeAchatWorkflow.findUnique({ where: { demandeAchatExternalId: ext } })
      expect(wf!.validationStatut).toBe('EN_VALIDATION') // étape intermédiaire
      expect(h.createCommande).not.toHaveBeenCalled()

      const r1 = await decide(approbations[1].id, 'APPROUVEE', decider.token)
      expect(r1.statusCode).toBe(200)
      wf = await prisma.demandeAchatWorkflow.findUnique({ where: { demandeAchatExternalId: ext } })
      expect(wf!.validationStatut).toBe('VALIDEE')
      expect(h.createCommande).toHaveBeenCalledTimes(1)
      expect(h.commandes.get(ext)).toBeTruthy()
    })

    it('rejette une étape → workflow REJETEE, pas de commande', async () => {
      const ext = 'DEC-reject'
      setDemande(ext, 500)
      const { approbations } = await seedWorkflow(ext, [{ type: 'HIERARCHIE', orgUnitId: ROOT }])
      const r = await decide(approbations[0].id, 'REJETEE', decider.token)
      expect(r.statusCode).toBe(200)
      const wf = await prisma.demandeAchatWorkflow.findUnique({ where: { demandeAchatExternalId: ext } })
      expect(wf!.validationStatut).toBe('REJETEE')
      const step = await prisma.commandeApprobation.findUnique({ where: { id: approbations[0].id } })
      expect(step!.statut).toBe('REJETEE')
      expect(h.createCommande).not.toHaveBeenCalled()
    })

    it('refuse de décider une étape non courante (400)', async () => {
      const ext = 'DEC-noncurrent'
      setDemande(ext, 500)
      const { approbations } = await seedWorkflow(ext, [
        { type: 'HIERARCHIE', orgUnitId: ROOT },
        { type: 'FINANCE', orgUnitId: null },
      ])
      // On tente de décider l'étape FINANCE alors que l'étape HIERARCHIE est encore ouverte.
      const r = await decide(approbations[1].id, 'APPROUVEE', decider.token)
      expect(r.statusCode).toBe(400)
      expect(r.json().error).toMatch(/étape courante/i)
    })

    it('décision concurrente de l\'étape finale → une seule réussite et une seule commande', async () => {
      const ext = 'DEC-race'
      setDemande(ext, 500)
      // Étape finale unique : deux décisions simultanées se disputent la réservation.
      const { approbations } = await seedWorkflow(ext, [{ type: 'FINANCE', orgUnitId: null }])
      const stepId = approbations[0].id

      const [a, b] = await Promise.all([
        decide(stepId, 'APPROUVEE', decider.token),
        decide(stepId, 'APPROUVEE', decider.token),
      ])
      const codes = [a.statusCode, b.statusCode]
      // Exactement une réussite ; l'autre requête est rejetée — soit par la pré-vérif
      // « étape courante » (400) si le gagnant a déjà commité, soit par la réservation
      // atomique updateMany (409) si les deux se chevauchent dans la transaction. Lequel
      // gagne dépend de l'entrelacement ; l'invariant C1, lui, est déterministe.
      expect(codes.filter((c) => c === 200)).toHaveLength(1)
      expect(codes.filter((c) => c === 400 || c === 409)).toHaveLength(1)

      // Cœur de C1 : réservation atomique + idempotence → une seule commande, un seul
      // appel PGI, même sous deux décisions concurrentes.
      expect(h.createCommande).toHaveBeenCalledTimes(1)
      expect([...h.commandes.keys()]).toEqual([ext])
      const wf = await prisma.demandeAchatWorkflow.findUnique({ where: { demandeAchatExternalId: ext } })
      expect(wf!.validationStatut).toBe('VALIDEE')
    })
  })

  // ── R1 : commande non créée après validation ────────────────────────────────────

  describe('R1 — échec de createCommande après VALIDEE', () => {
    it('workflow VALIDEE mais sans commande, et l\'étape n\'est plus rejouable (comportement actuel)', async () => {
      const ext = 'R1-nocommande'
      setDemande(ext, 500)
      const { approbations } = await seedWorkflow(ext, [{ type: 'FINANCE', orgUnitId: null }])
      h.createCommande.mockImplementationOnce(async () => { throw new Error('PGI indisponible') })

      const r = await decide(approbations[0].id, 'APPROUVEE', decider.token)
      expect(r.statusCode).toBe(500) // createCommande a levé, non catché

      // La transaction d'état a bien commité : workflow VALIDEE, mais aucune commande.
      const wf = await prisma.demandeAchatWorkflow.findUnique({ where: { demandeAchatExternalId: ext } })
      expect(wf!.validationStatut).toBe('VALIDEE')
      expect(h.commandes.get(ext)).toBeUndefined()

      // Rejouer la décision ne recrée pas la commande : plus aucune étape EN_ATTENTE.
      const retry = await decide(approbations[0].id, 'APPROUVEE', decider.token)
      expect(retry.statusCode).toBe(400)
      expect(retry.json().error).toMatch(/étape courante/i)
      // → état "VALIDEE sans commande" non récupérable par l'API (R1, à traiter).
    })
  })

  // ── Bug découvert : une étape reste décidable après rejet du workflow ──────────────

  describe('bug découvert — décision après rejet', () => {
    it('BUG: décider les étapes restantes d\'un workflow REJETEE peut le repasser VALIDEE + créer une commande', async () => {
      const ext = 'BUG-rejected-then-approved'
      setDemande(ext, 500)
      const { approbations } = await seedWorkflow(ext, [
        { type: 'HIERARCHIE', orgUnitId: ROOT },
        { type: 'FINANCE', orgUnitId: null },
      ])
      // Rejet de la 1re étape → workflow REJETEE, mais l'étape FINANCE reste EN_ATTENTE.
      await decide(approbations[0].id, 'REJETEE', decider.token)
      let wf = await prisma.demandeAchatWorkflow.findUnique({ where: { demandeAchatExternalId: ext } })
      expect(wf!.validationStatut).toBe('REJETEE')

      // L'étape FINANCE reste décidable et bascule le workflow rejeté en VALIDEE.
      const r = await decide(approbations[1].id, 'APPROUVEE', decider.token)
      expect(r.statusCode).toBe(200)
      wf = await prisma.demandeAchatWorkflow.findUnique({ where: { demandeAchatExternalId: ext } })
      expect(wf!.validationStatut).toBe('VALIDEE') // ⚠ le rejet a été « effacé »
      expect(h.createCommande).toHaveBeenCalledTimes(1) // ⚠ commande créée sur un workflow rejeté
    })
  })

  // ── Logique cœur ───────────────────────────────────────────────────────────────

  describe('buildApprobationChain', () => {
    it('montant sous le seuil du niveau de rattachement → pas de remontée', async () => {
      await ensureConfig(ROOT, decider.user.id, 1000)
      const chain = await buildApprobationChain(ROOT, 500)
      expect(chain).toEqual([
        { type: 'HIERARCHIE', orgUnitId: ROOT },
        { type: 'FINANCE', orgUnitId: null },
      ])
    })

    it('seuil non défini → pas de remontée', async () => {
      await ensureConfig(ROOT, decider.user.id, null)
      const chain = await buildApprobationChain(ROOT, 999999)
      expect(chain.map((s) => s.orgUnitId)).toEqual([ROOT, null])
    })

    it('montant au-dessus du seuil → remonte au parent', async () => {
      await ensureConfig(ROOT, decider.user.id, 100)
      await ensureConfig(PARENT, decider.user.id, 100000)
      const chain = await buildApprobationChain(ROOT, 500)
      expect(chain).toEqual([
        { type: 'HIERARCHIE', orgUnitId: ROOT },
        { type: 'HIERARCHIE', orgUnitId: PARENT },
        { type: 'FINANCE', orgUnitId: null },
      ])
    })

    it('dépassement en cascade → remonte de deux niveaux puis s\'arrête (parent sans seuil)', async () => {
      await ensureConfig(ROOT, decider.user.id, 100)
      await ensureConfig(PARENT, decider.user.id, 200)
      await prisma.orgUnitConfig.deleteMany({ where: { id: GP } }) // GP sans seuil → stop
      const chain = await buildApprobationChain(ROOT, 1000)
      expect(chain.map((s) => s.orgUnitId)).toEqual([ROOT, PARENT, GP, null])
    })
  })

  describe('canDecideFinance', () => {
    it('vrai avec un ProfilAchat FINANCE, faux sinon', async () => {
      const withFin = await createTestUser(app, `fin${SUFFIX}`)
      const without = await createTestUser(app, `nofin${SUFFIX}`)
      await prisma.profilAchat.create({ data: { userId: withFin.user.id, role: 'FINANCE', orgUnitId: null } })
      expect(await canDecideFinance(withFin.user.id)).toBe(true)
      expect(await canDecideFinance(without.user.id)).toBe(false)
    })
  })

  describe('canDecideHierarchie', () => {
    beforeEach(async () => {
      await ensureConfig(ROOT, decider.user.id, 1000) // seuil de référence pour le calcul du plafond %
    })

    it('le manager LDAP du périmètre est autorisé', async () => {
      expect(await canDecideHierarchie(manager.user.id, ROOT, 999999)).toBe(true)
    })

    it('un utilisateur sans lien n\'est pas autorisé', async () => {
      const nobody = await createTestUser(app, `nobody${SUFFIX}`)
      expect(await canDecideHierarchie(nobody.user.id, ROOT, 100)).toBe(false)
    })

    it('un ProfilAchat VALIDEUR sur le périmètre est autorisé', async () => {
      const v = await createTestUser(app, `valideur${SUFFIX}`)
      await prisma.profilAchat.create({ data: { userId: v.user.id, role: 'VALIDEUR', orgUnitId: ROOT } })
      expect(await canDecideHierarchie(v.user.id, ROOT, 100)).toBe(true)
    })

    it('délégation COMPLET active → autorisé', async () => {
      const d = await createTestUser(app, `delc${SUFFIX}`)
      await prisma.delegationValidation.create({ data: { delegantId: manager.user.id, delegueId: d.user.id, orgUnitId: ROOT, pouvoir: 'COMPLET', statut: 'ACTIVE' } })
      expect(await canDecideHierarchie(d.user.id, ROOT, 999999)).toBe(true)
    })

    it('délégation PARTIEL par seuil € : autorisé sous le plafond, refusé au-dessus', async () => {
      const d = await createTestUser(app, `delp${SUFFIX}`)
      await prisma.delegationValidation.create({ data: { delegantId: manager.user.id, delegueId: d.user.id, orgUnitId: ROOT, pouvoir: 'PARTIEL', seuilEuro: 500, statut: 'ACTIVE' } })
      expect(await canDecideHierarchie(d.user.id, ROOT, 400)).toBe(true)
      expect(await canDecideHierarchie(d.user.id, ROOT, 600)).toBe(false)
    })

    it('délégation PARTIEL par pourcentage : plafond = seuil du périmètre × pourcentage', async () => {
      const d = await createTestUser(app, `delpct${SUFFIX}`)
      // seuil ROOT = 1000, pourcentage 0.5 → plafond 500.
      await prisma.delegationValidation.create({ data: { delegantId: manager.user.id, delegueId: d.user.id, orgUnitId: ROOT, pouvoir: 'PARTIEL', pourcentage: 0.5, statut: 'ACTIVE' } })
      expect(await canDecideHierarchie(d.user.id, ROOT, 500)).toBe(true)
      expect(await canDecideHierarchie(d.user.id, ROOT, 501)).toBe(false)
    })

    it('délégation expirée (dateFin passée) → non autorisé', async () => {
      const d = await createTestUser(app, `delexp${SUFFIX}`)
      await prisma.delegationValidation.create({ data: { delegantId: manager.user.id, delegueId: d.user.id, orgUnitId: ROOT, pouvoir: 'COMPLET', statut: 'ACTIVE', dateFin: new Date(Date.now() - 24 * 3600 * 1000) } })
      expect(await canDecideHierarchie(d.user.id, ROOT, 100)).toBe(false)
    })

    it('délégation pas encore active (dateDebut future) → non autorisé', async () => {
      const d = await createTestUser(app, `delfut${SUFFIX}`)
      await prisma.delegationValidation.create({ data: { delegantId: manager.user.id, delegueId: d.user.id, orgUnitId: ROOT, pouvoir: 'COMPLET', statut: 'ACTIVE', dateDebut: new Date(Date.now() + 24 * 3600 * 1000) } })
      expect(await canDecideHierarchie(d.user.id, ROOT, 100)).toBe(false)
    })

    it('délégation révoquée (statut REVOQUEE) → non autorisé', async () => {
      const d = await createTestUser(app, `delrev${SUFFIX}`)
      await prisma.delegationValidation.create({ data: { delegantId: manager.user.id, delegueId: d.user.id, orgUnitId: ROOT, pouvoir: 'COMPLET', statut: 'REVOQUEE' } })
      expect(await canDecideHierarchie(d.user.id, ROOT, 100)).toBe(false)
    })
  })
})
