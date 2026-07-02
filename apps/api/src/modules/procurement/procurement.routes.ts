import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { resolveRole, sharedResourceIds, deleteResourceShares, canManage } from '../../lib/module-share.js'
import { isAdminEmail } from '../../lib/feature-flags.js'
import { buildApprobationChain, canDecideHierarchie, canDecideFinance, hasRole, isTitulaireValidation } from './validation.js'
import { pgiClient } from '../../lib/pgi-client.js'
import { ldapClient } from '../../lib/ldap-client.js'
import type { LdapOrgUnit } from '../../lib/ldap-client.js'
import { ensureOrgUnitConfig } from './org-unit-config.js'

// Modèle d'accès du module : tout interne (= tout utilisateur authentifié) voit tout en
// lecture (contrats/demandes d'achat/commandes sont d'ailleurs des données PGI externes,
// donc déjà sans notion de propriété). Seuls le créateur, ses délégués (ModuleShare
// EDITOR) et les administrateurs peuvent modifier l'enveloppe workflow d'une demande.
function canEdit(role: 'OWNER' | 'EDITOR' | 'VIEWER' | null, email: string | undefined): boolean {
  return canManage(role) || isAdminEmail(email)
}

const DEMANDE_ACHAT_MODULE = 'procurement-demande-achat'
const ACTIVITE_MODULE = 'procurement-activite'

async function orgUnitRef(orgUnitId: string | null | undefined): Promise<{ id: string; nom: string; niveau: LdapOrgUnit['niveau'] } | null> {
  if (!orgUnitId) return null
  const unit = await ldapClient.getOrgUnit(orgUnitId)
  return unit ? { id: unit.id, nom: unit.nom, niveau: unit.niveau } : null
}

// Fusionne une demande d'achat PGI avec son enveloppe workflow locale (si elle existe)
// — l'absence d'enveloppe = demande "non engagée" (existe côté PGI, pas encore prise
// en charge par un circuit de validation).
async function mergeWorkflow(
  da: { id: string; lots: { montant: number }[] },
  workflow: (Awaited<ReturnType<typeof prisma.demandeAchatWorkflow.findFirst>>) | null,
  userId: string,
) {
  const total = da.lots.reduce((s, l) => s + l.montant, 0)
  if (!workflow) {
    return { ...da, total, validationStatut: null as string | null, orgUnit: null, activiteId: null, role: null as string | null }
  }
  const role = workflow.ownerId === userId ? 'OWNER' : ((await resolveRole(DEMANDE_ACHAT_MODULE, workflow.id, userId, workflow.ownerId)) ?? 'VIEWER')
  return {
    ...da,
    total,
    validationStatut: workflow.validationStatut,
    orgUnit: await orgUnitRef(workflow.orgUnitId),
    activiteId: workflow.activiteId,
    role,
  }
}

