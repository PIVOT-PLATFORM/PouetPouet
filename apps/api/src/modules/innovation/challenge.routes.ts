import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { isAdminEmail } from '../../lib/feature-flags.js'
import { notify } from '../../lib/notify.js'
import { deleteResourceShares } from '../../lib/module-share.js'
import { serializeChallenge } from './challenge-serialize.js'
import { resolveOrgUnits, isInSubtree } from './innovation-org.js'
import { canManageChallenge, isJuror } from './challenge-access.js'

const STATUSES = ['DRAFT', 'OPEN', 'EVALUATION', 'CLOSED'] as const
const STATUS_RANK: Record<(typeof STATUSES)[number], number> = { DRAFT: 0, OPEN: 1, EVALUATION: 2, CLOSED: 3 }

const createSchema = z.object({
  nom: z.string().min(1).max(120),
  description: z.string().min(1).max(3000),
  theme: z.string().max(120).optional(),
  opensAt: z.string().datetime().optional(),
  closesAt: z.string().datetime().optional(),
  orgUnitRef: z.string().min(1).optional(),
})

const editSchema = z.object({
  nom: z.string().min(1).max(120).optional(),
  description: z.string().min(1).max(3000).optional(),
  theme: z.string().max(120).nullable().optional(),
  status: z.enum(STATUSES).optional(),
  opensAt: z.string().datetime().nullable().optional(),
  closesAt: z.string().datetime().nullable().optional(),
  orgUnitRef: z.string().min(1).nullable().optional(),
})

// Valide qu'un ref organisationnel existe dans le référentiel fusionné (LDAP + interne).
async function validateOrgUnitRef(orgUnitRef: string | null | undefined): Promise<string | null> {
  if (!orgUnitRef) return null
  const { units } = await resolveOrgUnits()
  if (!units.some((u) => u.ref === orgUnitRef)) return 'Périmètre organisationnel introuvable.'
  return null
}

const entrySchema = z.object({ ficheId: z.string().min(1) })
const winnersSchema = z.object({ ficheIds: z.array(z.string().min(1)) })

const CHALLENGE_INCLUDE = { _count: { select: { entries: true } } } as const

