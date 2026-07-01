import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { audit } from '../lib/audit.js'
import { notify } from '../lib/notify.js'
import { resolveRole } from '../lib/module-share.js'

// Résolveur par module : (resourceId) → { ownerId, name } | null. Étendre ici pour
// ouvrir le partage à un nouveau module.
type ResourceInfo = { ownerId: string; name: string }
const RESOLVERS: Record<string, (id: string) => Promise<ResourceInfo | null>> = {
  scrum: (id) => prisma.scrumRoom.findUnique({ where: { id }, select: { ownerId: true, name: true } }),
  daily: (id) => prisma.dailySession.findUnique({ where: { id }, select: { ownerId: true, name: true } }),
  team: (id) => prisma.team.findUnique({ where: { id }, select: { ownerId: true, name: true } }),
  wheel: (id) => prisma.wheelEvent.findUnique({ where: { id }, select: { ownerId: true, name: true } }),
  capacity: (id) => prisma.capacityEvent.findUnique({ where: { id }, select: { ownerId: true, name: true } }),
  meetops: (id) => prisma.meetEvent.findUnique({ where: { id }, select: { ownerId: true, name: true } }),
  quiz: (id) => prisma.quiz.findUnique({ where: { id }, select: { ownerId: true, title: true } }).then((q) => q ? { ownerId: q.ownerId, name: q.title } : null),
  roadmap: (id) => prisma.roadmap.findUnique({ where: { id }, select: { ownerId: true, name: true } }),
  parcourTemplate: (id) => prisma.parcourTemplate.findUnique({ where: { id }, select: { ownerId: true, name: true } }),
  parcourInstance: (id) => prisma.parcourInstance.findUnique({ where: { id }, select: { ownerId: true, title: true } }).then((r) => r ? { ownerId: r.ownerId, name: r.title } : null),
  form: (id) => prisma.form.findUnique({ where: { id }, select: { ownerId: true, title: true } }).then((r) => r ? { ownerId: r.ownerId, name: r.title } : null),
  pdf: (id) => prisma.pdfDocument.findUnique({ where: { id }, select: { ownerId: true, name: true } }),
}

const MODULE_LABEL: Record<string, string> = { scrum: 'Scrum Poker', daily: 'Daily', team: 'Équipe', wheel: 'La Roue', capacity: 'Capacité', meetops: 'MeetOps', quiz: 'Quiz', roadmap: 'Roadmap', parcourTemplate: 'Template Parcours', parcourInstance: 'Instance Parcours', form: 'Formulaire', pdf: 'PDF Manager' }
const MODULE_LINK: Record<string, string> = { scrum: '/scrum', daily: '/daily', team: '/equipes', wheel: '/wheel', capacity: '/capacity', meetops: '/meetops', quiz: '/quiz', roadmap: '/roadmap', parcourTemplate: '/parcours/templates', parcourInstance: '/parcours/run', form: '/forms', pdf: '/pdf' }

const inviteSchema = z.object({ email: z.string().email(), role: z.enum(['VIEWER', 'EDITOR']) })
const inviteTeamSchema = z.object({ teamId: z.string().min(1), role: z.enum(['VIEWER', 'EDITOR']) })
const roleSchema = z.object({ role: z.enum(['VIEWER', 'EDITOR']) })

const SHARE_SELECT = {
  id: true,
  role: true,
  user: { select: { id: true, name: true, email: true, avatar: true } },
} as const

