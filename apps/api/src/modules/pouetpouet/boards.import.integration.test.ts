import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { boardRoutes } from './boards.routes.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@import.int.test'

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

function baseCard(overrides: Record<string, unknown> = {}) {
  return {
    klxId: 'k1',
    type: 'TEXT',
    content: 'Hello',
    color: '#FFEB3B',
    posX: 40,
    posY: 40,
    width: 192,
    height: 96,
    zIndex: 0,
    locked: false,
    groupKey: null,
    ...overrides,
  }
}

describe('POST /:id/import/klaxoon + /:id/import/undo (integration)', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let editor: { user: { id: string }; token: string }
  let viewer: { user: { id: string }; token: string }
  let boardId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: boardRoutes, prefix: '/api/boards' }])
    owner = await createTestUser(app, `owner${SUFFIX}`)
    editor = await createTestUser(app, `editor${SUFFIX}`)
    viewer = await createTestUser(app, `viewer${SUFFIX}`)

    const board = await prisma.board.create({ data: { name: 'Import board', ownerId: owner.user.id } })
    boardId = board.id
    await prisma.boardShare.createMany({
      data: [
        { boardId, userId: editor.user.id, role: 'EDITOR' },
        { boardId, userId: viewer.user.id, role: 'VIEWER' },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('refuses import for a VIEWER (403)', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/boards/${boardId}/import/klaxoon`, headers: auth(viewer.token),
      payload: { cards: [baseCard()], connections: [] },
    })
    expect(res.statusCode).toBe(403)
  })

  it('creates cards + frames + fields + field values, and returns their ids', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/boards/${boardId}/import/klaxoon`, headers: auth(editor.token),
      payload: {
        cards: [
          baseCard({ klxId: 'a', fieldValues: [{ field: 'Catégorie', value: 'MEP EAM' }] }),
          baseCard({ klxId: 'b', posX: 300 }),
        ],
        connections: [
          { fromKlxId: 'a', toKlxId: 'b', shape: 'curved', color: '#9ca3af', width: 2, dashed: false, arrow: 'end', label: '' },
        ],
        frames: [{ title: 'Zone 1', posX: 0, posY: 0, width: 800, height: 600 }],
        fields: [{ name: 'Catégorie', type: 'SELECT', options: ['MEP EAM'] }],
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.cards).toBe(2)
    expect(body.connections).toBe(1)
    expect(body.frames).toBe(1)
    expect(body.cardIds).toHaveLength(2)
    expect(body.connectionIds).toHaveLength(1)
    expect(body.frameIds).toHaveLength(1)

    const field = await prisma.boardField.findFirst({ where: { boardId, name: 'Catégorie' } })
    expect(field).not.toBeNull()
    expect(field?.type).toBe('SELECT')

    const value = await prisma.cardFieldValue.findFirst({ where: { cardId: body.cardIds[0], fieldId: field!.id } })
    expect(value?.value).toBe('MEP EAM')

    // Cleanup for the following tests
    await prisma.card.deleteMany({ where: { id: { in: body.cardIds } } })
    await prisma.frame.deleteMany({ where: { id: { in: body.frameIds } } })
    await prisma.boardField.deleteMany({ where: { boardId } })
  })

  it('reuses an existing field by name (case-insensitive) instead of duplicating it', async () => {
    const first = await app.inject({
      method: 'POST', url: `/api/boards/${boardId}/import/klaxoon`, headers: auth(owner.token),
      payload: { cards: [baseCard({ klxId: 'x', fieldValues: [{ field: 'Porteur', value: 'A' }] })], connections: [], fields: [{ name: 'Porteur', type: 'TEXT', options: null }] },
    })
    const second = await app.inject({
      method: 'POST', url: `/api/boards/${boardId}/import/klaxoon`, headers: auth(owner.token),
      payload: { cards: [baseCard({ klxId: 'y', fieldValues: [{ field: 'porteur', value: 'B' }] })], connections: [], fields: [{ name: 'porteur', type: 'TEXT', options: null }] },
    })
    const fields = await prisma.boardField.findMany({ where: { boardId, name: { equals: 'Porteur', mode: 'insensitive' } } })
    expect(fields).toHaveLength(1)

    const allValues = await prisma.cardFieldValue.findMany({ where: { fieldId: fields[0].id } })
    expect(allValues.map((v) => v.value).sort()).toEqual(['A', 'B'])

    await prisma.card.deleteMany({ where: { id: { in: [...first.json().cardIds, ...second.json().cardIds] } } })
    await prisma.boardField.deleteMany({ where: { boardId } })
  })

  it('shifts a second import below the existing content instead of overlapping it', async () => {
    const first = await app.inject({
      method: 'POST', url: `/api/boards/${boardId}/import/klaxoon`, headers: auth(owner.token),
      payload: { cards: [baseCard({ klxId: 'a', posY: 40, height: 96 })], connections: [] },
    })
    const firstCardId = first.json().cardIds[0]

    const second = await app.inject({
      method: 'POST', url: `/api/boards/${boardId}/import/klaxoon`, headers: auth(owner.token),
      payload: { cards: [baseCard({ klxId: 'b', posY: 40, height: 96 })], connections: [] },
    })
    const secondCard = await prisma.card.findUnique({ where: { id: second.json().cardIds[0] } })
    // bottom of existing (40+96=136) + 120 margin - importTop (40) = 216
    expect(secondCard?.posY).toBe(40 + 216)

    await prisma.card.deleteMany({ where: { id: { in: [firstCardId, second.json().cardIds[0]] } } })
  })

  it('does not shift the first import on an empty board', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/boards/${boardId}/import/klaxoon`, headers: auth(owner.token),
      payload: { cards: [baseCard({ klxId: 'a', posY: 40 })], connections: [] },
    })
    const card = await prisma.card.findUnique({ where: { id: res.json().cardIds[0] } })
    expect(card?.posY).toBe(40)
    await prisma.card.deleteMany({ where: { id: res.json().cardIds[0] } as never })
  })

  it('persists locked = true', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/boards/${boardId}/import/klaxoon`, headers: auth(owner.token),
      payload: { cards: [baseCard({ klxId: 'a', locked: true })], connections: [] },
    })
    const card = await prisma.card.findUnique({ where: { id: res.json().cardIds[0] } })
    expect(card?.locked).toBe(true)
    await prisma.card.delete({ where: { id: card!.id } })
  })

  // ── Undo ─────────────────────────────────────────────────────────────────

  it('undo deletes exactly what the import created, leaves other cards untouched', async () => {
    const untouched = await prisma.card.create({ data: { boardId, type: 'TEXT', content: 'keep me', posX: 0, posY: 0 } })

    const res = await app.inject({
      method: 'POST', url: `/api/boards/${boardId}/import/klaxoon`, headers: auth(owner.token),
      payload: {
        cards: [baseCard({ klxId: 'a' }), baseCard({ klxId: 'b', posX: 300 })],
        connections: [{ fromKlxId: 'a', toKlxId: 'b', shape: 'curved', color: '#9ca3af', width: 2, dashed: false, arrow: 'none', label: '' }],
        frames: [{ title: 'Z', posX: 0, posY: 0, width: 100, height: 100 }],
      },
    })
    const { cardIds, connectionIds, frameIds } = res.json()

    const undo = await app.inject({
      method: 'POST', url: `/api/boards/${boardId}/import/undo`, headers: auth(owner.token),
      payload: { cardIds, connectionIds, frameIds },
    })
    expect(undo.statusCode).toBe(200)
    // La suppression des cartes cascade déjà sur leurs connexions (FK Cascade) :
    // le deleteMany explicite sur les connexions arrive après coup et compte 0.
    const body = undo.json()
    expect(body.cards).toBe(2)
    expect(body.frames).toBe(1)

    expect(await prisma.card.count({ where: { id: { in: cardIds } } })).toBe(0)
    expect(await prisma.cardConnection.count({ where: { id: { in: connectionIds } } })).toBe(0)
    expect(await prisma.frame.count({ where: { id: { in: frameIds } } })).toBe(0)
    // La carte pré-existante n'a pas bougé.
    expect(await prisma.card.findUnique({ where: { id: untouched.id } })).not.toBeNull()

    await prisma.card.delete({ where: { id: untouched.id } })
  })

  it('a VIEWER cannot undo an import (403)', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/boards/${boardId}/import/undo`, headers: auth(viewer.token),
      payload: { cardIds: [], connectionIds: [], frameIds: [] },
    })
    expect(res.statusCode).toBe(403)
  })

  it('undo scoped to the board: ids belonging to another board are not deleted', async () => {
    const otherBoard = await prisma.board.create({ data: { name: 'Other', ownerId: owner.user.id } })
    const foreignCard = await prisma.card.create({ data: { boardId: otherBoard.id, type: 'TEXT', content: 'foreign', posX: 0, posY: 0 } })

    const res = await app.inject({
      method: 'POST', url: `/api/boards/${boardId}/import/undo`, headers: auth(owner.token),
      payload: { cardIds: [foreignCard.id], connectionIds: [], frameIds: [] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().cards).toBe(0)
    expect(await prisma.card.findUnique({ where: { id: foreignCard.id } })).not.toBeNull()

    await prisma.board.delete({ where: { id: otherBoard.id } })
  })
})
