import { Redis } from 'ioredis'

// En prod : REDIS_HOST est requis (Cloud Run → Memorystore ou Redis Cloud).
// En dev/test : connexion sur localhost, échec silencieux (le serveur tourne sans Redis).
export const redis = new Redis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  lazyConnect: true,
  enableOfflineQueue: false,
  connectTimeout: 2000,
  maxRetriesPerRequest: 0,
})

redis.on('error', () => {})

// Tente de se connecter sans bloquer le démarrage.
// En dev (pas de Redis), le statut reste 'close' et le serveur tourne sans adapter.
redis.connect().catch(() => {})
