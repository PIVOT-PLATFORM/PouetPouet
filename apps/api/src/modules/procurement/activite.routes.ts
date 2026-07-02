import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { resolveRole, sharedResourceIds, deleteResourceShares, canManage } from '../../lib/module-share.js'
import { isAdminEmail } from '../../lib/feature-flags.js'
import { resolveGovernanceConfig } from './governance-config.js'
import { ldapClient } from '../../lib/ldap-client.js'
import { pgiClient } from '../../lib/pgi-client.js'
import type { LdapOrgUnit } from '../../lib/ldap-client.js'

const ACTIVITE_MODULE = 'procurement-activite'

// Même modèle d'accès que procurement.routes.ts : lecture globale (tout interne),
// écriture réservée au créateur, ses délégués (ModuleShare EDITOR) et les administrateurs.
function canEdit(role: 'OWNER' | 'EDITOR' | 'VIEWER' | null, email: string | undefined): boolean {
  return canManage(role) || isAdminEmail(email)
}

// Le département (OrgUnit) et le contrat prévu (Contrat) d'une ligne budgétaire vivent
// désormais dans des pods externes (ldapClient/pgiClient) — plus de relation Prisma à
// inclure, on enrichit la réponse après coup.
async function departementRef(departementId: string | null): Promise<{ id: string; nom: string; niveau: LdapOrgUnit['niveau'] } | null> {
  if (!departementId) return null
  const unit = await ldapClient.getOrgUnit(departementId)
  return unit ? { id: unit.id, nom: unit.nom, niveau: unit.niveau } : null
}

async function contratRef(contratId: string | null): Promise<{ id: string; numero: string; objet: string } | null> {
  if (!contratId) return null
  const contrat = await pgiClient.getContrat(contratId)
  return contrat ? { id: contrat.id, numero: contrat.numero, objet: contrat.objet } : null
}

async function withBudgetLigneContrat<T extends { contratId: string | null }>(ligne: T) {
  return { ...ligne, contrat: await contratRef(ligne.contratId) }
}

async function enrichActivite<T extends { departementId: string | null; budgetLignes: { contratId: string | null }[] }>(activite: T) {
  const [departement, budgetLignes] = await Promise.all([
    departementRef(activite.departementId),
    Promise.all(activite.budgetLignes.map(withBudgetLigneContrat)),
  ])
  return { ...activite, departement, budgetLignes }
}

const ACTIVITE_INCLUDE = {
  pilote: { select: { id: true, name: true, email: true } },
  produit: { select: { id: true, nom: true } },
  gains: { orderBy: { order: 'asc' as const } },
  faitsMarquants: { orderBy: { date: 'desc' as const } },
  budgetLignes: { orderBy: [{ annee: 'asc' as const }, { type: 'asc' as const }] },
  jalons: { orderBy: { order: 'asc' as const } },
  risques: { orderBy: { createdAt: 'asc' as const } },
}

interface GainInput { montant: number; typologie: string; commentaire?: string | null; order?: number }
interface FaitMarquantInput { date: string; texte: string }
interface BudgetLigneInput {
  annee: number
  type: 'OPEX' | 'CAPEX' | 'APCO'
  montantMo?: number | null
  montantHmo?: number | null
  utilisateurMetier?: string | null
  priorite?: string | null
  objetGestion?: string | null
  jalonPhase?: string | null
  contratId?: string | null
}
interface JalonInput { type: string; libelle?: string | null; datePrevue?: string | null; dateReelle?: string | null; decision?: string | null; commentaire?: string | null }
interface RisqueInput {
  titre: string
  description?: string | null
  categorie?: string | null
  probabilite: number
  impact: number
  planMitigation?: string | null
  responsable?: string | null
  jiraLien?: string | null
  statut?: 'OUVERT' | 'EN_COURS' | 'CLOS'
  dateRevue?: string | null
}

