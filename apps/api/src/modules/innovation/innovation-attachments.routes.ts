import type { FastifyPluginAsync } from 'fastify'
import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { isAdminEmail } from '../../lib/feature-flags.js'
import { getUploadSignedUrl, getDownloadSignedUrl, deleteStorageFile } from '../../lib/storage.js'

const IMAGE_VIDEO_LIMIT = 20 * 1024 * 1024 // 20 Mo — images/texte/PDF
const VIDEO_LIMIT = 100 * 1024 * 1024 // 100 Mo — vidéo, cf. FILE_LIMIT du module SignDoc

function isAllowedMime(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType === 'application/pdf' || mimeType === 'text/plain'
}

function maxSizeFor(mimeType: string): number {
  return mimeType.startsWith('video/') ? VIDEO_LIMIT : IMAGE_VIDEO_LIMIT
}

const uploadUrlSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(127),
})

const registerSchema = z.object({
  storageKey: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(127),
  sizeBytes: z.number().int().positive(),
})

async function canEditFiche(fiche: { id: string; authorId: string }, userId: string, email: string): Promise<boolean> {
  if (isAdminEmail(email)) return true
  if (fiche.authorId === userId) return true
  const contributor = await prisma.innovationContributor.findUnique({
    where: { ficheId_userId: { ficheId: fiche.id, userId } },
  })
  return !!contributor
}

function serializeAttachment(a: { id: string; ficheId: string; filename: string; mimeType: string; sizeBytes: number; createdAt: Date; uploader: { id: string; name: string } }) {
  return {
    id: a.id,
    ficheId: a.ficheId,
    filename: a.filename,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    uploader: a.uploader,
    createdAt: a.createdAt,
  }
}

// Pièces jointes (texte/image/vidéo) sur une fiche innovation. Réutilise l'abstraction
// GCS signed-URL déjà en place (storage.ts, pattern ParcourDocument) : le client upload
// directement les octets vers GCS (ou .uploads/ en dev local), l'API ne stocke que les
// métadonnées. Upload/suppression réservés à canEditFiche ; lecture ouverte à tous
// (fiches visibles par tous, cf. innovation.routes.ts).
export const innovationAttachmentsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  app.post('/fiches/:id/attachments/upload-url', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id: ficheId } = request.params as { id: string }
    const { filename, mimeType } = uploadUrlSchema.parse(request.body)

    const fiche = await prisma.innovationFiche.findUnique({ where: { id: ficheId } })
    if (!fiche) return reply.status(404).send({ error: 'Fiche introuvable.' })
    if (!(await canEditFiche(fiche, userId, email))) {
      return reply.status(403).send({ error: 'Vous ne pouvez pas ajouter de pièce jointe à cette fiche.' })
    }
    if (!isAllowedMime(mimeType)) return reply.status(400).send({ error: 'Type de fichier non autorisé.' })

    const ext = filename.split('.').pop() ?? 'bin'
    const key = `innovation/${ficheId}/${crypto.randomUUID()}.${ext}`
    const uploadUrl = await getUploadSignedUrl(key, mimeType)
    return { uploadUrl, key }
  })

  app.post('/fiches/:id/attachments', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id: ficheId } = request.params as { id: string }
    const body = registerSchema.parse(request.body)

    const fiche = await prisma.innovationFiche.findUnique({ where: { id: ficheId } })
    if (!fiche) return reply.status(404).send({ error: 'Fiche introuvable.' })
    if (!(await canEditFiche(fiche, userId, email))) {
      return reply.status(403).send({ error: 'Vous ne pouvez pas ajouter de pièce jointe à cette fiche.' })
    }
    if (!isAllowedMime(body.mimeType)) return reply.status(400).send({ error: 'Type de fichier non autorisé.' })
    if (body.sizeBytes > maxSizeFor(body.mimeType)) return reply.status(400).send({ error: 'Fichier trop volumineux.' })

    const attachment = await prisma.innovationAttachment.create({
      data: {
        ficheId,
        filename: body.filename,
        mimeType: body.mimeType,
        storageKey: body.storageKey,
        sizeBytes: body.sizeBytes,
        uploadedBy: userId,
      },
      include: { uploader: { select: { id: true, name: true } } },
    })
    return reply.status(201).send(serializeAttachment(attachment))
  })

  app.get('/fiches/:id/attachments', async (request, reply) => {
    const { id: ficheId } = request.params as { id: string }
    const fiche = await prisma.innovationFiche.findUnique({ where: { id: ficheId } })
    if (!fiche) return reply.status(404).send({ error: 'Fiche introuvable.' })

    const attachments = await prisma.innovationAttachment.findMany({
      where: { ficheId },
      orderBy: { createdAt: 'asc' },
      include: { uploader: { select: { id: true, name: true } } },
    })
    return attachments.map(serializeAttachment)
  })

  app.get('/attachments/:attachmentId/url', async (request, reply) => {
    const { attachmentId } = request.params as { attachmentId: string }
    const attachment = await prisma.innovationAttachment.findUnique({ where: { id: attachmentId } })
    if (!attachment) return reply.status(404).send({ error: 'Pièce jointe introuvable.' })

    const url = await getDownloadSignedUrl(attachment.storageKey)
    return { url, filename: attachment.filename, mimeType: attachment.mimeType }
  })

  app.delete('/attachments/:attachmentId', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { attachmentId } = request.params as { attachmentId: string }

    const attachment = await prisma.innovationAttachment.findUnique({ where: { id: attachmentId } })
    if (!attachment) return reply.status(404).send({ error: 'Pièce jointe introuvable.' })
    const fiche = await prisma.innovationFiche.findUnique({ where: { id: attachment.ficheId } })
    if (!fiche) return reply.status(404).send({ error: 'Fiche introuvable.' })

    const isUploader = attachment.uploadedBy === userId
    if (!isUploader && !(await canEditFiche(fiche, userId, email))) {
      return reply.status(403).send({ error: 'Vous ne pouvez pas supprimer cette pièce jointe.' })
    }

    await prisma.innovationAttachment.delete({ where: { id: attachmentId } })
    await deleteStorageFile(attachment.storageKey)
    return reply.status(204).send()
  })
}
