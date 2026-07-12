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
export function minRole(a: ModuleRole, b: ModuleRole | null): ModuleRole | null {
  if (!b) return null
  return RANK[a] <= RANK[b] ? a : b
}

async function teamMemberships(userId: string): Promise<{ teamId: string; teamRole: ModuleRole | null }[]> {
  return prisma.teamMember.findMany({ where: { userId }, select: { teamId: true, teamRole: true } })
}

// Rôle hérité des équipes dont l'utilisateur est membre relié (TeamMember.userId),
// pour une ressource donnée. Le partage d'équipe (TeamModuleShare) donne un rôle
// de base, plafonné par le grade du membre dans l'équipe (TeamMember.teamRole) —
// un membre non gradé (teamRole=null) n'hérite de rien tant qu'un grade ne lui a
// pas été attribué.
async function teamDerivedRole(module: string, resourceId: string, userId: string): Promise<ModuleRole | null> {
  const memberships = await teamMemberships(userId)
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

// Même logique que teamDerivedRole, mais pour toutes les ressources d'un module
// d'un coup (liste) — utilisé par sharedResourceIds pour que les ressources
// partagées dynamiquement à une équipe apparaissent dans les listes (ex.
// GET /api/daily/sessions), pas seulement en accès direct par id.
async function teamDerivedResourceRoles(module: string, userId: string): Promise<Map<string, ModuleRole>> {
  const memberships = await teamMemberships(userId)
  if (memberships.length === 0) return new Map()
  const teamShares = await prisma.teamModuleShare.findMany({
    where: { module, teamId: { in: memberships.map((m) => m.teamId) } },
    select: { resourceId: true, teamId: true, role: true },
  })
  const teamRoleByTeamId = new Map(memberships.map((m) => [m.teamId, m.teamRole]))
  const byResource = new Map<string, ModuleRole>()
  for (const share of teamShares) {
    const capped = minRole(share.role, teamRoleByTeamId.get(share.teamId) ?? null)
    if (!capped) continue
    byResource.set(share.resourceId, bestRole(byResource.get(share.resourceId) ?? null, capped) as ModuleRole)
  }
  return byResource
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

// Ressources d'un module partagées avec l'utilisateur (ne possède pas) — partage
// individuel (ModuleShare) et partage dynamique par équipe (TeamModuleShare) combinés.
export async function sharedResourceIds(module: string, userId: string): Promise<{ id: string; role: ModuleRole }[]> {
  const [shares, teamRoles] = await Promise.all([
    prisma.moduleShare.findMany({ where: { module, userId }, select: { resourceId: true, role: true } }),
    teamDerivedResourceRoles(module, userId),
  ])
  const merged = new Map<string, ModuleRole>()
  for (const s of shares) merged.set(s.resourceId, s.role)
  for (const [resourceId, role] of teamRoles) {
    merged.set(resourceId, bestRole(merged.get(resourceId) ?? null, role) as ModuleRole)
  }
  return [...merged.entries()].map(([id, role]) => ({ id, role }))
}

// Nettoyage des partages à la suppression d'une ressource (pas de FK polymorphe) —
// partages individuels et partages dynamiques par équipe.
export async function deleteResourceShares(module: string, resourceId: string): Promise<void> {
  await Promise.all([
    prisma.moduleShare.deleteMany({ where: { module, resourceId } }),
    prisma.teamModuleShare.deleteMany({ where: { module, resourceId } }),
  ])
}
