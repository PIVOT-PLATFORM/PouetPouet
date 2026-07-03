import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { isAdminEmail } from '../../lib/feature-flags.js'
import { resolveOrgUnits, isInSubtree } from './innovation-org.js'

const NIVEAUX = ['COMEX', 'DIRECTION', 'DIVISION', 'DEPARTEMENT', 'EQUIPE'] as const

const createUnitSchema = z.object({
  nom: z.string().min(1).max(120),
  niveau: z.enum(NIVEAUX),
  parentId: z.string().min(1).nullable().optional(),
})
const editUnitSchema = z.object({
  nom: z.string().min(1).max(120).optional(),
  niveau: z.enum(NIVEAUX).optional(),
  parentId: z.string().min(1).nullable().optional(),
})

const createCategorySchema = z.object({
  label: z.string().min(1).max(80),
  orgUnitRef: z.string().min(1).nullable().optional(),
})
const editCategorySchema = z.object({
  label: z.string().min(1).max(80).optional(),
  orgUnitRef: z.string().min(1).nullable().optional(),
  actif: z.boolean().optional(),
  ordre: z.number().int().optional(),
})

// Un ancêtre de `unitId` (inclusif) est-il `candidateId` ? Utilisé pour bloquer les
// cycles de parenté lors d'un PATCH parentId.
async function isDescendantOrSelf(unitId: string, candidateAncestorId: string): Promise<boolean> {
  let current: { id: string; parentId: string | null } | null = await prisma.innovationOrgUnit.findUnique({ where: { id: unitId }, select: { id: true, parentId: true } })
  const seen = new Set<string>()
  while (current) {
    if (current.id === candidateAncestorId) return true
    if (seen.has(current.id)) return false
    seen.add(current.id)
    if (!current.parentId) return false
    current = await prisma.innovationOrgUnit.findUnique({ where: { id: current.parentId }, select: { id: true, parentId: true } })
  }
  return false
}