export const procurementRoutes: FastifyPluginAsync = async (app) => {
  // ── Contrats (lecture seule — proxy+cache vers le pod PGI externe) ────────────────
  // Le cycle de vie d'un contrat n'est plus géré par l'app : il vit dans apps/pgi-mock
  // (cf. pgiClient). Plus de création/édition/suppression côté app.

  app.get('/contrats', { preHandler: [app.authenticate] }, async (request) => {
    const query = request.query as { q?: string; statut?: string; page?: string; pageSize?: string }
    return pgiClient.listContrats({
      q: query.q,
      statut: query.statut,
      page: query.page ? parseInt(query.page, 10) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : undefined,
    })
  })

  app.get('/contrats/recherche', { preHandler: [app.authenticate] }, async (request) => {
    const query = request.query as { q?: string }
    return pgiClient.searchContrats(query.q ?? '')
  })

  app.get('/contrats/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const contrat = await pgiClient.getContrat(id)
    if (!contrat) return reply.status(404).send({ error: 'Contrat introuvable' })
    return contrat
  })

  // ── Demandes d'achat ────────────────────────────────────────────────────────────
  // Les demandes d'achat naissent dans le PGI (numero/objet/lots/montants), pas dans
  // l'app — l'app les découvre et leur attache une enveloppe workflow (orgUnit/
  // activité/circuit de validation) une fois "engagées" (cf. POST .../engager).

  app.get('/demandes-achat', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }
    const query = request.query as { q?: string; validationStatut?: string; page?: string; pageSize?: string }
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '25', 10) || 25))

    if (query.validationStatut) {
      // Le statut vit dans l'enveloppe workflow locale : impossible de paginer côté PGI
      // pour ce filtre — on récupère tout, fusionne, filtre, puis pagine en mémoire.
      const all = await pgiClient.listDemandesAchat({ q: query.q, page: 1, pageSize: 1000 })
      const workflows = await prisma.demandeAchatWorkflow.findMany({ where: { demandeAchatExternalId: { in: all.items.map((d) => d.id) } } })
      const workflowByExternalId = new Map(workflows.map((w) => [w.demandeAchatExternalId, w]))
      const merged = await Promise.all(all.items.map((d) => mergeWorkflow(d, workflowByExternalId.get(d.id) ?? null, userId)))
      const filtered = query.validationStatut === 'NON_ENGAGEE'
        ? merged.filter((d) => !d.validationStatut)
        : merged.filter((d) => d.validationStatut === query.validationStatut)
      const start = (page - 1) * pageSize
      return { items: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize }
    }

    const pgiPage = await pgiClient.listDemandesAchat({ q: query.q, page, pageSize })
    const workflows = await prisma.demandeAchatWorkflow.findMany({ where: { demandeAchatExternalId: { in: pgiPage.items.map((d) => d.id) } } })
    const workflowByExternalId = new Map(workflows.map((w) => [w.demandeAchatExternalId, w]))
    const items = await Promise.all(pgiPage.items.map((d) => mergeWorkflow(d, workflowByExternalId.get(d.id) ?? null, userId)))
    return { items, total: pgiPage.total, page: pgiPage.page, pageSize: pgiPage.pageSize }
  })

  app.get('/demandes-achat/:externalId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { externalId } = request.params as { externalId: string }
    const { id: userId } = request.user as { id: string }
    const da = await pgiClient.getDemandeAchat(externalId)
    if (!da) return reply.status(404).send({ error: "Demande d'achat introuvable" })
    const workflow = await prisma.demandeAchatWorkflow.findUnique({ where: { demandeAchatExternalId: externalId } })
    const merged = await mergeWorkflow(da, workflow, userId)
    const commande = await pgiClient.getCommandeByDemandeAchatId(externalId)
    if (!workflow) return { ...merged, activite: null, approbations: [], commande }

    const [activite, approbations] = await Promise.all([
      workflow.activiteId ? prisma.activite.findUnique({ where: { id: workflow.activiteId }, select: { id: true, nom: true } }) : null,
      prisma.commandeApprobation.findMany({
        where: { demandeAchatWorkflowId: workflow.id },
        orderBy: { order: 'asc' },
        include: { validateur: { select: { id: true, name: true } } },
      }),
    ])
    const approbationsWithOrgUnit = await Promise.all(approbations.map(async (a) => ({ ...a, orgUnit: await orgUnitRef(a.orgUnitId) })))
    return { ...merged, activite, approbations: approbationsWithOrgUnit, commande }
  })

  // Engage une demande d'achat PGI dans un circuit de validation (remplace l'ancienne
  // création + soumission — la demande existe déjà côté PGI avant cet appel).
  app.post('/demandes-achat/:externalId/engager', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { externalId } = request.params as { externalId: string }
    const { id: userId } = request.user as { id: string }
    const body = request.body as { orgUnitId: string; activiteId?: string | null }
    if (!body.orgUnitId) return reply.status(400).send({ error: 'Équipe de rattachement requise' })

    const existing = await prisma.demandeAchatWorkflow.findUnique({ where: { demandeAchatExternalId: externalId } })
    if (existing) return reply.status(400).send({ error: 'Cette demande est déjà engagée dans un circuit de validation' })

    const da = await pgiClient.getDemandeAchat(externalId)
    if (!da) return reply.status(404).send({ error: "Demande d'achat introuvable" })
    if (da.lots.length === 0) return reply.status(400).send({ error: 'Cette demande ne contient aucun lot' })

    const orgUnit = await ldapClient.getOrgUnit(body.orgUnitId)
    if (!orgUnit) return reply.status(400).send({ error: 'Périmètre invalide' })
    if (!(await hasRole(userId, 'CHEF_DE_PROJET', body.orgUnitId))) {
      return reply.status(403).send({ error: "Vous n'avez pas le profil chef de projet sur ce périmètre" })
    }
    if (body.activiteId) {
      const activite = await prisma.activite.findUnique({ where: { id: body.activiteId } })
      if (!activite || !(await resolveRole(ACTIVITE_MODULE, body.activiteId, userId, activite.ownerId))) {
        return reply.status(400).send({ error: 'Activité invalide' })
      }
    }

    await ensureOrgUnitConfig(body.orgUnitId, userId)
    const montant = da.lots.reduce((s, l) => s + l.montant, 0)
    const chain = await buildApprobationChain(body.orgUnitId, montant)

    const workflow = await prisma.demandeAchatWorkflow.create({
      data: { demandeAchatExternalId: externalId, ownerId: userId, orgUnitId: body.orgUnitId, activiteId: body.activiteId || null },
    })
    await prisma.commandeApprobation.createMany({
      data: chain.map((step, order) => ({ demandeAchatWorkflowId: workflow.id, order, type: step.type, orgUnitId: step.orgUnitId })),
    })

    const merged = await mergeWorkflow(da, await prisma.demandeAchatWorkflow.findUnique({ where: { id: workflow.id } }), userId)
    return reply.status(201).send(merged)
  })

  app.put('/demandes-achat/:externalId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { externalId } = request.params as { externalId: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    const workflow = await prisma.demandeAchatWorkflow.findUnique({ where: { demandeAchatExternalId: externalId } })
    if (!workflow) return reply.status(404).send({ error: "Cette demande n'est pas engagée dans un circuit" })
    const role = await resolveRole(DEMANDE_ACHAT_MODULE, workflow.id, userId, workflow.ownerId)
    if (!canEdit(role, email)) return reply.status(403).send({ error: "Vous n'êtes pas autorisé à modifier cette demande" })

    const body = request.body as Partial<{ activiteId: string | null }>
    if (body.activiteId) {
      const activite = await prisma.activite.findUnique({ where: { id: body.activiteId } })
      if (!activite || !(await resolveRole(ACTIVITE_MODULE, body.activiteId, userId, activite.ownerId))) {
        return reply.status(400).send({ error: 'Activité invalide' })
      }
    }
    const updated = await prisma.demandeAchatWorkflow.update({
      where: { id: workflow.id },
      data: { activiteId: body.activiteId !== undefined ? (body.activiteId || null) : undefined },
    })
    const da = await pgiClient.getDemandeAchat(externalId)
    return mergeWorkflow(da!, updated, userId)
  })

  // Abandonne le circuit de validation (revient à "non engagée" — la demande reste
  // visible côté PGI, seule l'enveloppe workflow et son circuit d'approbation disparaissent).
  app.delete('/demandes-achat/:externalId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { externalId } = request.params as { externalId: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    const workflow = await prisma.demandeAchatWorkflow.findUnique({ where: { demandeAchatExternalId: externalId } })
    if (!workflow || (workflow.ownerId !== userId && !isAdminEmail(email))) {
      return reply.status(404).send({ error: "Cette demande n'est pas engagée dans un circuit" })
    }
    await prisma.demandeAchatWorkflow.delete({ where: { id: workflow.id } })
    await deleteResourceShares(DEMANDE_ACHAT_MODULE, workflow.id)
    return reply.status(204).send()
  })

  // ── Circuit de validation ───────────────────────────────────────────────────────

  app.get('/mes-validations', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }
    const pending = await prisma.commandeApprobation.findMany({
      where: { statut: 'EN_ATTENTE' },
      orderBy: { order: 'asc' },
      include: { demandeAchatWorkflow: true },
    })
    const currentByWorkflow = new Map<string, (typeof pending)[number]>()
    for (const step of pending) {
      if (!currentByWorkflow.has(step.demandeAchatWorkflowId)) currentByWorkflow.set(step.demandeAchatWorkflowId, step)
    }
    const results = []
    for (const step of currentByWorkflow.values()) {
      const da = await pgiClient.getDemandeAchat(step.demandeAchatWorkflow.demandeAchatExternalId)
      if (!da) continue
      const montant = da.lots.reduce((s, l) => s + l.montant, 0)
      const authorized = step.type === 'FINANCE'
        ? await canDecideFinance(userId)
        : step.orgUnitId
          ? await canDecideHierarchie(userId, step.orgUnitId, montant)
          : false
      if (authorized) {
        results.push({
          id: step.id, demandeAchatId: da.id, order: step.order, type: step.type, orgUnitId: step.orgUnitId, montant,
          orgUnit: await orgUnitRef(step.orgUnitId),
          demandeAchat: { id: da.id, numero: da.numero, objet: da.objet, dateDemande: da.dateDemande },
        })
      }
    }
    return results
  })

  app.post('/commande-approbations/:approbationId/decider', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { approbationId } = request.params as { approbationId: string }
    const { id: userId } = request.user as { id: string }
    const body = request.body as { decision: 'APPROUVEE' | 'REJETEE'; commentaire?: string }
    if (body.decision !== 'APPROUVEE' && body.decision !== 'REJETEE') {
      return reply.status(400).send({ error: 'Décision invalide' })
    }

    const step = await prisma.commandeApprobation.findUnique({ where: { id: approbationId } })
    if (!step) return reply.status(404).send({ error: 'Étape introuvable' })

    const current = await prisma.commandeApprobation.findFirst({
      where: { demandeAchatWorkflowId: step.demandeAchatWorkflowId, statut: 'EN_ATTENTE' },
      orderBy: { order: 'asc' },
    })
    if (!current || current.id !== step.id) {
      return reply.status(400).send({ error: "Ce n'est pas l'étape courante du circuit" })
    }

    const workflow = await prisma.demandeAchatWorkflow.findUnique({ where: { id: step.demandeAchatWorkflowId } })
    if (!workflow) return reply.status(404).send({ error: 'Demande introuvable' })
    const da = await pgiClient.getDemandeAchat(workflow.demandeAchatExternalId)
    if (!da) return reply.status(404).send({ error: "Demande d'achat introuvable" })
    const montant = da.lots.reduce((s, l) => s + l.montant, 0)

    const authorized = step.type === 'FINANCE'
      ? await canDecideFinance(userId)
      : step.orgUnitId
        ? await canDecideHierarchie(userId, step.orgUnitId, montant)
        : false
    if (!authorized) return reply.status(403).send({ error: "Vous n'êtes pas autorisé à décider cette étape" })

    await prisma.commandeApprobation.update({
      where: { id: approbationId },
      data: { statut: body.decision, validateurId: userId, decidedAt: new Date(), commentaire: body.commentaire?.trim() || null },
    })

    if (body.decision === 'REJETEE') {
      await prisma.demandeAchatWorkflow.update({ where: { id: workflow.id }, data: { validationStatut: 'REJETEE' } })
    } else {
      const remaining = await prisma.commandeApprobation.count({ where: { demandeAchatWorkflowId: workflow.id, statut: 'EN_ATTENTE' } })
      if (remaining === 0) {
        // Dernière étape (Finance) approuvée : la DA est validée et la commande
        // (rustine PGI, pod pgi-mock) est créée automatiquement.
        await prisma.demandeAchatWorkflow.update({ where: { id: workflow.id }, data: { validationStatut: 'VALIDEE' } })
        await pgiClient.createCommande({ demandeAchatId: workflow.demandeAchatExternalId })
      }
    }

    const updatedWorkflow = await prisma.demandeAchatWorkflow.findUnique({ where: { id: workflow.id } })
    return mergeWorkflow(da, updatedWorkflow, userId)
  })

  // ── Commandes (rustine PGI — proxy vers le pod externe) ───────────────────────────
  // Pas de création/suppression manuelle : la commande naît automatiquement à la
  // validation finale (cf. ci-dessus) et suit le cycle de vie de sa demande d'achat.

  app.get('/commandes', { preHandler: [app.authenticate] }, async () => pgiClient.listCommandes())

  app.put('/commandes/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    const commande = await pgiClient.getCommande(id)
    if (!commande) return reply.status(404).send({ error: 'Commande introuvable' })
    const workflow = await prisma.demandeAchatWorkflow.findUnique({ where: { demandeAchatExternalId: commande.demandeAchatId } })
    if (!workflow) return reply.status(404).send({ error: 'Commande introuvable' })
    const role = await resolveRole(DEMANDE_ACHAT_MODULE, workflow.id, userId, workflow.ownerId)
    if (!canEdit(role, email)) return reply.status(403).send({ error: "Vous n'êtes pas autorisé à modifier cette commande" })

    const body = request.body as Partial<{ numero: string; referencePgi: string | null; statut: 'EN_COURS' | 'LIVREE' | 'SOLDEE' }>
    return pgiClient.updateCommande(id, body)
  })

  // ── Organigramme (structure LDAP externe + seuils d'approbation locaux) ───────────

  app.get('/org-units', { preHandler: [app.authenticate] }, async () => {
    const [units, configs] = await Promise.all([ldapClient.listOrgUnits(), prisma.orgUnitConfig.findMany()])
    const configById = new Map(configs.map((c) => [c.id, c]))
    return units.map((u) => ({ ...u, seuilApprobation: configById.get(u.id)?.seuilApprobation ?? null }))
  })

  // Seul le seuil d'approbation est éditable côté app — la structure (nom/niveau/
  // hiérarchie/manager) vient du LDAP externe, en lecture seule.
  app.put('/org-units/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: adminId, email } = request.user as { id: string; email: string }
    if (!isAdminEmail(email)) return reply.status(403).send({ error: 'Réservé aux administrateurs' })
    const { id } = request.params as { id: string }
    const unit = await ldapClient.getOrgUnit(id)
    if (!unit) return reply.status(404).send({ error: 'Périmètre introuvable' })
    const body = request.body as { seuilApprobation?: number | null }
    await ensureOrgUnitConfig(id, adminId)
    const updated = await prisma.orgUnitConfig.update({
      where: { id },
      data: { seuilApprobation: body.seuilApprobation !== undefined ? body.seuilApprobation : undefined },
    })
    return { ...unit, seuilApprobation: updated.seuilApprobation }
  })

  // ── Profils achat ────────────────────────────────────────────────────────────────

  app.get('/profils', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const query = request.query as { userId?: string; all?: string }
    const rows = query.all === 'true' && isAdminEmail(email)
      ? await prisma.profilAchat.findMany({
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        })
      : await prisma.profilAchat.findMany({ where: { userId: query.userId || userId } })
    return Promise.all(rows.map(async (p) => ({ ...p, orgUnit: await orgUnitRef(p.orgUnitId) })))
  })

  app.post('/profils', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: adminId, email } = request.user as { id: string; email: string }
    if (!isAdminEmail(email)) return reply.status(403).send({ error: 'Réservé aux administrateurs' })
    const body = request.body as {
      email: string
      role: 'CHEF_DE_PROJET' | 'VALIDEUR' | 'FINANCE' | 'CONTRACT_MANAGER'
      orgUnitId?: string | null
    }
    if (!body.role) return reply.status(400).send({ error: 'Rôle requis' })
    const user = await prisma.user.findUnique({ where: { email: body.email?.trim().toLowerCase() } })
    if (!user) return reply.status(400).send({ error: 'Utilisateur introuvable' })
    if (body.orgUnitId) {
      const unit = await ldapClient.getOrgUnit(body.orgUnitId)
      if (!unit) return reply.status(400).send({ error: 'Périmètre invalide' })
      await ensureOrgUnitConfig(body.orgUnitId, adminId)
    }
    const profil = await prisma.profilAchat.create({ data: { userId: user.id, role: body.role, orgUnitId: body.orgUnitId || null } })
    return reply.status(201).send({ ...profil, orgUnit: await orgUnitRef(profil.orgUnitId) })
  })

  app.delete('/profils/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { email } = request.user as { email: string }
    if (!isAdminEmail(email)) return reply.status(403).send({ error: 'Réservé aux administrateurs' })
    const { id } = request.params as { id: string }
    const profil = await prisma.profilAchat.findUnique({ where: { id } })
    if (!profil) return reply.status(404).send({ error: 'Profil introuvable' })
    await prisma.profilAchat.delete({ where: { id } })
    return reply.status(204).send()
  })

  // ── Délégations de validation (self-service) ──────────────────────────────────────

  app.get('/delegations', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }
    const rows = await prisma.delegationValidation.findMany({
      where: { OR: [{ delegantId: userId }, { delegueId: userId }] },
      include: {
        delegant: { select: { id: true, name: true, email: true } },
        delegue: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return Promise.all(rows.map(async (d) => ({ ...d, orgUnit: await orgUnitRef(d.orgUnitId) })))
  })

  app.post('/delegations', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: delegantId } = request.user as { id: string }
    const body = request.body as {
      delegueEmail: string
      orgUnitId: string
      pouvoir: 'COMPLET' | 'PARTIEL'
      pourcentage?: number | null
      seuilEuro?: number | null
      dateDebut?: string | null
      dateFin?: string | null
    }
    if (!body.orgUnitId) return reply.status(400).send({ error: 'Périmètre requis' })
    if (!body.pouvoir) return reply.status(400).send({ error: 'Pouvoir requis' })
    if (!(await isTitulaireValidation(delegantId, body.orgUnitId))) {
      return reply.status(403).send({ error: "Vous n'êtes pas valideur de ce périmètre" })
    }
    if (body.pouvoir === 'PARTIEL' && body.pourcentage == null && body.seuilEuro == null) {
      return reply.status(400).send({ error: 'Précisez un pourcentage ou un seuil pour un pouvoir partiel' })
    }
    const delegue = await prisma.user.findUnique({ where: { email: body.delegueEmail?.trim().toLowerCase() } })
    if (!delegue) return reply.status(400).send({ error: 'Délégué introuvable' })

    await ensureOrgUnitConfig(body.orgUnitId, delegantId)
    const delegation = await prisma.delegationValidation.create({
      data: {
        delegantId,
        delegueId: delegue.id,
        orgUnitId: body.orgUnitId,
        pouvoir: body.pouvoir,
        pourcentage: body.pouvoir === 'PARTIEL' ? (body.pourcentage ?? null) : null,
        seuilEuro: body.pouvoir === 'PARTIEL' ? (body.seuilEuro ?? null) : null,
        dateDebut: body.dateDebut ? new Date(body.dateDebut) : null,
        dateFin: body.dateFin ? new Date(body.dateFin) : null,
      },
      include: { delegue: { select: { id: true, name: true, email: true } } },
    })
    return reply.status(201).send({ ...delegation, orgUnit: await orgUnitRef(delegation.orgUnitId) })
  })

  app.delete('/delegations/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const delegation = await prisma.delegationValidation.findUnique({ where: { id } })
    if (!delegation || delegation.delegantId !== userId) return reply.status(404).send({ error: 'Délégation introuvable' })
    await prisma.delegationValidation.update({ where: { id }, data: { statut: 'REVOQUEE' } })
    return reply.status(204).send()
  })
}
