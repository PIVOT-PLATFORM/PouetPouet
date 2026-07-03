import { prisma } from '../../lib/prisma.js'
import { isAdminEmail } from '../../lib/feature-flags.js'
import { resolveRole, canManage } from '../../lib/module-share.js'

// Propriétaire, éditeur partagé (ModuleShare) ou admin de l'app : seuls habilités à
// administrer un challenge (édition, transitions, critères, jurés, lauréats). Partagé
// entre challenge.routes.ts et scoring.routes.ts.
export async function canManageChallenge(challenge: { id: string; ownerId: string }, userId: string, email: string): Promise<boolean> {
  if (isAdminEmail(email)) return true
  const role = await resolveRole('challenge', challenge.id, userId, challenge.ownerId)
  return canManage(role)
}

export async function isJuror(challengeId: string, userId: string): Promise<boolean> {
  const juror = await prisma.challengeJuror.findUnique({ where: { challengeId_userId: { challengeId, userId } } })
  return !!juror
}
