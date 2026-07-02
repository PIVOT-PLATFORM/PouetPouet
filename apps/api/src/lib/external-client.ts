import { redis } from './redis.js'

// Factory générique pour consommer un système externe (PGI/SAP, LDAP, et tout futur
// pod mock — cf. packages/mock-service-kit côté pod) avec un cache Redis en lecture,
// même pattern de repli que getFlagState dans feature-flags.ts : Redis si dispo, sinon
// un cache mémoire (dev/local), jamais d'échec dur sur Redis indisponible. Ajouter un
// nouveau système externe = un nouveau <nom>-client.ts qui appelle cette factory avec
// l'env var de base URL — aucune nouvelle logique de cache à écrire.

const memCache = new Map<string, { value: unknown; expires: number }>()

export class ExternalNotFoundError extends Error {}

// Service externe non configuré (env var absente) ou injoignable (connexion refusée) :
// mappé en 503 par le error handler global — jamais un 500 brut.
export class ExternalUnavailableError extends Error {}

export interface ExternalServiceClient {
  get<T>(path: string, ttlSeconds?: number): Promise<T>
  // Comme get, mais renvoie null sur 404 au lieu de lever — pratique pour les lookups
  // optionnels (ex: "cette demande d'achat a-t-elle une commande ?").
  getOrNull<T>(path: string, ttlSeconds?: number): Promise<T | null>
  post<T>(path: string, body?: unknown): Promise<T>
  put<T>(path: string, body?: unknown): Promise<T>
  invalidate(pathPrefix: string): Promise<void>
}

export interface ExternalServiceClientOptions {
  baseUrlEnv: string
  defaultTtlSeconds?: number
}

export function createExternalServiceClient(opts: ExternalServiceClientOptions): ExternalServiceClient {
  const defaultTtl = opts.defaultTtlSeconds ?? 30

  function cacheKey(path: string): string {
    return `ext:${opts.baseUrlEnv}:${path}`
  }

  async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = process.env[opts.baseUrlEnv]
    if (!baseUrl) throw new ExternalUnavailableError(`${opts.baseUrlEnv} non configurée`)
    let res: Response
    try {
      res = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      })
    } catch {
      throw new ExternalUnavailableError(`${opts.baseUrlEnv} injoignable (${baseUrl})`)
    }
    if (res.status === 404) throw new ExternalNotFoundError(`${opts.baseUrlEnv}${path} → 404`)
    if (!res.ok) throw new Error(`${opts.baseUrlEnv}${path} → HTTP ${res.status}`)
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  async function get<T>(path: string, ttlSeconds = defaultTtl): Promise<T> {
    const key = cacheKey(path)
    if (redis.status === 'ready') {
      try {
        const cached = await redis.get(key)
        if (cached) return JSON.parse(cached) as T
        const data = await fetchJson<T>(path)
        await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds)
        return data
      } catch {
        return fetchJson<T>(path) // erreur Redis → lecture directe
      }
    }
    const hit = memCache.get(key)
    if (hit && hit.expires > Date.now()) return hit.value as T
    const data = await fetchJson<T>(path)
    memCache.set(key, { value: data, expires: Date.now() + ttlSeconds * 1000 })
    return data
  }

  async function getOrNull<T>(path: string, ttlSeconds = defaultTtl): Promise<T | null> {
    try {
      return await get<T>(path, ttlSeconds)
    } catch (err) {
      if (err instanceof ExternalNotFoundError) return null
      throw err
    }
  }

  async function post<T>(path: string, body?: unknown): Promise<T> {
    return fetchJson<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined })
  }

  async function put<T>(path: string, body?: unknown): Promise<T> {
    return fetchJson<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined })
  }

  // À appeler après une écriture (post/put) pour que les lectures suivantes ne servent
  // pas une réponse cache périmée — supprime toutes les clés dont le chemin commence
  // par pathPrefix (mémoire + Redis, best-effort sur Redis).
  async function invalidate(pathPrefix: string): Promise<void> {
    const prefix = cacheKey(pathPrefix)
    for (const key of memCache.keys()) {
      if (key.startsWith(prefix)) memCache.delete(key)
    }
    if (redis.status === 'ready') {
      try {
        const keys = await redis.keys(`${prefix}*`)
        if (keys.length > 0) await redis.del(...keys)
      } catch {
        // best-effort
      }
    }
  }

  return { get, getOrNull, post, put, invalidate }
}
