import type { Server } from 'socket.io'
import { API_MODULES } from '../modules/registry.js'
import { sessionSocketHandlers } from './session.js'

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket) => {
    // Per-user room so account notifications can be pushed live, board-independent.
    const userId = socket.data.userId as string | undefined
    if (userId) socket.join(`user:${userId}`)

    // Socle : sessions live (service transverse, pas un module)
    sessionSocketHandlers(io, socket)

    // Modules FORGE (cf. modules/registry.ts)
    for (const mod of API_MODULES) {
      for (const handlers of mod.socketHandlers) handlers(io, socket)
    }
  })
}