export const shareRoutes: FastifyPluginAsync = async (app) => {
  // Charge la ressource et vérifie que l'appelant en est le propriétaire.
  async function loadAsOwner(request: FastifyRequest, reply: FastifyReply): Promise<ResourceInfo | null> {
    const { id: userId } = request.user as { id: string }
    const { module, resourceId } = request.params as { module: string; resourceId: string }
    const resolver = RESOLVERS[module]
    if (!resolver) { reply.status(404).send({ error: 'Module inconnu.' }); return null }
    const res = await resolver(resourceId)
    if (!res) { reply.status(404).send({ error: 'Ressource introuvable.' }); return null }
    if (res.ownerId !== userId) { reply.status(403).send({ error: 'Réservé au propriétaire.' }); return null }
    return res
  }

  // Liste des partages — visible par le propriétaire ou un éditeur.
  app.get('/:module/:resourceId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { module, resourceId } = request.params as { module: string; resourceId: string }
    const resolver = RESOLVERS[module]
    if (!resolver) return reply.status(404).send({ error: 'Module inconnu.' })
    const res = await resolver(resourceId)
    if (!res) return reply.status(404).send({ error: 'Ressource introuvable.' })
    const role = await resolveRole(module, resourceId, userId, res.ownerId)
    if (role !== 'OWNER' && role !== 'EDITOR') return reply.status(403).send({ error: 'Accès refusé.' })
    return prisma.moduleShare.findMany({ where: { module, resourceId }, select: SHARE_SELECT, orderBy: { createdAt: 'asc' } })
  })

  // Inviter par email (propriétaire uniquement).
  app.post('/:module/:resourceId/invite', { preHandler: [app.authenticate] }, async (request, reply) => {
    const owner = await loadAsOwner(request, reply)
    if (!owner) return
    const { id: userId } = request.user as { id: string }
    const { module, resourceId } = request.params as { module: string; resourceId: string }
    const { email, role } = inviteSchema.parse(request.body)

    const invitee = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } })
    if (!invitee) return reply.status(404).send({ error: 'Aucun compte avec cet email.' })
    if (invitee.id === owner.ownerId) return reply.status(400).send({ error: 'Le propriétaire a déjà tous les droits.' })

    const share = await prisma.moduleShare.upsert({
      where: { module_resourceId_userId: { module, resourceId, userId: invitee.id } },
      create: { module, resourceId, userId: invitee.id, role },
      update: { role },
      select: SHARE_SELECT,
    })
    audit(userId, 'module.share.invited', request, `${module}:${resourceId}`)
    await notify({
      userId: invitee.id,
      type: 'MODULE_SHARED',
      title: `${MODULE_LABEL[module] ?? module} partagé avec vous`,
      body: `« ${owner.name} » vous a donné le rôle ${role === 'EDITOR' ? 'Éditeur' : 'Lecteur'}.`,
      link: MODULE_LINK[module] ?? null,
    })
    return reply.status(201).send(share)
  })

  // Inviter tous les membres d'une équipe en lot (propriétaire uniquement).
  app.post('/:module/:resourceId/invite-team', { preHandler: [app.authenticate] }, async (request, reply) => {
    const owner = await loadAsOwner(request, reply)
    if (!owner) return
    const { id: resourceOwnerId } = request.user as { id: string }
    const { module, resourceId } = request.params as { module: string; resourceId: string }
    const { teamId, role } = inviteTeamSchema.parse(request.body)

    // Collect user accounts with access to the team: team owner + shared users.
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { ownerId: true } })
    if (!team) return reply.status(404).send({ error: 'Équipe introuvable.' })
    const teamShares = await prisma.moduleShare.findMany({ where: { module: 'team', resourceId: teamId }, select: { userId: true } })
    const userIds = [...new Set([team.ownerId, ...teamShares.map((s) => s.userId)])].filter((id) => id !== resourceOwnerId)
    if (userIds.length === 0) return reply.status(200).send([])

    // Batch-upsert shares for the target resource.
    await prisma.moduleShare.createMany({
      data: userIds.map((userId) => ({ module, resourceId, userId, role })),
      skipDuplicates: true,
    })
    // createMany doesn't support upsert on conflicts; use updateMany to set role on existing rows.
    await prisma.moduleShare.updateMany({ where: { module, resourceId, userId: { in: userIds } }, data: { role } })

    const created = await prisma.moduleShare.findMany({
      where: { module, resourceId, userId: { in: userIds } },
      select: SHARE_SELECT,
      orderBy: { createdAt: 'asc' },
    })
    audit(resourceOwnerId, 'module.share.team-invited', request, `${module}:${resourceId}`)
    await Promise.all(
      created.map((s) =>
        notify({
          userId: s.user.id,
          type: 'MODULE_SHARED',
          title: `${MODULE_LABEL[module] ?? module} partagé avec vous`,
          body: `Accès ${role === 'EDITOR' ? 'Éditeur' : 'Lecteur'} accordé via une équipe.`,
          link: MODULE_LINK[module] ?? null,
        }),
      ),
    )
    return reply.status(201).send(created)
  })

  // Changer le rôle d'un partage (propriétaire uniquement).
  app.patch('/:module/:resourceId/:shareId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const owner = await loadAsOwner(request, reply)
    if (!owner) return
    const { id: userId } = request.user as { id: string }
    const { module, resourceId, shareId } = request.params as { module: string; resourceId: string; shareId: string }
    const { role } = roleSchema.parse(request.body)
    const { count } = await prisma.moduleShare.updateMany({ where: { id: shareId, module, resourceId }, data: { role } })
    if (count === 0) return reply.status(404).send({ error: 'Partage introuvable.' })
    audit(userId, 'module.share.updated', request, `${module}:${resourceId}`)
    return reply.send({ ok: true })
  })

  // Révoquer un partage (propriétaire uniquement).
  app.delete('/:module/:resourceId/:shareId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const owner = await loadAsOwner(request, reply)
    if (!owner) return
    const { id: userId } = request.user as { id: string }
    const { module, resourceId, shareId } = request.params as { module: string; resourceId: string; shareId: string }
    const { count } = await prisma.moduleShare.deleteMany({ where: { id: shareId, module, resourceId } })
    if (count === 0) return reply.status(404).send({ error: 'Partage introuvable.' })
    audit(userId, 'module.share.revoked', request, `${module}:${resourceId}`)
    return reply.send({ ok: true })
  })
}
