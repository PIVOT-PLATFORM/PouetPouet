import type { FastifyPluginAsync } from 'fastify'
import type { ModuleRole } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { resolveRole, canManage, sharedResourceIds, deleteResourceShares } from '../lib/module-share.js'

// Socle pivot: Team is a cross-module resource owned by the user, referenced by
// Daily, Wheel, Capacity, and Scrum. This is the canonical CRUD endpoint.
// Partage (#134) : une équipe peut être partagée à un autre compte via ModuleShare
// (module='team'). VIEWER voit l'équipe ; EDITOR peut éditer le roster ; OWNER seul
// gère les partages et la suppression.

const TEAM_INCLUDE = {
  members: { orderBy: { order: 'asc' as const } },
  _count: { select: { dailySessions: true, wheelDraws: true, scrumRooms: true, capacityEvents: true } },
}

interface MemberInput {
  name: string
  role?: string | null
  fte?: number | null
  order?: number
  email?: string | null
  teamRole?: ModuleRole | null
}

export const teamRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }
    const owned = await prisma.team.findMany({
      where: { ownerId: userId },
      include: TEAM_INCLUDE,
      orderBy: { createdAt: 'asc' },
    })
    const shared = await sharedResourceIds('team', userId)
    if (shared.length === 0) return owned.map((t) => ({ ...t, role: 'OWNER' as const }))
    const roleById = new Map(shared.map((s) => [s.id, s.role]))
    const sharedTeams = await prisma.team.findMany({
      where: { id: { in: shared.map((s) => s.id) } },
      include: TEAM_INCLUDE,
      orderBy: { createdAt: 'asc' },
    })
    return [
      ...owned.map((t) => ({ ...t, role: 'OWNER' as const })),
      ...sharedTeams.map((t) => ({ ...t, role: roleById.get(t.id) ?? ('VIEWER' as const) })),
    ]
  })

  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { name, color, description, members } = request.body as {
      name: string
      color?: string
      description?: string
      members?: MemberInput[] | string[]
    }
    if (!name?.trim()) return reply.status(400).send({ error: 'Nom requis' })
    const memberList = normalizeMembers(members)
    const userIdByEmail = await resolveMemberUserIds(memberList)
    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        ownerId,
        color: color ?? '#6366f1',
        description: description?.trim() || null,
        members: { create: buildMemberCreateData(memberList, userIdByEmail) },
      },
      include: TEAM_INCLUDE,
    })
    return reply.status(201).send(team)
  })

  app.put('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const { name, color, description, members } = request.body as {
      name?: string
      color?: string
      description?: string
      members?: MemberInput[] | string[]
    }
    const existing = await prisma.team.findUnique({ where: { id }, include: { members: true } })
    if (!existing) return reply.status(404).send({ error: 'Équipe introuvable' })
    const role = await resolveRole('team', id, ownerId, existing.ownerId)
    if (!canManage(role)) return reply.status(role ? 403 : 404).send({ error: role ? 'Réservé au propriétaire ou éditeur.' : 'Équipe introuvable' })
    const memberList = mergeWithExistingMembers(normalizeMembers(members), existing.members)
    await prisma.teamMember.deleteMany({ where: { teamId: id } })
    const userIdByEmail = await resolveMemberUserIds(memberList)
    const updated = await prisma.team.update({
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        color: color ?? existing.color,
        description: description !== undefined ? (description?.trim() || null) : existing.description,
        members: { create: buildMemberCreateData(memberList, userIdByEmail) },
      },
      include: TEAM_INCLUDE,
    })
    return updated
  })

  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const existing = await prisma.team.findFirst({ where: { id, ownerId } })
    if (!existing) return reply.status(404).send({ error: 'Équipe introuvable' })
    await deleteResourceShares('team', id)
    await prisma.team.delete({ where: { id } })
    return reply.status(204).send()
  })
}

