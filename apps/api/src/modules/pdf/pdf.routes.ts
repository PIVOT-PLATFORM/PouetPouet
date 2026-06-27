import type { FastifyPluginAsync } from 'fastify'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { PDFDocument, degrees } from 'pdf-lib'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'

// ── Stockage local ─────────────────────────────────────────────────────────────
// En production, envisager GCS ou S3. Pour l'auto-hébergement Docker, un volume
// persistant monté sur UPLOAD_DIR suffit.
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? './uploads/pdfs')
mkdirSync(UPLOAD_DIR, { recursive: true })

function filePath(id: string) {
  return path.join(UPLOAD_DIR, `${id}.pdf`)
}

async function loadPdfBytes(id: string): Promise<Buffer> {
  return readFileSync(filePath(id))
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} o`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`
  return `${(b / 1024 / 1024).toFixed(1)} Mo`
}

const FILE_LIMIT = 100 * 1024 * 1024 // 100 Mo

// ── Plugin ────────────────────────────────────────────────────────────────────
export const pdfRoutes: FastifyPluginAsync = async (app) => {

  // @fastify/multipart : uniquement dans ce plugin scope
  await app.register(import('@fastify/multipart'), {
    limits: { fileSize: FILE_LIMIT },
  })

  // ── Liste ──────────────────────────────────────────────────────────────────
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const { id: ownerId } = request.user as { id: string }
    const docs = await prisma.pdfDocument.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    })
    return docs.map(d => ({ ...d, sizeLabel: formatBytes(d.size) }))
  })

  // ── Détail ─────────────────────────────────────────────────────────────────
  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId } })
    if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })
    return { ...doc, sizeLabel: formatBytes(doc.size) }
  })

  // ── Servir le fichier brut (pour pdfjs côté client) ────────────────────────
  app.get('/:id/file', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId } })
    if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })
    const fp = filePath(id)
    if (!existsSync(fp)) return reply.status(404).send({ error: 'Fichier manquant sur le disque.' })
    reply.header('Content-Type', 'application/pdf')
    reply.header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}.pdf`)
    reply.header('Content-Length', statSync(fp).size)
    return reply.send(createReadStream(fp))
  })

  // ── Upload ─────────────────────────────────────────────────────────────────
  app.post('/upload', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'Fichier manquant.' })
    if (!data.filename.toLowerCase().endsWith('.pdf') && data.mimetype !== 'application/pdf') {
      return reply.status(400).send({ error: 'Seuls les fichiers PDF sont acceptés.' })
    }

    // Sauvegarde temporaire
    const tmp = path.join(tmpdir(), `pdf-upload-${Date.now()}.pdf`)
    await pipeline(data.file, createWriteStream(tmp))

    let pageCount = 0
    const bytes = readFileSync(tmp)
    const size = bytes.length
    try {
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
      pageCount = pdfDoc.getPageCount()
    } catch {
      return reply.status(422).send({ error: 'Impossible de lire le PDF (corrompu ou chiffré).' })
    }

    const cleanName = data.filename.replace(/\.pdf$/i, '').trim() || 'Document'
    const record = await prisma.pdfDocument.create({
      data: { ownerId, name: cleanName, pageCount, size },
    })
    renameSync(tmp, filePath(record.id))
    return reply.status(201).send({ ...record, sizeLabel: formatBytes(size) })
  })

  // ── Renommer ───────────────────────────────────────────────────────────────
  app.patch('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { name } = z.object({ name: z.string().min(1).max(200) }).parse(request.body)
    const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId } })
    if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })
    const updated = await prisma.pdfDocument.update({ where: { id }, data: { name } })
    return { ...updated, sizeLabel: formatBytes(updated.size) }
  })

  // ── Supprimer ──────────────────────────────────────────────────────────────
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId } })
    if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })
    await prisma.pdfDocument.delete({ where: { id } })
    const fp = filePath(id)
    if (existsSync(fp)) {
      try { unlinkSync(fp) } catch {}
    }
    return reply.status(204).send()
  })

  // ── Fusionner ──────────────────────────────────────────────────────────────
  app.post('/merge', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { ids, name } = z.object({
      ids:  z.array(z.string()).min(2).max(30),
      name: z.string().min(1).max(200),
    }).parse(request.body)

    const docs = await prisma.pdfDocument.findMany({ where: { id: { in: ids }, ownerId } })
    if (docs.length !== ids.length) return reply.status(404).send({ error: 'Un ou plusieurs PDFs introuvables.' })

    const merged = await PDFDocument.create()
    for (const docId of ids) {
      const bytes = await loadPdfBytes(docId)
      const src = await PDFDocument.load(bytes)
      const pages = await merged.copyPages(src, src.getPageIndices())
      pages.forEach(p => merged.addPage(p))
    }

    const outBytes = await merged.save()
    const record = await prisma.pdfDocument.create({
      data: { ownerId, name, pageCount: merged.getPageCount(), size: outBytes.length },
    })
    writeFileSync(filePath(record.id), outBytes)
    return reply.status(201).send({ ...record, sizeLabel: formatBytes(outBytes.length) })
  })

  // ── Extraire des pages → nouveau PDF ──────────────────────────────────────
  app.post('/:id/extract', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { pages, name } = z.object({
      pages: z.array(z.number().int().min(0)).min(1),
      name:  z.string().min(1).max(200),
    }).parse(request.body)

    const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId } })
    if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })

    const bytes = await loadPdfBytes(id)
    const src = await PDFDocument.load(bytes)
    const valid = pages.filter(p => p >= 0 && p < src.getPageCount())
    if (valid.length === 0) return reply.status(400).send({ error: 'Aucune page valide sélectionnée.' })

    const newDoc = await PDFDocument.create()
    const copied = await newDoc.copyPages(src, valid)
    copied.forEach(p => newDoc.addPage(p))

    const outBytes = await newDoc.save()
    const record = await prisma.pdfDocument.create({
      data: { ownerId, name, pageCount: newDoc.getPageCount(), size: outBytes.length },
    })
    writeFileSync(filePath(record.id), outBytes)
    return reply.status(201).send({ ...record, sizeLabel: formatBytes(outBytes.length) })
  })

  // ── Réordonner / supprimer des pages (mutates in-place) ───────────────────
  // `pages` = liste d'indices 0-based dans le NOUVEL ordre.
  // Omettre un indice = supprimer la page.
  app.post('/:id/reorder', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { pages } = z.object({
      pages: z.array(z.number().int().min(0)).min(1),
    }).parse(request.body)

    const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId } })
    if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })

    const bytes = await loadPdfBytes(id)
    const src = await PDFDocument.load(bytes)
    const total = src.getPageCount()
    const valid = pages.filter(p => p >= 0 && p < total)
    if (valid.length === 0) return reply.status(400).send({ error: 'Aucune page valide.' })

    const newDoc = await PDFDocument.create()
    const copied = await newDoc.copyPages(src, valid)
    copied.forEach(p => newDoc.addPage(p))

    const outBytes = await newDoc.save()
    writeFileSync(filePath(id), outBytes)

    const updated = await prisma.pdfDocument.update({
      where: { id },
      data: { pageCount: newDoc.getPageCount(), size: outBytes.length },
    })
    return { ...updated, sizeLabel: formatBytes(outBytes.length) }
  })

  // ── Rotation de pages (mutates in-place) ──────────────────────────────────
  app.post('/:id/rotate', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { pages, deg } = z.object({
      pages: z.array(z.number().int().min(0)),
      deg:   z.union([z.literal(90), z.literal(180), z.literal(270)]),
    }).parse(request.body)

    const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId } })
    if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })

    const bytes = await loadPdfBytes(id)
    const pdfDoc = await PDFDocument.load(bytes)
    const total = pdfDoc.getPageCount()

    for (const idx of pages) {
      if (idx >= 0 && idx < total) {
        const page = pdfDoc.getPage(idx)
        const current = page.getRotation().angle
        page.setRotation(degrees((current + deg) % 360))
      }
    }

    const outBytes = await pdfDoc.save()
    writeFileSync(filePath(id), outBytes)

    const updated = await prisma.pdfDocument.update({
      where: { id },
      data: { size: outBytes.length },
    })
    return { ...updated, sizeLabel: formatBytes(outBytes.length) }
  })

  // ── Découper en plusieurs PDFs ─────────────────────────────────────────────
  // `splitAt` = indices 0-based où commencent les nouvelles parties.
  // Ex : splitAt=[3, 7] et total=10 → [0-2], [3-6], [7-9]
  app.post('/:id/split', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { splitAt } = z.object({
      splitAt: z.array(z.number().int().min(1)).min(1).max(99),
    }).parse(request.body)

    const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId } })
    if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })

    const bytes = await loadPdfBytes(id)
    const src = await PDFDocument.load(bytes)
    const total = src.getPageCount()

    const sorted = [...new Set(splitAt.filter(p => p > 0 && p < total))].sort((a, b) => a - b)
    const boundaries = [0, ...sorted, total]
    const results = []

    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i]
      const end   = boundaries[i + 1]
      const indices = Array.from({ length: end - start }, (_, k) => start + k)

      const part = await PDFDocument.create()
      const copied = await part.copyPages(src, indices)
      copied.forEach(p => part.addPage(p))

      const outBytes = await part.save()
      const record = await prisma.pdfDocument.create({
        data: {
          ownerId,
          name: `${doc.name} — partie ${i + 1}`,
          pageCount: part.getPageCount(),
          size: outBytes.length,
        },
      })
      writeFileSync(filePath(record.id), outBytes)
      results.push({ ...record, sizeLabel: formatBytes(outBytes.length) })
    }

    return reply.status(201).send(results)
  })

  // ── Dupliquer un PDF ───────────────────────────────────────────────────────
  app.post('/:id/duplicate', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId } })
    if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })

    const bytes = await loadPdfBytes(id)
    const record = await prisma.pdfDocument.create({
      data: { ownerId, name: `${doc.name} (copie)`, pageCount: doc.pageCount, size: doc.size },
    })
    writeFileSync(filePath(record.id), bytes)
    return reply.status(201).send({ ...record, sizeLabel: formatBytes(doc.size) })
  })
}
