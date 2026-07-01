import type { Server, Socket } from 'socket.io'
import { bus } from '../../lib/bus.js'

// Les abonnements bus → socket ne doivent être enregistrés qu'une seule fois,
// même si feedbackSocketHandlers est appelé pour chaque nouvelle connexion.
let booted = false

function bootBroadcasts(io: Server) {
  if (booted) return
  booted = true

  bus.subscribe('feedback.ticket.created', ({ payload }) => {
    io.to('feedback').emit('feedback:ticket:created', payload)
  })
  bus.subscribe('feedback.ticket.updated', ({ payload }) => {
    io.to('feedback').emit('feedback:ticket:updated', payload)
  })
  bus.subscribe('feedback.ticket.moved', ({ payload }) => {
    io.to('feedback').emit('feedback:ticket:moved', payload)
  })
  bus.subscribe('feedback.ticket.deleted', ({ payload }) => {
    io.to('feedback').emit('feedback:ticket:deleted', payload)
  })
  bus.subscribe('feedback.ticket.voted', ({ payload }) => {
    io.to('feedback').emit('feedback:ticket:voted', payload)
  })
}

export function feedbackSocketHandlers(io: Server, socket: Socket) {
  bootBroadcasts(io)

  socket.on('feedback:join', () => socket.join('feedback'))
  socket.on('feedback:leave', () => socket.leave('feedback'))
}
