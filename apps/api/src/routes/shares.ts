import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { audit } from '../lib/audit.js'
import { notify } from '../lib/notify.js'
import { resolveRole, bestRole, minRole, type ModuleRole } from '../lib/module-share.js'

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
  portfolio: (id) => prisma.portfolio.findUnique({ where: { id }, select: { ownerId: true, name: true } }),
  parcourTemplate: (id) => prisma.parcourTemplate.findUnique({ where: { id }, select: { ownerId: true, name: true } }),
  parcourInstance: (id) => prisma.parcourInstance.findUnique({ where: { id }, select: { ownerId: true, title: true } }).then((r) => r ? { ownerId: r.ownerId, name: r.title } : null),
  form: (id) => prisma.form.findUnique({ where: { id }, select: { ownerId: true, title: true } }).then((r) => r ? { ownerId: r.ownerId, name: r.title } : null),
  pdf: (id) => prisma.pdfDocument.findUnique({ where: { id }, select: { ownerId: true, name: true } }),
  signdoc: (id) => prisma.signEnvelope.findUnique({ where: { id }, select: { ownerId: true, name: true } }),
  challenge: (id) => prisma.innovationChallenge.findUnique({ where: { id }, select: { ownerId: true, nom: true } }).then((c) => c ? { ownerId: c.ownerId, name: c.nom } : null),
  todolist: (id) => prisma.todoList.findUnique({ where: { id }, select: { ownerId: true, name: true } }),
  tododashboard: (id) => prisma.todoDashboard.findUnique({ where: { id }, select: { ownerId: true, name: true } }),
  pi: (id) => prisma.piCycle.findUnique({ where: { id }, select: { ownerId: true, name: true } }),
}

const MODULE_LABEL: Record<string, string> = { scrum: 'Scrum Poker', daily: 'Daily', team: 'Équipe', wheel: 'La Roue', capacity: 'Capacité', meetops: 'MeetOps', quiz: 'Quiz', roadmap: 'Roadmap', portfolio: 'Portefeuille', parcourTemplate: 'Template Parcours', parcourInstance: 'Instance Parcours', form: 'Formulaire', pdf: 'PDF Manager', signdoc: 'SignDoc', challenge: 'Challenge innovation', todolist: 'Liste de tâches', tododashboard: 'Tableau de bord To-Do', pi: 'PI Planning' }
const MODULE_LINK: Record<string, string> = { scrum: '/scrum', daily: '/daily', team: '/equipes', wheel: '/wheel', capacity: '/capacity', meetops: '/meetops', quiz: '/quiz', roadmap: '/roadmap', portfolio: '/portfolio', parcourTemplate: '/parcours/templates', parcourInstance: '/parcours/run', form: '/forms', pdf: '/pdf', signdoc: '/signdoc', challenge: '/innovation/challenges', todolist: '/todo', tododashboard: '/todo/dashboards', pi: '/pi' }

const inviteSchema = z.object({ email: z.string().email(), role: z.enum(['VIEWER', 'EDITOR']) })
const inviteTeamSchema = z.object({ teamId: z.string().min(1), role: z.enum(['VIEWER', 'EDITOR']) })
const teamShareSchema = z.object({ teamId: z.string().min(1), role: z.enum(['VIEWER', 'EDITOR']) })
const roleSchema = z.object({ role: z.enum(['VIEWER', 'EDITOR']) })

const SHARE_SELECT = {
  id: true,
  role: true,
  user: { select: { id: true, name: true, email: true, avatar: true } },
} as const