export const innovationOrgRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  // GET /org-units — arbre fusionné LDAP + interne.
  app.get('/org-units', async () => resolveOrgUnits())

  // POST /org-units — crée une unité interne (admin app uniquement).
  app.post('/org-units', async (request, reply) => {
    const { email } = request.user as { email: string }
    if (!isAdminEmail(email)) return reply.status(403).send({ error: 'Réservé aux administrateurs.' })

    const body = createUnitSchema.parse(request.body)
    if (body.parentId) {
      const parent = await prisma.innovationOrgUnit.findUnique({ where: { id: body.parentId } })
      if (!parent) return reply.status(400).send({ error: 'Unité parente introuvable.' })
    }
    const unit = await prisma.innovationOrgUnit.create({ data: { nom: body.nom, niveau: body.niveau, parentId: body.parentId ?? null } })
    return reply.status(201).send(unit)
  })

  // PATCH /org-units/:id — édite une unité interne (admin app uniquement).
  app.patch('/org-units/:id', async (request, reply) => {
    const { email } = request.user as { email: string }
    if (!isAdminEmail(email)) return reply.status(403).send({ error: 'Réservé aux administrateurs.' })

    const { id } = request.params as { id: string }
    const data = editUnitSchema.parse(request.body)
    const existing = await prisma.innovationOrgUnit.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Unité introuvable.' })

    if (data.parentId) {
      if (data.parentId === id) return reply.status(400).send({ error: 'Une unité ne peut pas être son propre parent.' })
      const parent = await prisma.innovationOrgUnit.findUnique({ where: { id: data.parentId } })
      if (!parent) return reply.status(400).send({ error: 'Unité parente introuvable.' })
      if (await isDescendantOrSelf(data.parentId, id)) {
        return reply.status(400).send({ error: 'Cette hiérarchie créerait un cycle.' })
      }
    }

    const unit = await prisma.innovationOrgUnit.update({ where: { id }, data })
    return unit
  })

  // DELETE /org-units/:id — refuse si des enfants ou des fiches/challenges y sont rattachés.
  app.delete('/org-units/:id', async (request, reply) => {
    const { email } = request.user as { email: string }
    if (!isAdminEmail(email)) return reply.status(403).send({ error: 'Réservé aux administrateurs.' })

    const { id } = request.params as { id: string }
    const existing = await prisma.innovationOrgUnit.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Unité introuvable.' })

    const childCount = await prisma.innovationOrgUnit.count({ where: { parentId: id } })
    if (childCount > 0) return reply.status(409).send({ error: 'Cette unité a des sous-unités — détachez-les d\'abord.' })

    const ref = `int:${id}`
    const [ficheCount, challengeCount] = await Promise.all([
      prisma.innovationFiche.count({ where: { orgUnitRef: ref } }),
      prisma.innovationChallenge.count({ where: { orgUnitRef: ref } }),
    ])
    if (ficheCount > 0 || challengeCount > 0) {
      return reply.status(409).send({ error: 'Des fiches ou challenges sont rattachés à cette unité.' })
    }

    await prisma.innovationOrgUnit.delete({ where: { id } })
    return reply.status(204).send()
  })

  // GET /categories?orgUnitRef= — catégories globales + celles applicables au périmètre donné
  // (héritage descendant : le ref demandé doit être dans le sous-arbre de la catégorie).
  app.get('/categories', async (request) => {
    const { orgUnitRef } = request.query as { orgUnitRef?: string }
    const categories = await prisma.innovationCategory.findMany({ where: { actif: true }, orderBy: { ordre: 'asc' } })
    if (!orgUnitRef) return categories.filter((c) => c.orgUnitRef === null)

    const { units } = await resolveOrgUnits()
    return categories.filter((c) => c.orgUnitRef === null || isInSubtree(orgUnitRef, c.orgUnitRef, units))
  })

  // POST /categories — admin app uniquement.
  app.post('/categories', async (request, reply) => {
    const { email } = request.user as { email: string }
    if (!isAdminEmail(email)) return reply.status(403).send({ error: 'Réservé aux administrateurs.' })

    const body = createCategorySchema.parse(request.body)
    if (body.orgUnitRef) {
      const { units } = await resolveOrgUnits()
      if (!units.some((u) => u.ref === body.orgUnitRef)) return reply.status(400).send({ error: 'Périmètre organisationnel introuvable.' })
    }
    const category = await prisma.innovationCategory.create({ data: { label: body.label, orgUnitRef: body.orgUnitRef ?? null } })
    return reply.status(201).send(category)
  })

  // PATCH /categories/:id — admin app uniquement.
  app.patch('/categories/:id', async (request, reply) => {
    const { email } = request.user as { email: string }
    if (!isAdminEmail(email)) return reply.status(403).send({ error: 'Réservé aux administrateurs.' })

    const { id } = request.params as { id: string }
    const data = editCategorySchema.parse(request.body)
    const existing = await prisma.innovationCategory.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Catégorie introuvable.' })

    if (data.orgUnitRef) {
      const { units } = await resolveOrgUnits()
      if (!units.some((u) => u.ref === data.orgUnitRef)) return reply.status(400).send({ error: 'Périmètre organisationnel introuvable.' })
    }
    const category = await prisma.innovationCategory.update({ where: { id }, data })
    return category
  })

  // DELETE /categories/:id — admin app uniquement (les fiches rattachées perdent juste leur catégorie).
  app.delete('/categories/:id', async (request, reply) => {
    const { email } = request.user as { email: string }
    if (!isAdminEmail(email)) return reply.status(403).send({ error: 'Réservé aux administrateurs.' })

    const { id } = request.params as { id: string }
    const existing = await prisma.innovationCategory.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Catégorie introuvable.' })

    await prisma.innovationCategory.delete({ where: { id } })
    return reply.status(204).send()
  })
}
