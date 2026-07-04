import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { isAdminEmail } from '../../lib/feature-flags.js'

const linkSchema = z.object({
  label: z.string().min(1).max(100),
  url: z.string().url().max(500),
})

async function canEditFiche(fiche: { id: string; authorId: string }, userId: string, email: string): Promise<boolean> {
  if (isAdminEmail(email)) return true
  if (fiche.authorId === userId) return true
  const contributor = await prisma.innovationContributor.findUnique({
    where: { ficheId_userId: { ficheId: fiche.id, userId } },
  })
  return !!contributor
}

// Liens externes rattachés à une fiche (distincts des pièces jointes : pas de fichier,
// juste un intitulé + une URL). Lecture ouverte à tous (fiches visibles par tous),
// ajout/suppression réservés auteur/contributeur/admin.
export const innovationLinksRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  app.get('/fiches/:id/links', async (request, reply) => {
    const { id: ficheId } = request.params as { id: string }
    const fiche = await prisma.innovationFiche.findUnique({ where: { id: ficheId } })
    if (!fiche) return reply.status(404).send({ error: 'Fiche introuvable.' })

    return prisma.innovationLink.findMany({ where: { ficheId }, orderBy: { createdAt: 'asc' } })
  })

  app.post('/fiches/:id/links', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id: ficheId } = request.params as { id: string }
    const body = linkSchema.parse(request.body)

    const fiche = await prisma.innovationFiche.findUnique({ where: { id: ficheId } })
    if (!fiche) return reply.status(404).send({ error: 'Fiche introuvable.' })
    if (!(await canEditFiche(fiche, userId, email))) {
      return reply.status(403).send({ error: 'Vous ne pouvez pas ajouter de lien à cette fiche.' })
    }

    const link = await prisma.innovationLink.create({ data: { ficheId, label: body.label, url: body.url } })
    return reply.status(201).send(link)
  })

  app.delete('/links/:linkId', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { linkId } = request.params as { linkId: string }

    const link = await prisma.innovationLink.findUnique({ where: { id: linkId } })
    if (!link) return reply.status(404).send({ error: 'Lien introuvable.' })
    const fiche = await prisma.innovationFiche.findUnique({ where: { id: link.ficheId } })
    if (!fiche) return reply.status(404).send({ error: 'Fiche introuvable.' })
    if (!(await canEditFiche(fiche, userId, email))) {
      return reply.status(403).send({ error: 'Vous ne pouvez pas supprimer ce lien.' })
    }

    await prisma.innovationLink.delete({ where: { id: linkId } })
    return reply.status(204).send()
  })
}
