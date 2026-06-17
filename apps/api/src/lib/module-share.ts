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

// Rôle effectif d'un utilisateur sur une ressource : OWNER s'il en est le créateur,
// sinon le rôle de son partage, sinon null (aucun accès).
export async function resolveRole(
  module: string,
  resourceId: string,
  userId: string,
  ownerId: string,
): Promise<ModuleRole | null> {
  if (userId === ownerId) return 'OWNER'
  const share = await prisma.moduleShare.findUnique({
    where: { module_resourceId_userId: { module, resourceId, userId } },
    select: { role: true },
  })
  return share?.role ?? null
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
