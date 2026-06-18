import type { FastifyPluginAsync } from 'fastify'
import { type TestBookStatus, type TestCaseStatus } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'

export const testbooksRoutes: FastifyPluginAsync = async (app) => {
  // ── Liste + création ────────────────────────────────────────────────────────

  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const { id: ownerId } = request.user as { id: string }
    return prisma.testBook.findMany({
      where: { ownerId },
      include: { _count: { select: { sections: true } } },
      orderBy: { updatedAt: 'desc' },
    })
  })

  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const body = request.body as { title: string; description?: string; version?: string }
    if (!body.title?.trim()) return reply.status(400).send({ error: 'Titre requis' })

    const book = await prisma.testBook.create({
      data: { ownerId, title: body.title.trim(), description: body.description ?? null, version: body.version ?? null },
    })
    return reply.status(201).send(book)
  })

  // ── Détail ──────────────────────────────────────────────────────────────────

  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }

    const book = await prisma.testBook.findFirst({
      where: { id, ownerId },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: { cases: { orderBy: { order: 'asc' } } },
        },
      },
    })
    if (!book) return reply.status(404).send({ error: 'Cahier introuvable' })
    return book
  })

  app.patch('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const body = request.body as Partial<{ title: string; description: string | null; version: string | null; status: TestBookStatus }>

    const book = await prisma.testBook.findFirst({ where: { id, ownerId } })
    if (!book) return reply.status(404).send({ error: 'Cahier introuvable' })

    const updated = await prisma.testBook.update({ where: { id }, data: body })
    return updated
  })

  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }

    const book = await prisma.testBook.findFirst({ where: { id, ownerId } })
    if (!book) return reply.status(404).send({ error: 'Cahier introuvable' })

    await prisma.testBook.delete({ where: { id } })
    return reply.status(204).send()
  })

  // ── Sections ────────────────────────────────────────────────────────────────

  app.post('/:id/sections', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id: bookId } = request.params as { id: string }
    const body = request.body as { title: string }

    const book = await prisma.testBook.findFirst({ where: { id: bookId, ownerId } })
    if (!book) return reply.status(404).send({ error: 'Cahier introuvable' })

    const last = await prisma.testSection.findFirst({ where: { bookId }, orderBy: { order: 'desc' } })
    const section = await prisma.testSection.create({
      data: { bookId, title: body.title?.trim() || 'Nouvelle section', order: (last?.order ?? -1) + 1 },
      include: { cases: true },
    })
    return reply.status(201).send(section)
  })

  app.patch('/sections/:sectionId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { sectionId } = request.params as { sectionId: string }
    const body = request.body as Partial<{ title: string; order: number }>

    const section = await prisma.testSection.findFirst({
      where: { id: sectionId },
      include: { book: { select: { ownerId: true } } },
    })
    if (!section || section.book.ownerId !== ownerId) return reply.status(404).send({ error: 'Section introuvable' })

    const updated = await prisma.testSection.update({ where: { id: sectionId }, data: body })
    return updated
  })

  app.delete('/sections/:sectionId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { sectionId } = request.params as { sectionId: string }

    const section = await prisma.testSection.findFirst({
      where: { id: sectionId },
      include: { book: { select: { ownerId: true } } },
    })
    if (!section || section.book.ownerId !== ownerId) return reply.status(404).send({ error: 'Section introuvable' })

    await prisma.testSection.delete({ where: { id: sectionId } })
    return reply.status(204).send()
  })

  // ── Cas de test ─────────────────────────────────────────────────────────────

  app.post('/sections/:sectionId/cases', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { sectionId } = request.params as { sectionId: string }
    const body = request.body as { title: string; precondition?: string; steps?: string; expected?: string }

    const section = await prisma.testSection.findFirst({
      where: { id: sectionId },
      include: { book: { select: { ownerId: true } } },
    })
    if (!section || section.book.ownerId !== ownerId) return reply.status(404).send({ error: 'Section introuvable' })

    const last = await prisma.testCase.findFirst({ where: { sectionId }, orderBy: { order: 'desc' } })
    const testCase = await prisma.testCase.create({
      data: {
        sectionId,
        title: body.title?.trim() || 'Nouveau cas',
        precondition: body.precondition ?? null,
        steps: body.steps ?? null,
        expected: body.expected ?? null,
        order: (last?.order ?? -1) + 1,
      },
    })
    return reply.status(201).send(testCase)
  })

  app.patch('/cases/:caseId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { caseId } = request.params as { caseId: string }
    const body = request.body as Partial<{ title: string; precondition: string | null; steps: string | null; expected: string | null; status: TestCaseStatus; order: number }>

    const testCase = await prisma.testCase.findFirst({
      where: { id: caseId },
      include: { section: { include: { book: { select: { ownerId: true } } } } },
    })
    if (!testCase || testCase.section.book.ownerId !== ownerId) return reply.status(404).send({ error: 'Cas introuvable' })

    const updated = await prisma.testCase.update({ where: { id: caseId }, data: body })
    return updated
  })

  app.delete('/cases/:caseId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { caseId } = request.params as { caseId: string }

    const testCase = await prisma.testCase.findFirst({
      where: { id: caseId },
      include: { section: { include: { book: { select: { ownerId: true } } } } },
    })
    if (!testCase || testCase.section.book.ownerId !== ownerId) return reply.status(404).send({ error: 'Cas introuvable' })

    await prisma.testCase.delete({ where: { id: caseId } })
    return reply.status(204).send()
  })
}
