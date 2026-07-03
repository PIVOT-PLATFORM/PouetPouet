import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { isAdminEmail } from '../../lib/feature-flags.js'
import { notify } from '../../lib/notify.js'
import { serializeFiche } from './innovation-serialize.js'
import { resolveOrgUnits, isInSubtree } from './innovation-org.js'

const STATUSES = ['IDEE', 'EXPLORATION', 'ADOPTEE', 'ABANDONNEE'] as const

const createSchema = z.object({
  title: z.string().min(1).max(120),
  pitch: z.string().min(1).max(300),
  probleme: z.string().max(3000).optional(),
  solution: z.string().max(3000).optional(),
  benefices: z.string().max(3000).optional(),
  orgUnitRef: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
})

const editSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    pitch: z.string().min(1).max(300).optional(),
    probleme: z.string().max(3000).nullable().optional(),
    solution: z.string().max(3000).nullable().optional(),
    benefices: z.string().max(3000).nullable().optional(),
    status: z.enum(STATUSES).optional(),
    abandonReason: z.string().max(500).nullable().optional(),
    orgUnitRef: z.string().min(1).nullable().optional(),
    categoryId: z.string().min(1).nullable().optional(),
  })
  .refine((data) => data.status !== 'ABANDONNEE' || !!data.abandonReason, {
    message: 'Un motif est requis pour abandonner une fiche.',
    path: ['abandonReason'],
  })

// Valide orgUnitRef (existe dans le référentiel fusionné) et categoryId (existe et
// applicable au périmètre effectif — globale, ou dont le périmètre est un ancêtre de
// `effectiveOrgUnitRef`, qui vaut la valeur fournie ou, à défaut, celle déjà persistée
// sur la fiche — pour qu'un PATCH ne modifiant que la catégorie reste cohérent).
async function validateOrgAndCategory(
  orgUnitRef: string | null | undefined,
  categoryId: string | null | undefined,
  effectiveOrgUnitRef: string | null,
): Promise<string | null> {
  if (orgUnitRef === undefined && categoryId === undefined) return null
  const { units } = await resolveOrgUnits()
  if (orgUnitRef && !units.some((u) => u.ref === orgUnitRef)) return 'Périmètre organisationnel introuvable.'
  if (categoryId) {
    const category = await prisma.innovationCategory.findUnique({ where: { id: categoryId } })
    if (!category) return 'Catégorie introuvable.'
    if (category.orgUnitRef && (!effectiveOrgUnitRef || !isInSubtree(effectiveOrgUnitRef, category.orgUnitRef, units))) {
      return 'Cette catégorie n\'est pas applicable à ce périmètre organisationnel.'
    }
  }
  return null
}

const contributorSchema = z.object({ email: z.string().email() })

function ficheInclude(userId: string) {
  return {
    author: { select: { id: true, name: true } },
    category: { select: { id: true, label: true } },
    contributors: { include: { user: { select: { id: true, name: true } } } },
    _count: { select: { votes: true } },
    votes: { where: { userId }, select: { id: true } },
  } as const
}

// Auteur, co-contributeur ou admin de l'app : seuls habilités à éditer/gérer une fiche.
// Les fiches sont visibles par tous les connectés (GET), mais éditables par ce périmètre
// restreint uniquement — 403 explicite pour le reste (pattern Feedback, pas d'anti-
// énumération ici puisque l'existence de la fiche est déjà publique).
async function canEditFiche(fiche: { id: string; authorId: string }, userId: string, email: string): Promise<boolean> {
  if (isAdminEmail(email)) return true
  if (fiche.authorId === userId) return true
  const contributor = await prisma.innovationContributor.findUnique({
    where: { ficheId_userId: { ficheId: fiche.id, userId } },
  })
  return !!contributor
}

