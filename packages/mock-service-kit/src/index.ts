// Kit partagé pour construire un pod mock (service Docker autonome qui simule un
// système externe — PGI/SAP, LDAP, etc. — en attendant la vraie intégration). Pas un
// framework : juste ce qui serait sinon dupliqué entre chaque pod (stockage en
// mémoire, pagination/recherche, squelette Fastify). Ajouter un nouveau pod = importer
// ce package, définir un seed + des routes ; aucune nouvelle logique d'infra à écrire.
import Fastify, { type FastifyInstance } from 'fastify'

export interface Collection<T extends { id: string }> {
  list(): T[]
  get(id: string): T | undefined
  create(item: T): T
  update(id: string, patch: Partial<T>): T | undefined
  remove(id: string): boolean
  find(predicate: (item: T) => boolean): T[]
}

// Stockage en mémoire, régénéré à chaque démarrage du pod — un système externe que
// l'app ne maîtrise pas n'a pas de garantie de persistance entre deux redémarrages.
export function createCollection<T extends { id: string }>(seed: () => T[]): Collection<T> {
  const items = new Map<string, T>(seed().map((item) => [item.id, item]))
  return {
    list: () => Array.from(items.values()),
    get: (id) => items.get(id),
    create: (item) => {
      items.set(item.id, item)
      return item
    },
    update: (id, patch) => {
      const existing = items.get(id)
      if (!existing) return undefined
      const updated = { ...existing, ...patch }
      items.set(id, updated)
      return updated
    },
    remove: (id) => items.delete(id),
    find: (predicate) => Array.from(items.values()).filter(predicate),
  }
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface PaginateOptions<T> {
  q?: string
  searchFields?: (keyof T)[]
  filters?: Partial<Record<keyof T, unknown>>
  page?: number
  pageSize?: number
}

// Filtre texte (q sur searchFields) + filtre exact (filters) + pagination — réutilisé
// par tous les endpoints de liste de tous les pods (même contrat que les routes
// paginées côté apps/api, cf. GET /contrats, GET /demandes-achat).
export function paginate<T>(allItems: T[], opts: PaginateOptions<T> = {}): Page<T> {
  const page = Math.max(1, opts.page ?? 1)
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 25))

  let filtered = allItems
  if (opts.filters) {
    for (const [key, value] of Object.entries(opts.filters)) {
      if (value === undefined || value === '') continue
      filtered = filtered.filter((item) => (item as Record<string, unknown>)[key] === value)
    }
  }
  if (opts.q?.trim() && opts.searchFields?.length) {
    const q = opts.q.trim().toLowerCase()
    filtered = filtered.filter((item) =>
      opts.searchFields!.some((field) => String(item[field] ?? '').toLowerCase().includes(q)),
    )
  }

  const total = filtered.length
  const start = (page - 1) * pageSize
  return { items: filtered.slice(start, start + pageSize), total, page, pageSize }
}

export interface MockServiceOptions {
  name: string
  port: number
}

export interface MockService {
  app: FastifyInstance
  registerCollection: (name: string, collection: Collection<{ id: string }>) => void
  start: () => Promise<void>
}

// Squelette Fastify minimal pour un pod mock : pas d'auth (service interne, même
// modèle de confiance que postgres/redis dans docker-compose), /health, et un log de
// démarrage résumant les collections seedées (utile pour vérifier le boot-seed).
export function createMockService(opts: MockServiceOptions): MockService {
  const app = Fastify({ logger: false })
  const collections = new Map<string, Collection<{ id: string }>>()

  app.get('/health', async () => ({ status: 'ok', service: opts.name }))

  function registerCollection(name: string, collection: Collection<{ id: string }>) {
    collections.set(name, collection)
  }

  async function start() {
    await app.listen({ host: '0.0.0.0', port: opts.port })
    const summary = Array.from(collections.entries()).map(([k, c]) => `${k}=${c.list().length}`).join(', ')
    console.log(`[${opts.name}] listening on :${opts.port}${summary ? ` (${summary})` : ''}`)
  }

  return { app, registerCollection, start }
}
