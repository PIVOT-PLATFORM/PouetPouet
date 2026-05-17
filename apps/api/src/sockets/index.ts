import type { Server } from 'socket.io'
import { boardSocketHandlers } from './board.js'
import { sessionSocketHandlers } from './session.js'
import { scrumSocketHandlers } from './scrum.js'
import { dailySocketHandlers } from './daily.js'

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket) => {
    boardSocketHandlers(io, socket)
    sessionSocketHandlers(io, socket)
    scrumSocketHandlers(io, socket)
    dailySocketHandlers(io, socket)
  })
}
