import { prisma } from './prisma.js'
import type { ModuleRole } from '@prisma/client'

export type { ModuleRole }

const RANK: Record<ModuleRole, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 }

// Peut piloter / muter la ressource (équivalent EDITOR+ ; le Lecteur est en lecture seule).
export function canManage(role: ModuleRole | null): boolean {
  return role === 'OWNER' || role === 'EDITOR'
}

export function atLeast(role: ModuleRole | null, min: ModuleRole): boolean {
  return role != null && RANK[role] >= RANK[min]
}

// Le meilleur des deux rôles (utile pour combiner un accès direct et un accès
// transitif, ex. Portfolio → Roadmap).
export function bestRole(a: ModuleRole | null, b: ModuleRole | null): ModuleRole | null {
  if (!a) return b
  if (!b) return a
  return RANK[a] >= RANK[b] ? a : b
}

// Le moins élevé des deux rôles (plafonnement) — null = aucun accès (contrairement
// à bestRole où null signifie "source absente, ignorer").
function minRole(a: ModuleRole, b: ModuleRole | null): ModuleRole | null {
  if (!b) return null
  return RANK[a] <= RANK[b] ? a : b
}

// Rôle hérité des équipes dont l'utilisateur est membre relié (TeamMember.userId).
// Le partage d'équipe (TeamModuleShare) donne un rôle de base, plafonné par le
// grade du membre dans l'équipe (TeamMember.teamRole) — un membre non gradé
// (teamRole=null) n'hérite de rien tant qu'un grade ne lui a pas été attribué.
async function teamDerivedRole(module: string, resourceId: string, userId: string): Promise<ModuleRole | null> {
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true, teamRole: true },
  })
  if (memberships.length === 0) return null
  const teamShares = await prisma.teamModuleShare.findMany({
    where: { module, resourceId, teamId: { in: memberships.map((m) => m.teamId) } },
    select: { teamId: true, role: true },
  })
  const teamRoleByTeamId = new Map(memberships.map((m) => [m.teamId, m.teamRole]))
  let best: ModuleRole | null = null
  for (const share of teamShares) {
    best = bestRole(best, minRole(share.role, teamRoleByTeamId.get(share.teamId) ?? null))
  }
  return best
}

// Rôle effectif d'un utilisateur sur une ressource : OWNER s'il en est le créateur,
// sinon le meilleur entre son partage individuel et son rôle hérité d'une équipe,
// sinon null (aucun accès).
export async function resolveRole(
  module: string,
  resourceId: string,
  userId: string,
  ownerId: string,
): Promise<ModuleRole | null> {
  if (userId === ownerId) return 'OWNER'
  const [share, teamRole] = await Promise.all([
    prisma.moduleShare.findUnique({
      where: { module_resourceId_userId: { module, resourceId, userId } },
      select: { role: true },
    }),
    teamDerivedRole(module, resourceId, userId),
  ])
  return bestRole(share?.role ?? null, teamRole)
}

// Ressources d'un module partagées avec l'utilisateur (ne possède pas).
export async function sharedResourceIds(module: string, userId: string): Promise<{ id: string; role: ModuleRole }[]> {
  const shares = await prisma.moduleShare.findMany({
    where: { module, userId },
    select: { resourceId: true, role: true },
  })
  return shares.map((s) => ({ id: s.resourceId, role: s.role }))
}

// Nettoyage des partages à la suppression d'une ressource (pas de FK polymorphe).
export async function deleteResourceShares(module: string, resourceId: string): Promise<void> {
  await prisma.moduleShare.deleteMany({ where: { module, resourceId } })
}
