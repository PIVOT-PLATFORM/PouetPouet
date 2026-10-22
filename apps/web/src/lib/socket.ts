import { io, type Socket } from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: (cb: (o: { token: string | null }) => void) =>
        cb({ token: typeof window !== 'undefined' ? localStorage.getItem('token') : null }),
    })
  }
  return socket
}

export function connectSocket(): Socket {
  const s = getSocket()
  // `active` et non `connected` : appelé à chaque rendu (useRef(connectSocket())),
  // un connect() pendant la poignée de main renvoie un paquet CONNECT ; le serveur
  // le juge invalide et ferme la connexion (« forced server close »). Le client
  // ne se reconnecte qu'~1 s plus tard et les emits en tampon arrivent alors
  // dans le désordre (board:join renvoyé après les mutations).
  if (!s.active) s.connect()
  return s
}

export function disconnectSocket() {
  socket?.disconnect()
}
