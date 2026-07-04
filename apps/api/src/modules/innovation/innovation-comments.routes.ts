import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { isAdminEmail } from '../../lib/feature-flags.js'
import { notify } from '../../lib/notify.js'

const bodySchema = z.object({ body: z.string().min(1).max(2000) })

function serializeComment(c: { id: string; ficheId: string; body: string; createdAt: Date; updatedAt: Date; author: { id: string; name: string } }) {
  return {
    id: c.id,
    ficheId: c.ficheId,
    body: c.body,
    author: c.author,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

// Fil de discussion à plat sur une fiche innovation (visible par tous, cf. modèle de
// publication de innovation.routes.ts). Postable par tout utilisateur connecté ;
// édition réservée à l'auteur du commentaire, suppression auteur ou admin (modération).
export const innovationCommentsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  app.get('/fiches/:id/comments', async (request, reply) => {
    const { id: ficheId } = request.params as { id: string }
    const fiche = await prisma.innovationFiche.findUnique({ where: { id: ficheId } })
    if (!fiche) return reply.status(404).send({ error: 'Fiche introuvable.' })

    const comments = await prisma.innovationComment.findMany({
      where: { ficheId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true } } },
    })
    return comments.map(serializeComment)
  })

  app.post('/fiches/:id/comments', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id: ficheId } = request.params as { id: string }
    const { body } = bodySchema.parse(request.body)

    const fiche = await prisma.innovationFiche.findUnique({
      where: { id: ficheId },
      include: { contributors: { select: { userId: true } } },
    })
    if (!fiche) return reply.status(404).send({ error: 'Fiche introuvable.' })

    const comment = await prisma.innovationComment.create({
      data: { ficheId, authorId: userId, body },
      include: { author: { select: { id: true, name: true } } },
    })

    const recipients = new Set([fiche.authorId, ...fiche.contributors.map((c) => c.userId)])
    recipients.delete(userId)
    for (const recipientId of recipients) {
      await notify({
        userId: recipientId,
        type: 'INNOVATION_FICHE_COMMENTED',
        title: 'Nouveau commentaire',
        body: `${comment.author.name} a commenté la fiche « ${fiche.title} ».`,
        link: `/innovation/${ficheId}`,
      })
    }

    return reply.status(201).send(serializeComment(comment))
  })

  app.patch('/fiches/:id/comments/:commentId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id: ficheId, commentId } = request.params as { id: string; commentId: string }
    const { body } = bodySchema.parse(request.body)

    const existing = await prisma.innovationComment.findUnique({ where: { id: commentId } })
    if (!existing || existing.ficheId !== ficheId) return reply.status(404).send({ error: 'Commentaire introuvable.' })
    if (existing.authorId !== userId) return reply.status(403).send({ error: 'Vous ne pouvez modifier que vos propres commentaires.' })

    const comment = await prisma.innovationComment.update({
      where: { id: commentId },
      data: { body },
      include: { author: { select: { id: true, name: true } } },
    })
    return serializeComment(comment)
  })

  app.delete('/fiches/:id/comments/:commentId', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id: ficheId, commentId } = request.params as { id: string; commentId: string }

    const existing = await prisma.innovationComment.findUnique({ where: { id: commentId } })
    if (!existing || existing.ficheId !== ficheId) return reply.status(404).send({ error: 'Commentaire introuvable.' })
    if (existing.authorId !== userId && !isAdminEmail(email)) {
      return reply.status(403).send({ error: 'Vous ne pouvez pas supprimer ce commentaire.' })
    }

    await prisma.innovationComment.delete({ where: { id: commentId } })
    return reply.status(204).send()
  })
}