const TEAM_SHARE_SELECT = {
  id: true,
  role: true,
  team: { select: { id: true, name: true, color: true } },
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

    // Comptes concernés : owner de l'équipe + comptes avec qui l'équipe est
    // partagée (rôle demandé, sans plafond — pas membres du roster, le grade ne
    // s'applique pas à eux) + membres du roster liés à un compte (rôle demandé
    // plafonné par leur grade ; "Aucun grade" = exclusion volontaire, comme pour
    // le partage dynamique).
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { ownerId: true } })
    if (!team) return reply.status(404).send({ error: 'Équipe introuvable.' })
    const [teamShares, linkedMembers] = await Promise.all([
      prisma.moduleShare.findMany({ where: { module: 'team', resourceId: teamId }, select: { userId: true } }),
      prisma.teamMember.findMany({ where: { teamId, userId: { not: null } }, select: { userId: true, teamRole: true } }),
    ])
    const roleByUser = new Map<string, ModuleRole>()
    for (const id of [team.ownerId, ...teamShares.map((s) => s.userId)]) roleByUser.set(id, role)
    for (const m of linkedMembers) {
      const capped = minRole(role, m.teamRole)
      if (!capped) continue
      roleByUser.set(m.userId as string, bestRole(roleByUser.get(m.userId as string) ?? null, capped) as ModuleRole)
    }
    roleByUser.delete(resourceOwnerId)
    if (roleByUser.size === 0) return reply.status(200).send([])

    // Batch-upsert par rôle effectif (createMany ne gère pas l'upsert : createMany
    // skipDuplicates + updateMany pour aligner le rôle des lignes préexistantes).
    for (const effectiveRole of ['VIEWER', 'EDITOR'] as const) {
      const ids = [...roleByUser.entries()].filter(([, r]) => r === effectiveRole).map(([id]) => id)
      if (ids.length === 0) continue
      await prisma.moduleShare.createMany({
        data: ids.map((userId) => ({ module, resourceId, userId, role: effectiveRole })),
        skipDuplicates: true,
      })
      await prisma.moduleShare.updateMany({ where: { module, resourceId, userId: { in: ids } }, data: { role: effectiveRole } })
    }

    const created = await prisma.moduleShare.findMany({
      where: { module, resourceId, userId: { in: [...roleByUser.keys()] } },
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
          body: `Accès ${s.role === 'EDITOR' ? 'Éditeur' : 'Lecteur'} accordé via une équipe.`,
          link: MODULE_LINK[module] ?? null,
        }),
      ),
    )
    return reply.status(201).send(created)
  })

  // Liste des partages dynamiques par équipe — même visibilité que GET /:module/:resourceId.
  app.get('/:module/:resourceId/team-shares', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { module, resourceId } = request.params as { module: string; resourceId: string }
    const resolver = RESOLVERS[module]
    if (!resolver) return reply.status(404).send({ error: 'Module inconnu.' })
    const res = await resolver(resourceId)
    if (!res) return reply.status(404).send({ error: 'Ressource introuvable.' })
    const role = await resolveRole(module, resourceId, userId, res.ownerId)
    if (role !== 'OWNER' && role !== 'EDITOR') return reply.status(403).send({ error: 'Accès refusé.' })
    return prisma.teamModuleShare.findMany({ where: { module, resourceId }, select: TEAM_SHARE_SELECT, orderBy: { createdAt: 'asc' } })
  })

  // Partager dynamiquement à toute une équipe — contrairement à /invite-team (fan-out
  // figé), un membre relié à un compte hérite de l'accès sans réinvitation, y compris
  // s'il rejoint l'équipe après ce partage (propriétaire uniquement).
  app.post('/:module/:resourceId/team-share', { preHandler: [app.authenticate] }, async (request, reply) => {
    const owner = await loadAsOwner(request, reply)
    if (!owner) return
    const { id: userId } = request.user as { id: string }
    const { module, resourceId } = request.params as { module: string; resourceId: string }
    const { teamId, role } = teamShareSchema.parse(request.body)

    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } })
    if (!team) return reply.status(404).send({ error: 'Équipe introuvable.' })

    const share = await prisma.teamModuleShare.upsert({
      where: { module_resourceId_teamId: { module, resourceId, teamId } },
      create: { module, resourceId, teamId, role },
      update: { role },
      select: TEAM_SHARE_SELECT,
    })
    audit(userId, 'module.share.team-shared', request, `${module}:${resourceId}`)

    // Seuls les membres gradés héritent d'un accès (resolveRole plafonne par
    // teamRole) — ne pas notifier un membre explicitement sans grade, qui
    // recevrait une notif ne menant à rien.
    const linkedMembers = await prisma.teamMember.findMany({ where: { teamId, userId: { not: null }, teamRole: { not: null } }, select: { userId: true } })
    await Promise.all(
      linkedMembers.map((m) =>
        notify({
          userId: m.userId as string,
          type: 'MODULE_SHARED',
          title: `${MODULE_LABEL[module] ?? module} partagé avec vous`,
          body: `Accès ${role === 'EDITOR' ? 'Éditeur' : 'Lecteur'} accordé via l'équipe « ${share.team.name} ».`,
          link: MODULE_LINK[module] ?? null,
        }),
      ),
    )
    return reply.status(201).send(share)
  })

  // Révoquer le partage dynamique d'une équipe (propriétaire uniquement).
  app.delete('/:module/:resourceId/team-share/:teamId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const owner = await loadAsOwner(request, reply)
    if (!owner) return
    const { id: userId } = request.user as { id: string }
    const { module, resourceId, teamId } = request.params as { module: string; resourceId: string; teamId: string }
    const { count } = await prisma.teamModuleShare.deleteMany({ where: { module, resourceId, teamId } })
    if (count === 0) return reply.status(404).send({ error: 'Partage d\'équipe introuvable.' })
    audit(userId, 'module.share.team-revoked', request, `${module}:${resourceId}`)
    return reply.send({ ok: true })
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
