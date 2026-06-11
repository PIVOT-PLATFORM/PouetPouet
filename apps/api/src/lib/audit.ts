import type { FastifyRequest } from 'fastify'
import { prisma } from './prisma.js'

// Journal des actions sensibles du compte. Fire-and-forget : un échec
// d'écriture ne doit jamais bloquer l'action auditée.
export function audit(
  userId: string,
  action: string,
  request?: FastifyRequest,
  resource?: string,
): void {
  void prisma.auditLog
    .create({
      data: {
        userId,
        action,
        resource: resource ?? null,
        ip: request?.ip ?? null,
        userAgent: (request?.headers['user-agent'] as string | undefined)?.slice(0, 255) ?? null,
      },
    })
    .catch(() => {})
}