export const innovationRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  // GET /fiches — toutes les fiches (visibilité globale), filtres statut / mine / recherche.
  app.get('/fiches', async (request) => {
    const { id: userId } = request.user as { id: string }
    const query = request.query as { status?: string; mine?: string; q?: string; categoryId?: string; orgUnitRef?: string }

    const AND: Record<string, unknown>[] = []
    if (query.status && (STATUSES as readonly string[]).includes(query.status)) {
      AND.push({ status: query.status })
    }
    if (query.mine === 'true') {
      AND.push({ OR: [{ authorId: userId }, { contributors: { some: { userId } } }] })
    }
    if (query.q) {
      AND.push({
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { pitch: { contains: query.q, mode: 'insensitive' } },
        ],
      })
    }
    if (query.categoryId) AND.push({ categoryId: query.categoryId })

    let fiches = await prisma.innovationFiche.findMany({
      where: AND.length ? { AND } : undefined,
      orderBy: { createdAt: 'desc' },
      include: ficheInclude(userId),
    })

    // Filtre périmètre organisationnel : la fiche doit être dans le sous-arbre du ref
    // demandé (LDAP + interne fusionnés) — appliqué en mémoire, hors requête Prisma,
    // car orgUnitRef n'est pas une FK (référentiel hybride, cf. ADR-0012).
    if (query.orgUnitRef) {
      const { units } = await resolveOrgUnits()
      fiches = fiches.filter((f) => f.orgUnitRef && isInSubtree(f.orgUnitRef, query.orgUnitRef!, units))
    }

    return fiches.map((f) => serializeFiche(f))
  })

  // POST /fiches — création (tout utilisateur connecté).
  app.post('/fiches', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const body = createSchema.parse(request.body)

    const orgError = await validateOrgAndCategory(body.orgUnitRef, body.categoryId, body.orgUnitRef ?? null)
    if (orgError) return reply.status(400).send({ error: orgError })

    const fiche = await prisma.innovationFiche.create({
      data: { ...body, authorId: userId },
      include: ficheInclude(userId),
    })
    return reply.status(201).send(serializeFiche(fiche))
  })

  // GET /fiches/:id — visibilité globale.
  app.get('/fiches/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }

    const fiche = await prisma.innovationFiche.findUnique({ where: { id }, include: ficheInclude(userId) })
    if (!fiche) return reply.status(404).send({ error: 'Fiche introuvable.' })
    return serializeFiche(fiche)
  })

  // PATCH /fiches/:id — auteur, co-contributeur ou admin.
  app.patch('/fiches/:id', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id } = request.params as { id: string }
    const data = editSchema.parse(request.body)

    const existing = await prisma.innovationFiche.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Fiche introuvable.' })
    if (!(await canEditFiche(existing, userId, email))) {
      return reply.status(403).send({ error: 'Vous ne pouvez pas modifier cette fiche.' })
    }

    const effectiveOrgUnitRef = data.orgUnitRef !== undefined ? data.orgUnitRef : existing.orgUnitRef
    const orgError = await validateOrgAndCategory(data.orgUnitRef, data.categoryId, effectiveOrgUnitRef)
    if (orgError) return reply.status(400).send({ error: orgError })

    const fiche = await prisma.innovationFiche.update({ where: { id }, data, include: ficheInclude(userId) })
    return serializeFiche(fiche)
  })

  // DELETE /fiches/:id — auteur ou admin.
  app.delete('/fiches/:id', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id } = request.params as { id: string }

    const existing = await prisma.innovationFiche.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Fiche introuvable.' })
    if (existing.authorId !== userId && !isAdminEmail(email)) {
      return reply.status(403).send({ error: 'Vous ne pouvez pas supprimer cette fiche.' })
    }

    await prisma.innovationFiche.delete({ where: { id } })
    return reply.status(204).send()
  })

  // POST /fiches/:id/vote — toggle (tout utilisateur connecté).
  app.post('/fiches/:id/vote', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id: ficheId } = request.params as { id: string }

    const existing = await prisma.innovationFiche.findUnique({ where: { id: ficheId } })
    if (!existing) return reply.status(404).send({ error: 'Fiche introuvable.' })

    const alreadyVoted = await prisma.innovationVote.findUnique({
      where: { ficheId_userId: { ficheId, userId } },
    })

    let result: { hasVoted: boolean; votes: number }
    if (alreadyVoted) {
      await prisma.innovationVote.delete({ where: { ficheId_userId: { ficheId, userId } } })
      result = { hasVoted: false, votes: await prisma.innovationVote.count({ where: { ficheId } }) }
    } else {
      await prisma.innovationVote.create({ data: { ficheId, userId } })
      result = { hasVoted: true, votes: await prisma.innovationVote.count({ where: { ficheId } }) }
    }
    return reply.send(result)
  })

  // POST /fiches/:id/contributors — ajouter un co-contributeur par email (auteur/contributeur/admin).
  app.post('/fiches/:id/contributors', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id: ficheId } = request.params as { id: string }
    const { email: contributorEmail } = contributorSchema.parse(request.body)

    const fiche = await prisma.innovationFiche.findUnique({ where: { id: ficheId } })
    if (!fiche) return reply.status(404).send({ error: 'Fiche introuvable.' })
    if (!(await canEditFiche(fiche, userId, email))) {
      return reply.status(403).send({ error: 'Vous ne pouvez pas gérer les contributeurs de cette fiche.' })
    }

    const contributor = await prisma.user.findUnique({
      where: { email: contributorEmail.toLowerCase() },
      select: { id: true },
    })
    if (!contributor) return reply.status(404).send({ error: 'Aucun compte avec cet email.' })
    if (contributor.id === fiche.authorId) return reply.status(400).send({ error: "L'auteur est déjà contributeur." })

    await prisma.innovationContributor.upsert({
      where: { ficheId_userId: { ficheId, userId: contributor.id } },
      create: { ficheId, userId: contributor.id },
      update: {},
    })
    await notify({
      userId: contributor.id,
      type: 'INNOVATION_CONTRIBUTOR_ADDED',
      title: 'Ajouté comme contributeur',
      body: `Vous êtes désormais co-contributeur de la fiche « ${fiche.title} ».`,
      link: `/innovation/${ficheId}`,
    })

    const updated = await prisma.innovationFiche.findUnique({ where: { id: ficheId }, include: ficheInclude(userId) })
    return reply.status(201).send(serializeFiche(updated!))
  })

  // DELETE /fiches/:id/contributors/:userId — retirer un co-contributeur (auteur/contributeur/admin).
  app.delete('/fiches/:id/contributors/:userId', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id: ficheId, userId: targetUserId } = request.params as { id: string; userId: string }

    const fiche = await prisma.innovationFiche.findUnique({ where: { id: ficheId } })
    if (!fiche) return reply.status(404).send({ error: 'Fiche introuvable.' })
    if (!(await canEditFiche(fiche, userId, email))) {
      return reply.status(403).send({ error: 'Vous ne pouvez pas gérer les contributeurs de cette fiche.' })
    }

    await prisma.innovationContributor.deleteMany({ where: { ficheId, userId: targetUserId } })
    return reply.status(204).send()
  })
}