export const activiteRoutes: FastifyPluginAsync = async (app) => {
  async function resolveUserIdByEmail(email: string | null | undefined): Promise<string | null | undefined> {
    if (email === undefined) return undefined
    if (!email) return null
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
    return user?.id ?? null
  }

  // Activité éditable par l'appelant (créateur, délégué EDITOR, ou administrateur).
  async function editableActivite(activiteId: string, userId: string, email: string | undefined) {
    const activite = await prisma.activite.findUnique({ where: { id: activiteId } })
    if (!activite) return null
    const role = await resolveRole(ACTIVITE_MODULE, activiteId, userId, activite.ownerId)
    return canEdit(role, email) ? activite : null
  }

  // ── Activités ─────────────────────────────────────────────────────────────────
  // Transparence interne : tout utilisateur authentifié voit toutes les activités en
  // lecture ; seuls le créateur, ses délégués et les administrateurs peuvent modifier.

  app.get('/activites', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }
    const shared = await sharedResourceIds(ACTIVITE_MODULE, userId)
    const sharedRole = new Map(shared.map((s) => [s.id, s.role]))
    const activites = await prisma.activite.findMany({
      include: { produit: { select: { id: true, nom: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return Promise.all(activites.map(async (a) => ({
      ...a,
      departement: await departementRef(a.departementId),
      role: a.ownerId === userId ? 'OWNER' : (sharedRole.get(a.id) ?? 'VIEWER'),
    })))
  })

  app.post('/activites', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const body = request.body as { nom: string; type?: string; description?: string | null }
    if (!body.nom?.trim()) return reply.status(400).send({ error: 'Nom requis' })

    // Jalons obligatoires résolus par héritage sur le périmètre (OrgUnit) du créateur,
    // figés à la création — un changement de configuration ultérieur n'affecte pas les
    // activités déjà créées (cf. governance-config.ts).
    const profilChefDeProjet = await prisma.profilAchat.findFirst({ where: { userId: ownerId, role: 'CHEF_DE_PROJET' }, select: { orgUnitId: true } })
    const jalonsObligatoires = (await resolveGovernanceConfig(profilChefDeProjet?.orgUnitId ?? null, 'JALON_TYPE')).filter((j) => j.obligatoire)

    const activite = await prisma.activite.create({
      data: {
        ownerId,
        nom: body.nom.trim(),
        type: (body.type as never) ?? undefined,
        description: body.description?.trim() || null,
        jalons: { create: jalonsObligatoires.map((j, i) => ({ type: j.valeur as never, order: i, obligatoire: true })) },
      },
      include: ACTIVITE_INCLUDE,
    })
    return reply.status(201).send(await enrichActivite(activite))
  })

  app.get('/activites/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId } = request.user as { id: string }
    const activite = await prisma.activite.findUnique({ where: { id }, include: ACTIVITE_INCLUDE })
    if (!activite) return reply.status(404).send({ error: 'Activité introuvable' })
    const role = (await resolveRole(ACTIVITE_MODULE, id, userId, activite.ownerId)) ?? 'VIEWER'
    const workflows = await prisma.demandeAchatWorkflow.findMany({
      where: { activiteId: id },
      select: { demandeAchatExternalId: true, validationStatut: true },
    })
    const demandesAchat = (await Promise.all(workflows.map(async (w) => {
      const da = await pgiClient.getDemandeAchat(w.demandeAchatExternalId)
      return da ? { id: da.id, numero: da.numero, objet: da.objet, validationStatut: w.validationStatut } : null
    }))).filter((d) => d !== null)
    return { ...(await enrichActivite(activite)), role, demandesAchat }
  })

  app.put('/activites/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    const existing = await prisma.activite.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Activité introuvable' })
    const role = await resolveRole(ACTIVITE_MODULE, id, userId, existing.ownerId)
    if (!canEdit(role, email)) return reply.status(403).send({ error: "Vous n'êtes pas autorisé à modifier cette activité" })

    const body = request.body as Partial<{
      nom: string; type: string; statut: string; meteo: string; description: string | null; enjeux: boolean
      pmt: string | null; planProduction: boolean; schemaDirecteur: boolean; hopexLien: string | null
      piloteEmail: string | null; produitId: string | null; departementId: string | null
      pole: string | null; domaineMetier: string | null; sousDomaineMetier: string | null
      capaciteMetier: string | null; sousCapaciteMetier: string | null; prioriteMetier: string | null
    }>

    if (body.departementId) {
      const dep = await ldapClient.getOrgUnit(body.departementId)
      if (!dep || dep.niveau !== 'DEPARTEMENT') return reply.status(400).send({ error: 'Département invalide' })
    }
    if (body.produitId) {
      const produit = await prisma.produit.findUnique({ where: { id: body.produitId } })
      if (!produit) return reply.status(400).send({ error: 'Produit invalide' })
    }
    const piloteId = await resolveUserIdByEmail(body.piloteEmail)

    const updated = await prisma.activite.update({
      where: { id },
      data: {
        nom: body.nom?.trim() ?? undefined,
        type: (body.type as never) ?? undefined,
        statut: (body.statut as never) ?? undefined,
        meteo: (body.meteo as never) ?? undefined,
        description: body.description !== undefined ? (body.description?.trim() || null) : undefined,
        enjeux: body.enjeux ?? undefined,
        pmt: body.pmt !== undefined ? (body.pmt?.trim() || null) : undefined,
        planProduction: body.planProduction ?? undefined,
        schemaDirecteur: body.schemaDirecteur ?? undefined,
        hopexLien: body.hopexLien !== undefined ? (body.hopexLien?.trim() || null) : undefined,
        piloteId,
        produitId: body.produitId !== undefined ? (body.produitId || null) : undefined,
        departementId: body.departementId !== undefined ? (body.departementId || null) : undefined,
        pole: body.pole !== undefined ? (body.pole?.trim() || null) : undefined,
        domaineMetier: body.domaineMetier !== undefined ? (body.domaineMetier?.trim() || null) : undefined,
        sousDomaineMetier: body.sousDomaineMetier !== undefined ? (body.sousDomaineMetier?.trim() || null) : undefined,
        capaciteMetier: body.capaciteMetier !== undefined ? (body.capaciteMetier?.trim() || null) : undefined,
        sousCapaciteMetier: body.sousCapaciteMetier !== undefined ? (body.sousCapaciteMetier?.trim() || null) : undefined,
        prioriteMetier: body.prioriteMetier !== undefined ? (body.prioriteMetier?.trim() || null) : undefined,
      },
      include: ACTIVITE_INCLUDE,
    })
    return enrichActivite(updated)
  })

  app.delete('/activites/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    const activite = await prisma.activite.findUnique({ where: { id } })
    if (!activite || (activite.ownerId !== userId && !isAdminEmail(email))) return reply.status(404).send({ error: 'Activité introuvable' })
    await prisma.activite.delete({ where: { id } })
    await deleteResourceShares(ACTIVITE_MODULE, id)
    return reply.status(204).send()
  })

  // ── Gains ─────────────────────────────────────────────────────────────────────

  app.post('/activites/:id/gains', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    if (!(await editableActivite(id, userId, email))) return reply.status(404).send({ error: 'Activité introuvable' })
    const body = request.body as GainInput
    if (body.montant == null) return reply.status(400).send({ error: 'Montant requis' })
    if (!body.typologie?.trim()) return reply.status(400).send({ error: 'Typologie requise' })
    const gain = await prisma.activiteGain.create({
      data: { activiteId: id, montant: body.montant, typologie: body.typologie.trim(), commentaire: body.commentaire?.trim() || null, order: body.order ?? 0 },
    })
    return reply.status(201).send(gain)
  })

  app.put('/activite-gains/:gainId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { gainId } = request.params as { gainId: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    const gain = await prisma.activiteGain.findUnique({ where: { id: gainId } })
    if (!gain || !(await editableActivite(gain.activiteId, userId, email))) return reply.status(404).send({ error: 'Gain introuvable' })
    const body = request.body as Partial<GainInput>
    const updated = await prisma.activiteGain.update({
      where: { id: gainId },
      data: {
        montant: body.montant ?? undefined,
        typologie: body.typologie?.trim() ?? undefined,
        commentaire: body.commentaire !== undefined ? (body.commentaire?.trim() || null) : undefined,
        order: body.order ?? undefined,
      },
    })
    return updated
  })

  app.delete('/activite-gains/:gainId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { gainId } = request.params as { gainId: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    const gain = await prisma.activiteGain.findUnique({ where: { id: gainId } })
    if (!gain || !(await editableActivite(gain.activiteId, userId, email))) return reply.status(404).send({ error: 'Gain introuvable' })
    await prisma.activiteGain.delete({ where: { id: gainId } })
    return reply.status(204).send()
  })

  // ── Faits marquants ─────────────────────────────────────────────────────────────

  app.post('/activites/:id/faits-marquants', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    if (!(await editableActivite(id, userId, email))) return reply.status(404).send({ error: 'Activité introuvable' })
    const body = request.body as FaitMarquantInput
    if (!body.date) return reply.status(400).send({ error: 'Date requise' })
    if (!body.texte?.trim()) return reply.status(400).send({ error: 'Texte requis' })
    const fait = await prisma.activiteFaitMarquant.create({
      data: { activiteId: id, date: new Date(body.date), texte: body.texte.trim() },
    })
    return reply.status(201).send(fait)
  })

  app.delete('/activite-faits-marquants/:faitId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { faitId } = request.params as { faitId: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    const fait = await prisma.activiteFaitMarquant.findUnique({ where: { id: faitId } })
    if (!fait || !(await editableActivite(fait.activiteId, userId, email))) return reply.status(404).send({ error: 'Fait marquant introuvable' })
    await prisma.activiteFaitMarquant.delete({ where: { id: faitId } })
    return reply.status(204).send()
  })

  // ── Budget pluriannuel ───────────────────────────────────────────────────────────

  app.post('/activites/:id/budget-lignes', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    if (!(await editableActivite(id, userId, email))) return reply.status(404).send({ error: 'Activité introuvable' })
    const body = request.body as BudgetLigneInput
    if (!body.annee) return reply.status(400).send({ error: 'Année requise' })
    if (!body.type) return reply.status(400).send({ error: 'Type requis' })
    if (body.contratId && !(await pgiClient.getContrat(body.contratId))) {
      return reply.status(400).send({ error: 'Contrat invalide' })
    }
    const ligne = await prisma.activiteBudgetLigne.create({
      data: {
        activiteId: id,
        annee: body.annee,
        type: body.type,
        montantMo: body.montantMo ?? null,
        montantHmo: body.montantHmo ?? null,
        utilisateurMetier: body.utilisateurMetier?.trim() || null,
        priorite: body.priorite?.trim() || null,
        objetGestion: body.objetGestion?.trim() || null,
        jalonPhase: (body.jalonPhase as never) || null,
        contratId: body.contratId || null,
      },
    })
    return reply.status(201).send(await withBudgetLigneContrat(ligne))
  })

  app.put('/activite-budget-lignes/:ligneId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { ligneId } = request.params as { ligneId: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    const ligne = await prisma.activiteBudgetLigne.findUnique({ where: { id: ligneId } })
    if (!ligne || !(await editableActivite(ligne.activiteId, userId, email))) return reply.status(404).send({ error: 'Ligne budgétaire introuvable' })
    const body = request.body as Partial<BudgetLigneInput>
    if (body.contratId && !(await pgiClient.getContrat(body.contratId))) {
      return reply.status(400).send({ error: 'Contrat invalide' })
    }
    const updated = await prisma.activiteBudgetLigne.update({
      where: { id: ligneId },
      data: {
        annee: body.annee ?? undefined,
        type: body.type ?? undefined,
        montantMo: body.montantMo !== undefined ? body.montantMo : undefined,
        montantHmo: body.montantHmo !== undefined ? body.montantHmo : undefined,
        utilisateurMetier: body.utilisateurMetier !== undefined ? (body.utilisateurMetier?.trim() || null) : undefined,
        priorite: body.priorite !== undefined ? (body.priorite?.trim() || null) : undefined,
        objetGestion: body.objetGestion !== undefined ? (body.objetGestion?.trim() || null) : undefined,
        jalonPhase: body.jalonPhase !== undefined ? ((body.jalonPhase as never) || null) : undefined,
        contratId: body.contratId !== undefined ? (body.contratId || null) : undefined,
      },
    })
    return withBudgetLigneContrat(updated)
  })

  app.delete('/activite-budget-lignes/:ligneId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { ligneId } = request.params as { ligneId: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    const ligne = await prisma.activiteBudgetLigne.findUnique({ where: { id: ligneId } })
    if (!ligne || !(await editableActivite(ligne.activiteId, userId, email))) return reply.status(404).send({ error: 'Ligne budgétaire introuvable' })
    await prisma.activiteBudgetLigne.delete({ where: { id: ligneId } })
    return reply.status(204).send()
  })

  // ── Jalonnement ───────────────────────────────────────────────────────────────

  app.post('/activites/:id/jalons', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    if (!(await editableActivite(id, userId, email))) return reply.status(404).send({ error: 'Activité introuvable' })
    const body = request.body as JalonInput
    if (!body.type) return reply.status(400).send({ error: 'Type de jalon requis' })
    const count = await prisma.activiteJalon.count({ where: { activiteId: id } })
    const jalon = await prisma.activiteJalon.create({
      data: {
        activiteId: id,
        type: body.type as never,
        libelle: body.libelle?.trim() || null,
        datePrevue: body.datePrevue ? new Date(body.datePrevue) : null,
        dateReelle: body.dateReelle ? new Date(body.dateReelle) : null,
        decision: body.decision?.trim() || null,
        commentaire: body.commentaire?.trim() || null,
        order: count,
      },
    })
    return reply.status(201).send(jalon)
  })

  app.put('/activite-jalons/:jalonId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { jalonId } = request.params as { jalonId: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    const jalon = await prisma.activiteJalon.findUnique({ where: { id: jalonId } })
    if (!jalon || !(await editableActivite(jalon.activiteId, userId, email))) return reply.status(404).send({ error: 'Jalon introuvable' })
    const body = request.body as Partial<JalonInput>
    const updated = await prisma.activiteJalon.update({
      where: { id: jalonId },
      data: {
        libelle: body.libelle !== undefined ? (body.libelle?.trim() || null) : undefined,
        datePrevue: body.datePrevue !== undefined ? (body.datePrevue ? new Date(body.datePrevue) : null) : undefined,
        dateReelle: body.dateReelle !== undefined ? (body.dateReelle ? new Date(body.dateReelle) : null) : undefined,
        decision: body.decision !== undefined ? (body.decision?.trim() || null) : undefined,
        commentaire: body.commentaire !== undefined ? (body.commentaire?.trim() || null) : undefined,
      },
    })
    return updated
  })

  app.delete('/activite-jalons/:jalonId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { jalonId } = request.params as { jalonId: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    const jalon = await prisma.activiteJalon.findUnique({ where: { id: jalonId } })
    if (!jalon || !(await editableActivite(jalon.activiteId, userId, email))) return reply.status(404).send({ error: 'Jalon introuvable' })
    if (jalon.obligatoire) {
      return reply.status(409).send({ error: 'Les jalons obligatoires ne peuvent pas être supprimés' })
    }
    await prisma.activiteJalon.delete({ where: { id: jalonId } })
    return reply.status(204).send()
  })

  // ── Risques ───────────────────────────────────────────────────────────────────

  app.post('/activites/:id/risques', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    if (!(await editableActivite(id, userId, email))) return reply.status(404).send({ error: 'Activité introuvable' })
    const body = request.body as RisqueInput
    if (!body.titre?.trim()) return reply.status(400).send({ error: 'Titre requis' })
    if (!body.probabilite || !body.impact) return reply.status(400).send({ error: 'Probabilité et impact requis' })
    const risque = await prisma.activiteRisque.create({
      data: {
        activiteId: id,
        titre: body.titre.trim(),
        description: body.description?.trim() || null,
        categorie: body.categorie?.trim() || null,
        probabilite: body.probabilite,
        impact: body.impact,
        planMitigation: body.planMitigation?.trim() || null,
        responsable: body.responsable?.trim() || null,
        jiraLien: body.jiraLien?.trim() || null,
        statut: body.statut ?? 'OUVERT',
        dateRevue: body.dateRevue ? new Date(body.dateRevue) : null,
      },
    })
    return reply.status(201).send(risque)
  })

  app.put('/activite-risques/:risqueId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { risqueId } = request.params as { risqueId: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    const risque = await prisma.activiteRisque.findUnique({ where: { id: risqueId } })
    if (!risque || !(await editableActivite(risque.activiteId, userId, email))) return reply.status(404).send({ error: 'Risque introuvable' })
    const body = request.body as Partial<RisqueInput>
    const updated = await prisma.activiteRisque.update({
      where: { id: risqueId },
      data: {
        titre: body.titre?.trim() ?? undefined,
        description: body.description !== undefined ? (body.description?.trim() || null) : undefined,
        categorie: body.categorie !== undefined ? (body.categorie?.trim() || null) : undefined,
        probabilite: body.probabilite ?? undefined,
        impact: body.impact ?? undefined,
        planMitigation: body.planMitigation !== undefined ? (body.planMitigation?.trim() || null) : undefined,
        responsable: body.responsable !== undefined ? (body.responsable?.trim() || null) : undefined,
        jiraLien: body.jiraLien !== undefined ? (body.jiraLien?.trim() || null) : undefined,
        statut: body.statut ?? undefined,
        dateRevue: body.dateRevue !== undefined ? (body.dateRevue ? new Date(body.dateRevue) : null) : undefined,
      },
    })
    return updated
  })

  app.delete('/activite-risques/:risqueId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { risqueId } = request.params as { risqueId: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    const risque = await prisma.activiteRisque.findUnique({ where: { id: risqueId } })
    if (!risque || !(await editableActivite(risque.activiteId, userId, email))) return reply.status(404).send({ error: 'Risque introuvable' })
    await prisma.activiteRisque.delete({ where: { id: risqueId } })
    return reply.status(204).send()
  })

  // ── Produits (rustine, liste de référence + agrégation) ──────────────────────────
  // Liste de référence visible par tous ; suppression réservée au créateur + admin
  // (pas de ModuleShare dédié : objet de faible enjeu, pas de besoin de délégation fine).

  app.get('/produits', { preHandler: [app.authenticate] }, async () => {
    const produits = await prisma.produit.findMany({
      include: { _count: { select: { activites: true } } },
      orderBy: { nom: 'asc' },
    })
    return produits
  })

  app.post('/produits', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const body = request.body as { nom: string }
    if (!body.nom?.trim()) return reply.status(400).send({ error: 'Nom requis' })
    const produit = await prisma.produit.create({ data: { ownerId, nom: body.nom.trim() } })
    return reply.status(201).send(produit)
  })

  app.delete('/produits/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId, email } = request.user as { id: string; email: string }
    const produit = await prisma.produit.findUnique({ where: { id } })
    if (!produit || (produit.ownerId !== userId && !isAdminEmail(email))) return reply.status(404).send({ error: 'Produit introuvable' })
    await prisma.produit.delete({ where: { id } })
    return reply.status(204).send()
  })

  app.get('/produits/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const produit = await prisma.produit.findUnique({ where: { id } })
    if (!produit) return reply.status(404).send({ error: 'Produit introuvable' })

    const activites = await prisma.activite.findMany({
      where: { produitId: id },
      include: { gains: true, risques: true, budgetLignes: true },
    })

    const gainsTotal = activites.reduce((s, a) => s + a.gains.reduce((s2, g) => s2 + g.montant, 0), 0)
    const gainsParTypologie: Record<string, number> = {}
    for (const a of activites) {
      for (const g of a.gains) gainsParTypologie[g.typologie] = (gainsParTypologie[g.typologie] ?? 0) + g.montant
    }

    const risques = activites
      .flatMap((a) => a.risques.map((r) => ({ ...r, criticite: r.probabilite * r.impact, activiteNom: a.nom, activiteId: a.id })))
      .sort((a, b) => b.criticite - a.criticite)

    const budgetParAnneeType: Record<string, { annee: number; type: string; montantMo: number; montantHmo: number }> = {}
    for (const a of activites) {
      for (const l of a.budgetLignes) {
        const key = `${l.annee}-${l.type}`
        const entry = budgetParAnneeType[key] ?? { annee: l.annee, type: l.type, montantMo: 0, montantHmo: 0 }
        entry.montantMo += l.montantMo ?? 0
        entry.montantHmo += l.montantHmo ?? 0
        budgetParAnneeType[key] = entry
      }
    }

    return {
      ...produit,
      activites: activites.map((a) => ({ id: a.id, nom: a.nom, statut: a.statut, meteo: a.meteo, type: a.type })),
      gainsTotal,
      gainsParTypologie,
      risques,
      budgetParAnneeType: Object.values(budgetParAnneeType).sort((a, b) => a.annee - b.annee),
    }
  })
}
