import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'

// Socle pivot: expose Team as a cross-module resource.
// Teams are owned by any module (Daily, Capacity) but referenced by others (Scrum, Wheel).
// This route provides the canonical read-only listing used when a module needs to
// reference a team without duplicating team management UI.

export const teamRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const { id: ownerId } = request.user as { id: string }
    return prisma.team.findMany({
      where: { ownerId },
      select: { id: true, name: true, color: true, description: true },
      orderBy: { createdAt: 'asc' },
    })
  })
}