export const challengeRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  // GET /challenges — visibilité globale.
  app.get('/challenges', async () => {
    const challenges = await prisma.innovationChallenge.findMany({
      orderBy: { createdAt: 'desc' },
      include: CHALLENGE_INCLUDE,
    })
    return challenges.map((c) => serializeChallenge(c))
  })

  // POST /challenges — réservé aux admins de l'app ; créateur = owner.
  app.post('/challenges', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    if (!isAdminEmail(email)) return reply.status(403).send({ error: 'Réservé aux administrateurs.' })

    const body = createSchema.parse(request.body)
    const orgError = await validateOrgUnitRef(body.orgUnitRef)
    if (orgError) return reply.status(400).send({ error: orgError })

    const challenge = await prisma.innovationChallenge.create({
      data: {
        nom: body.nom,
        description: body.description,
        theme: body.theme,
        opensAt: body.opensAt ? new Date(body.opensAt) : undefined,
        closesAt: body.closesAt ? new Date(body.closesAt) : undefined,
        orgUnitRef: body.orgUnitRef,
        ownerId: userId,
      },
      include: CHALLENGE_INCLUDE,
    })
    return reply.status(201).send(serializeChallenge(challenge))
  })

  // GET /challenges/:id — détail + fiches inscrites (visibilité globale).
  // `canManage` indique si l'appelant peut administrer ce challenge (owner, éditeur
  // partagé ou admin app) — utilisé côté web pour afficher les actions d'administration.
  app.get('/challenges/:id', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id } = request.params as { id: string }
    const challenge = await prisma.innovationChallenge.findUnique({
      where: { id },
      include: {
        ...CHALLENGE_INCLUDE,
        entries: {
          orderBy: { createdAt: 'asc' },
          include: { fiche: { select: { id: true, title: true, pitch: true, status: true, authorId: true, author: { select: { id: true, name: true } } } } },
        },
      },
    })
    if (!challenge) return reply.status(404).send({ error: 'Challenge introuvable.' })

    return {
      ...serializeChallenge(challenge),
      canManage: await canManageChallenge(challenge, userId, email),
      isJuror: await isJuror(id, userId),
      entries: challenge.entries.map((e) => ({ fiche: e.fiche, isWinner: e.isWinner, submittedById: e.submittedById })),
    }
  })

  // PATCH /challenges/:id — owner, éditeur partagé ou admin ; transitions forward-only (retour arrière = admin app).
  app.patch('/challenges/:id', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id } = request.params as { id: string }
    const data = editSchema.parse(request.body)

    const existing = await prisma.innovationChallenge.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Challenge introuvable.' })
    if (!(await canManageChallenge(existing, userId, email))) {
      return reply.status(403).send({ error: 'Vous ne pouvez pas modifier ce challenge.' })
    }
    if (data.status && data.status !== existing.status) {
      const goingBackward = STATUS_RANK[data.status] < STATUS_RANK[existing.status as (typeof STATUSES)[number]]
      if (goingBackward && !isAdminEmail(email)) {
        return reply.status(400).send({ error: 'Retour à un statut précédent réservé aux administrateurs.' })
      }
    }
    const orgError = await validateOrgUnitRef(data.orgUnitRef)
    if (orgError) return reply.status(400).send({ error: orgError })

    const challenge = await prisma.innovationChallenge.update({
      where: { id },
      data: {
        ...data,
        opensAt: data.opensAt !== undefined ? (data.opensAt ? new Date(data.opensAt) : null) : undefined,
        closesAt: data.closesAt !== undefined ? (data.closesAt ? new Date(data.closesAt) : null) : undefined,
      },
      include: CHALLENGE_INCLUDE,
    })
    return serializeChallenge(challenge)
  })

  // DELETE /challenges/:id — owner ou admin (existence déjà publique via GET, donc 403 pas 404).
  app.delete('/challenges/:id', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id } = request.params as { id: string }

    const existing = await prisma.innovationChallenge.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Challenge introuvable.' })
    if (existing.ownerId !== userId && !isAdminEmail(email)) {
      return reply.status(403).send({ error: 'Vous ne pouvez pas supprimer ce challenge.' })
    }

    await prisma.innovationChallenge.delete({ where: { id } })
    await deleteResourceShares('challenge', id)
    return reply.status(204).send()
  })

  // GET /fiches/:id/challenges — challenges auxquels une fiche est inscrite (pour l'affichage sur sa page).
  app.get('/fiches/:id/challenges', async (request) => {
    const { id: ficheId } = request.params as { id: string }
    const entries = await prisma.challengeEntry.findMany({
      where: { ficheId },
      include: { challenge: { select: { id: true, nom: true, status: true } } },
    })
    return entries.map((e) => ({ challenge: e.challenge, isWinner: e.isWinner }))
  })

  // POST /challenges/:id/entries — inscrire une fiche (auteur/contributeur de la fiche, challenge OPEN).
  app.post('/challenges/:id/entries', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id: challengeId } = request.params as { id: string }
    const { ficheId } = entrySchema.parse(request.body)

    const challenge = await prisma.innovationChallenge.findUnique({ where: { id: challengeId } })
    if (!challenge) return reply.status(404).send({ error: 'Challenge introuvable.' })
    if (challenge.status !== 'OPEN') return reply.status(400).send({ error: 'Ce challenge n\'accepte plus d\'inscriptions.' })

    const fiche = await prisma.innovationFiche.findUnique({ where: { id: ficheId } })
    if (!fiche) return reply.status(404).send({ error: 'Fiche introuvable.' })
    const isContributor = fiche.authorId === userId || !!(await prisma.innovationContributor.findUnique({ where: { ficheId_userId: { ficheId, userId } } }))
    if (!isContributor) return reply.status(403).send({ error: 'Vous devez être auteur ou contributeur de la fiche pour l\'inscrire.' })

    if (challenge.orgUnitRef) {
      if (!fiche.orgUnitRef) return reply.status(400).send({ error: 'Cette fiche n\'a pas de périmètre organisationnel compatible avec ce challenge.' })
      const { units } = await resolveOrgUnits()
      if (!isInSubtree(fiche.orgUnitRef, challenge.orgUnitRef, units)) {
        return reply.status(400).send({ error: 'Cette fiche est hors du périmètre organisationnel éligible pour ce challenge.' })
      }
    }

    const existingEntry = await prisma.challengeEntry.findUnique({ where: { challengeId_ficheId: { challengeId, ficheId } } })
    if (existingEntry) return reply.status(400).send({ error: 'Cette fiche est déjà inscrite à ce challenge.' })

    const entry = await prisma.challengeEntry.create({ data: { challengeId, ficheId, submittedById: userId } })

    // Notifie l'auteur (si l'inscription vient d'un co-contributeur) et l'owner du
    // challenge (si ce n'est pas lui qui inscrit) — jamais l'acteur lui-même.
    if (fiche.authorId !== userId) {
      await notify({
        userId: fiche.authorId,
        type: 'INNOVATION_FICHE_SUBMITTED',
        title: 'Fiche inscrite à un challenge',
        body: `Votre fiche « ${fiche.title} » a été inscrite au challenge « ${challenge.nom} ».`,
        link: `/innovation/challenges/${challengeId}`,
      })
    }
    if (challenge.ownerId !== userId) {
      await notify({
        userId: challenge.ownerId,
        type: 'INNOVATION_FICHE_SUBMITTED',
        title: 'Nouvelle inscription à votre challenge',
        body: `« ${fiche.title} » vient de s'inscrire au challenge « ${challenge.nom} ».`,
        link: `/innovation/challenges/${challengeId}`,
      })
    }

    return reply.status(201).send(entry)
  })

  // DELETE /challenges/:id/entries/:ficheId — retirer une fiche (soumetteur ou admin du challenge).
  app.delete('/challenges/:id/entries/:ficheId', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id: challengeId, ficheId } = request.params as { id: string; ficheId: string }

    const challenge = await prisma.innovationChallenge.findUnique({ where: { id: challengeId } })
    if (!challenge) return reply.status(404).send({ error: 'Challenge introuvable.' })

    const entry = await prisma.challengeEntry.findUnique({ where: { challengeId_ficheId: { challengeId, ficheId } } })
    if (!entry) return reply.status(404).send({ error: 'Inscription introuvable.' })

    const canRemove = entry.submittedById === userId || (await canManageChallenge(challenge, userId, email))
    if (!canRemove) return reply.status(403).send({ error: 'Vous ne pouvez pas retirer cette inscription.' })

    await prisma.challengeEntry.delete({ where: { challengeId_ficheId: { challengeId, ficheId } } })
    return reply.status(204).send()
  })

  // POST /challenges/:id/winners — remplace l'ensemble des lauréats (admin du challenge, statut EVALUATION/CLOSED).
  app.post('/challenges/:id/winners', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id: challengeId } = request.params as { id: string }
    const { ficheIds } = winnersSchema.parse(request.body)

    const challenge = await prisma.innovationChallenge.findUnique({ where: { id: challengeId } })
    if (!challenge) return reply.status(404).send({ error: 'Challenge introuvable.' })
    if (!(await canManageChallenge(challenge, userId, email))) {
      return reply.status(403).send({ error: 'Vous ne pouvez pas désigner les lauréats de ce challenge.' })
    }
    if (challenge.status !== 'EVALUATION' && challenge.status !== 'CLOSED') {
      return reply.status(400).send({ error: 'Les lauréats ne peuvent être désignés qu\'en évaluation ou après clôture.' })
    }

    // Notifier uniquement les NOUVEAUX lauréats (pas ceux qui l'étaient déjà avant
    // ce remplacement — re-sauvegarder la même liste ne re-notifie personne).
    const previousWinners = await prisma.challengeEntry.findMany({
      where: { challengeId, isWinner: true },
      select: { ficheId: true },
    })
    const previousWinnerIds = new Set(previousWinners.map((e) => e.ficheId))

    await prisma.$transaction([
      prisma.challengeEntry.updateMany({ where: { challengeId }, data: { isWinner: false } }),
      prisma.challengeEntry.updateMany({ where: { challengeId, ficheId: { in: ficheIds } }, data: { isWinner: true } }),
    ])

    const newWinnerIds = ficheIds.filter((id) => !previousWinnerIds.has(id))
    if (newWinnerIds.length > 0) {
      const winningFiches = await prisma.innovationFiche.findMany({
        where: { id: { in: newWinnerIds } },
        include: { contributors: { select: { userId: true } } },
      })
      for (const fiche of winningFiches) {
        const recipients = new Set([fiche.authorId, ...fiche.contributors.map((c) => c.userId)])
        recipients.delete(userId) // jamais l'acteur lui-même
        for (const recipientId of recipients) {
          await notify({
            userId: recipientId,
            type: 'INNOVATION_FICHE_WINNER',
            title: '🏆 Fiche lauréate !',
            body: `« ${fiche.title} » est lauréate du challenge « ${challenge.nom} ».`,
            link: `/innovation/challenges/${challengeId}`,
          })
        }
      }
    }

    const entries = await prisma.challengeEntry.findMany({
      where: { challengeId },
      include: { fiche: { select: { id: true, title: true, pitch: true, status: true, authorId: true, author: { select: { id: true, name: true } } } } },
    })
    return entries.map((e) => ({ fiche: e.fiche, isWinner: e.isWinner, submittedById: e.submittedById }))
  })
}
