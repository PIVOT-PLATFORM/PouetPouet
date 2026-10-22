import { createServer } from 'http'
import type { AddressInfo } from 'net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Server } from 'socket.io'
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client'

// Join lent (requêtes Prisma) : c'est la fenêtre où les mutations arrivées
// juste derrière le join étaient ignorées par canWrite.
const JOIN_DELAY_MS = 50

const prismaMock = vi.hoisted(() => ({
  board: { findUnique: vi.fn() },
  boardShare: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  card: { findMany: vi.fn(), create: vi.fn() },
  cardConnection: { findMany: vi.fn() },
  frame: { findMany: vi.fn() },
  boardField: { findMany: vi.fn() },
}))

vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('../../lib/redis.js', () => ({ redis: { status: 'end' } }))

const { boardSocketHandlers } = await import('./board.sockets.js')

describe('board.sockets — mutations émises pendant le join', () => {
  let io: Server
  let client: ClientSocket

  beforeEach(async () => {
    vi.clearAllMocks()
    prismaMock.board.findUnique.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, JOIN_DELAY_MS))
      return { id: 'b1', ownerId: 'u1' }
    })
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Alice', avatar: null })
    prismaMock.card.findMany.mockResolvedValue([])
    prismaMock.cardConnection.findMany.mockResolvedValue([])
    prismaMock.frame.findMany.mockResolvedValue([])
    prismaMock.boardField.findMany.mockResolvedValue([])
    let n = 0
    prismaMock.card.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: `c${++n}`, ...data, fieldValues: [],
    }))

    const httpServer = createServer()
    io = new Server(httpServer)
    io.use((socket, next) => { socket.data.userId = 'u1'; next() })
    io.on('connection', (socket) => boardSocketHandlers(io, socket))
    await new Promise<void>((r) => httpServer.listen(0, r))
    const { port } = httpServer.address() as AddressInfo
    client = ioClient(`http://localhost:${port}`, { autoConnect: false, transports: ['websocket'] })
  })

  afterEach(() => {
    client.disconnect()
    io.close()
  })

  it('crée les cartes émises avant la fin du join, après board:state', async () => {
    const events: string[] = []
    client.on('board:state', () => events.push('board:state'))
    client.on('card:created', (card: { id: string }) => events.push(`card:created ${card.id}`))

    // Comme le navigateur : les emits partent en tampon avant la connexion,
    // puis arrivent d'un bloc au serveur (join + deux créations).
    client.emit('board:join', 'b1')
    client.emit('card:create', { boardId: 'b1', content: '', posX: 0, posY: 0 })
    client.emit('card:create', { boardId: 'b1', content: '', posX: 300, posY: 0 })
    client.connect()

    await vi.waitFor(() => expect(events).toHaveLength(3), { timeout: 2000 })
    expect(events).toEqual(['board:state', 'card:created c1', 'card:created c2'])
  })
})
