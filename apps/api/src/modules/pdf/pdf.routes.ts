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
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { PDFDocument, degrees } from 'pdf-lib'
import { PDFParse } from 'pdf-parse'

async function extractText(buf: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buf) })
  const result = await parser.getText()
  return result.text
}
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'

const execFileAsync = promisify(execFile)

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

// Détecte pandoc au démarrage — les routes de conversion ne s'activent que s'il est présent.
async function detectPandoc(): Promise<boolean> {
  try {
    await execFileAsync('pandoc', ['--version'])
    return true
  } catch {
    return false
  }
}

const FILE_LIMIT = 100 * 1024 * 1024 // 100 Mo

const docSelect = {
  id: true, ownerId: true, folderId: true, name: true,
  tags: true, pageCount: true, size: true, createdAt: true, updatedAt: true,
} as const

function formatDoc(d: { size: number; [k: string]: unknown }) {
  return { ...d, sizeLabel: formatBytes(d.size as number) }
}

export const pdfRoutes: FastifyPluginAsync = async (app) => {
  await app.register(import('@fastify/multipart'), { limits: { fileSize: FILE_LIMIT } })

  const pandocAvailable = await detectPandoc()

  // ── Documents ─────────────────────────────────────────────────────────────────

  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const { id: ownerId } = request.user as { id: string }
    const { folder, tag } = request.query as { folder?: string; tag?: string }
    const docs = await prisma.pdfDocument.findMany({
      where: {
        ownerId,
        ...(folder === 'root' ? { folderId: null } : folder ? { folderId: folder } : {}),
        ...(tag ? { tags: { has: tag } } : {}),
      },
      select: docSelect,
      orderBy: { createdAt: 'desc' },
    })
    return docs.map(formatDoc)
  })

  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId }, select: docSelect })
    if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })
    return formatDoc(doc)
  })

  app.get('/:id/file', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId }, select: { id: true, name: true } })
    if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })
    const fp = filePath(id)
    if (!existsSync(fp)) return reply.status(404).send({ error: 'Fichier manquant.' })
    reply.header('Content-Type', 'application/pdf')
    reply.header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}.pdf`)
    reply.header('Content-Length', statSync(fp).size)
    return reply.send(createReadStream(fp))
  })

  // ── Export texte ──────────────────────────────────────────────────────────────
  app.get('/:id/text', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId }, select: { name: true } })
    if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })
    const bytes = await loadPdfBytes(id)
    const result = { text: await extractText(bytes) }
    reply.header('Content-Type', 'text/plain; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}.txt`)
    return reply.send(result.text)
  })

  // ── Export DOCX via pandoc (si disponible) ────────────────────────────────────
  if (pandocAvailable) {
    app.get('/:id/docx', { preHandler: [app.authenticate] }, async (request, reply) => {
      const { id: ownerId } = request.user as { id: string }
      const { id } = request.params as { id: string }
      const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId }, select: { name: true } })
      if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })

      // Extraction texte → pandoc → docx
      const bytes = await loadPdfBytes(id)
      const parsed = { text: await extractText(bytes) }
      const txtPath = path.join(tmpdir(), `pandoc-${id}.txt`)
      const docxPath = path.join(tmpdir(), `pandoc-${id}.docx`)
      writeFileSync(txtPath, parsed.text, 'utf-8')
      try {
        await execFileAsync('pandoc', [txtPath, '-o', docxPath])
        const docxBytes = readFileSync(docxPath)
        reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}.docx`)
        return reply.send(docxBytes)
      } finally {
        try { unlinkSync(txtPath) } catch {}
        try { unlinkSync(docxPath) } catch {}
      }
    })

    app.get('/:id/md', { preHandler: [app.authenticate] }, async (request, reply) => {
      const { id: ownerId } = request.user as { id: string }
      const { id } = request.params as { id: string }
      const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId }, select: { name: true } })
      if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })

      const bytes = await loadPdfBytes(id)
      const parsed = { text: await extractText(bytes) }
      const txtPath = path.join(tmpdir(), `pandoc-${id}.txt`)
      const mdPath = path.join(tmpdir(), `pandoc-${id}.md`)
      writeFileSync(txtPath, parsed.text, 'utf-8')
      try {
        await execFileAsync('pandoc', [txtPath, '-o', mdPath, '-t', 'markdown'])
        const mdBytes = readFileSync(mdPath)
        reply.header('Content-Type', 'text/markdown; charset=utf-8')
        reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}.md`)
        return reply.send(mdBytes)
      } finally {
        try { unlinkSync(txtPath) } catch {}
        try { unlinkSync(mdPath) } catch {}
      }
    })
  }

  // ── Capabilities (pour que le frontend sache ce qui est dispo) ────────────────
  app.get('/capabilities', { preHandler: [app.authenticate] }, async () => {
    return { pandoc: pandocAvailable }
  })

  // ── Upload ────────────────────────────────────────────────────────────────────
  app.post('/upload', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { folderId } = request.query as { folderId?: string }
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'Fichier manquant.' })
    if (!data.filename.toLowerCase().endsWith('.pdf') && data.mimetype !== 'application/pdf') {
      return reply.status(400).send({ error: 'Seuls les fichiers PDF sont acceptés.' })
    }
    const tmp = path.join(tmpdir(), `pdf-upload-${Date.now()}.pdf`)
    await pipeline(data.file, createWriteStream(tmp))
    const bytes = readFileSync(tmp)
    const size = bytes.length
    let pageCount = 0
    try {
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
      pageCount = pdfDoc.getPageCount()
    } catch {
      try { unlinkSync(tmp) } catch {}
      return reply.status(422).send({ error: 'Impossible de lire le PDF (corrompu ou chiffré).' })
    }
    const cleanName = data.filename.replace(/\.pdf$/i, '').trim() || 'Document'
    const record = await prisma.pdfDocument.create({
      data: { ownerId, name: cleanName, pageCount, size, folderId: folderId ?? null },
      select: docSelect,
    })
    renameSync(tmp, filePath(record.id))
    return reply.status(201).send(formatDoc(record))
  })

  // ── Renommer + tags + dossier ─────────────────────────────────────────────────
  app.patch('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const body = z.object({
      name:     z.string().min(1).max(200).optional(),
      tags:     z.array(z.string().max(50)).max(20).optional(),
      folderId: z.string().nullable().optional(),
    }).parse(request.body)
    const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId } })
    if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })
    const updated = await prisma.pdfDocument.update({ where: { id }, data: body, select: docSelect })
    return formatDoc(updated)
  })

  // ── Supprimer ─────────────────────────────────────────────────────────────────
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId } })
    if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })
    await prisma.pdfDocument.delete({ where: { id } })
    const fp = filePath(id)
    if (existsSync(fp)) try { unlinkSync(fp) } catch {}
    return reply.status(204).send()
  })

  // ── Fusionner ─────────────────────────────────────────────────────────────────
  app.post('/merge', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { ids, name, folderId } = z.object({
      ids:      z.array(z.string()).min(2).max(30),
      name:     z.string().min(1).max(200),
      folderId: z.string().nullable().optional(),
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
      data: { ownerId, name, pageCount: merged.getPageCount(), size: outBytes.length, folderId: folderId ?? null },
      select: docSelect,
    })
    writeFileSync(filePath(record.id), outBytes)
    return reply.status(201).send(formatDoc(record))
  })

  // ── Extraire des pages ────────────────────────────────────────────────────────
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
    if (valid.length === 0) return reply.status(400).send({ error: 'Aucune page valide.' })
    const newDoc = await PDFDocument.create()
    const copied = await newDoc.copyPages(src, valid)
    copied.forEach(p => newDoc.addPage(p))
    const outBytes = await newDoc.save()
    const record = await prisma.pdfDocument.create({
      data: { ownerId, name, pageCount: newDoc.getPageCount(), size: outBytes.length, folderId: doc.folderId },
      select: docSelect,
    })
    writeFileSync(filePath(record.id), outBytes)
    return reply.status(201).send(formatDoc(record))
  })

  // ── Réordonner ────────────────────────────────────────────────────────────────
  app.post('/:id/reorder', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { pages } = z.object({ pages: z.array(z.number().int().min(0)).min(1) }).parse(request.body)
    const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId } })
    if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })
    const bytes = await loadPdfBytes(id)
    const src = await PDFDocument.load(bytes)
    const valid = pages.filter(p => p >= 0 && p < src.getPageCount())
    if (valid.length === 0) return reply.status(400).send({ error: 'Aucune page valide.' })
    const newDoc = await PDFDocument.create()
    const copied = await newDoc.copyPages(src, valid)
    copied.forEach(p => newDoc.addPage(p))
    const outBytes = await newDoc.save()
    writeFileSync(filePath(id), outBytes)
    const updated = await prisma.pdfDocument.update({
      where: { id }, data: { pageCount: newDoc.getPageCount(), size: outBytes.length }, select: docSelect,
    })
    return formatDoc(updated)
  })

  // ── Rotation ──────────────────────────────────────────────────────────────────
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
        page.setRotation(degrees((page.getRotation().angle + deg) % 360))
      }
    }
    const outBytes = await pdfDoc.save()
    writeFileSync(filePath(id), outBytes)
    const updated = await prisma.pdfDocument.update({
      where: { id }, data: { size: outBytes.length }, select: docSelect,
    })
    return formatDoc(updated)
  })

  // ── Découper ──────────────────────────────────────────────────────────────────
  app.post('/:id/split', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { splitAt } = z.object({ splitAt: z.array(z.number().int().min(1)).min(1).max(99) }).parse(request.body)
    const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId } })
    if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })
    const bytes = await loadPdfBytes(id)
    const src = await PDFDocument.load(bytes)
    const total = src.getPageCount()
    const sorted = [...new Set(splitAt.filter(p => p > 0 && p < total))].sort((a, b) => a - b)
    const boundaries = [0, ...sorted, total]
    const results = []
    for (let i = 0; i < boundaries.length - 1; i++) {
      const indices = Array.from({ length: boundaries[i + 1] - boundaries[i] }, (_, k) => boundaries[i] + k)
      const part = await PDFDocument.create()
      const copied = await part.copyPages(src, indices)
      copied.forEach(p => part.addPage(p))
      const outBytes = await part.save()
      const record = await prisma.pdfDocument.create({
        data: { ownerId, name: `${doc.name} — partie ${i + 1}`, pageCount: part.getPageCount(), size: outBytes.length, folderId: doc.folderId },
        select: docSelect,
      })
      writeFileSync(filePath(record.id), outBytes)
      results.push(formatDoc(record))
    }
    return reply.status(201).send(results)
  })

  // ── Dupliquer ─────────────────────────────────────────────────────────────────
  app.post('/:id/duplicate', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const doc = await prisma.pdfDocument.findFirst({ where: { id, ownerId } })
    if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })
    const bytes = await loadPdfBytes(id)
    const record = await prisma.pdfDocument.create({
      data: { ownerId, name: `${doc.name} (copie)`, pageCount: doc.pageCount, size: doc.size, folderId: doc.folderId, tags: doc.tags },
      select: docSelect,
    })
    writeFileSync(filePath(record.id), bytes)
    return reply.status(201).send(formatDoc(record))
  })

  // ────────────────────────────────────────────────────────────────────────────
  // DOSSIERS
  // ────────────────────────────────────────────────────────────────────────────

  // Liste des dossiers (arborescence complète)
  app.get('/folders', { preHandler: [app.authenticate] }, async (request) => {
    const { id: ownerId } = request.user as { id: string }
    return prisma.pdfFolder.findMany({
      where: { ownerId },
      select: { id: true, name: true, parentId: true, createdAt: true },
      orderBy: { name: 'asc' },
    })
  })

  // Créer un dossier
  app.post('/folders', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { name, parentId } = z.object({
      name:     z.string().min(1).max(200),
      parentId: z.string().nullable().optional(),
    }).parse(request.body)
    if (parentId) {
      const parent = await prisma.pdfFolder.findFirst({ where: { id: parentId, ownerId } })
      if (!parent) return reply.status(404).send({ error: 'Dossier parent introuvable.' })
    }
    const folder = await prisma.pdfFolder.create({
      data: { ownerId, name, parentId: parentId ?? null },
      select: { id: true, name: true, parentId: true, createdAt: true },
    })
    return reply.status(201).send(folder)
  })

  // Renommer un dossier
  app.patch('/folders/:fid', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { fid } = request.params as { fid: string }
    const { name } = z.object({ name: z.string().min(1).max(200) }).parse(request.body)
    const folder = await prisma.pdfFolder.findFirst({ where: { id: fid, ownerId } })
    if (!folder) return reply.status(404).send({ error: 'Dossier introuvable.' })
    return prisma.pdfFolder.update({
      where: { id: fid }, data: { name },
      select: { id: true, name: true, parentId: true, createdAt: true },
    })
  })

  // Déplacer un dossier (changer de parent)
  app.patch('/folders/:fid/move', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { fid } = request.params as { fid: string }
    const { parentId } = z.object({ parentId: z.string().nullable() }).parse(request.body)
    const folder = await prisma.pdfFolder.findFirst({ where: { id: fid, ownerId } })
    if (!folder) return reply.status(404).send({ error: 'Dossier introuvable.' })
    // Empêche de déplacer un dossier dans lui-même
    if (parentId === fid) return reply.status(400).send({ error: 'Un dossier ne peut pas être son propre parent.' })
    return prisma.pdfFolder.update({
      where: { id: fid }, data: { parentId },
      select: { id: true, name: true, parentId: true, createdAt: true },
    })
  })

  // Supprimer un dossier (les documents retombent à la racine via SetNull)
  app.delete('/folders/:fid', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { fid } = request.params as { fid: string }
    const folder = await prisma.pdfFolder.findFirst({ where: { id: fid, ownerId } })
    if (!folder) return reply.status(404).send({ error: 'Dossier introuvable.' })
    await prisma.pdfFolder.delete({ where: { id: fid } })
    return reply.status(204).send()
  })
}