// Accept both string[] (Daily legacy: just names) and MemberInput[].
// `email: undefined` (champ absent) est préservé tel quel — il signifie « client
// qui ne gère pas ce champ », traité par mergeWithExistingMembers ; seul un email
// explicitement fourni est normalisé (null = effacement volontaire).
function normalizeMembers(members: MemberInput[] | string[] | undefined): MemberInput[] {
  if (!members) return []
  return (members as Array<string | MemberInput>).map((m) =>
    typeof m === 'string'
      ? { name: m.trim() }
      : { ...m, name: m.name.trim(), email: m.email !== undefined ? m.email?.trim().toLowerCase() || null : undefined }
  )
}

// Le PUT remplace tout le roster, mais tous les écrans qui éditent une équipe ne
// connaissent pas tous les champs d'un membre (Daily n'envoie que des noms,
// Capacité name/role/fte, Équipes name/email/teamRole). Sans fusion, chaque
// sauvegarde depuis un écran « partiel » effacerait les champs des autres
// (liens de compte, grades, poste, FTE). Règle : un champ absent du payload
// (undefined) hérite de la valeur du membre existant de même nom ; null reste
// un effacement volontaire. Membres homonymes appariés dans l'ordre ; membre
// renommé = nouveau membre (reperd son lien, à relier).
function mergeWithExistingMembers(
  memberList: MemberInput[],
  existingMembers: Array<{ name: string; role: string | null; fte: number | null; email: string | null; teamRole: ModuleRole | null }>,
): MemberInput[] {
  const pool = new Map<string, typeof existingMembers>()
  for (const m of existingMembers) {
    const list = pool.get(m.name) ?? []
    list.push(m)
    pool.set(m.name, list)
  }
  return memberList.map((m) => {
    const match = pool.get(m.name)?.shift()
    if (!match) return m
    const email = m.email !== undefined ? m.email : match.email
    return {
      ...m,
      role: m.role !== undefined ? m.role : match.role,
      fte: m.fte !== undefined ? m.fte : match.fte,
      email,
      // Le grade ne suit que si le lien (email) est inchangé — un email nouveau ou
      // modifié laisse teamRole indéfini, pour repasser par le défaut EDITOR au
      // moment de la résolution (buildMemberCreateData).
      teamRole: m.teamRole !== undefined ? m.teamRole : match.email !== null && email === match.email ? match.teamRole : undefined,
    }
  })
}

// Résolution best-effort email → compte existant (même logique que
// signdoc.routes.ts pour SignRecipient) : lie immédiatement si le compte existe
// déjà ; sinon la réconciliation inverse se fait à l'inscription (auth.ts).
async function resolveMemberUserIds(members: MemberInput[]): Promise<Map<string, string>> {
  const emails = [...new Set(members.map((m) => m.email).filter((e): e is string => !!e))]
  if (emails.length === 0) return new Map()
  // email déjà normalisé en minuscules par normalizeMembers ; User.email n'est pas
  // garanti stocké en minuscules (pas de transform à l'inscription) — comparaison
  // insensible à la casse pour rester fiable dans tous les cas.
  const users = await prisma.user.findMany({ where: { email: { in: emails, mode: 'insensitive' } }, select: { id: true, email: true } })
  return new Map(users.map((u) => [u.email.toLowerCase(), u.id]))
}

function buildMemberCreateData(memberList: MemberInput[], userIdByEmail: Map<string, string>) {
  return memberList.map((m, i) => {
    const userId = m.email ? userIdByEmail.get(m.email) ?? null : null
    return {
      name: m.name,
      role: m.role ?? null,
      fte: m.fte ?? null,
      order: m.order ?? i,
      email: m.email ?? null,
      userId,
      // Grade par défaut EDITOR dès qu'un compte est lié : un partage d'équipe doit
      // donner accès sans étape supplémentaire (sinon : notif reçue mais rien de
      // visible). `teamRole: null` explicite dans le payload = exclusion volontaire ;
      // seul `undefined` (champ absent) déclenche le défaut.
      teamRole: m.teamRole !== undefined ? m.teamRole : userId ? 'EDITOR' : null,
    }
  })
}
