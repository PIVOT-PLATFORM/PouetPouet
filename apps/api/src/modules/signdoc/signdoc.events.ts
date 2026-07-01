import crypto from 'node:crypto'
import type { FastifyRequest } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'

// Chaîne de hachage des événements d'une enveloppe (couche 2 du modèle de sécurité).
// Journal append-only inviolable : chaque ligne référence le hash de la précédente,
// hash = SHA-256(prevHash + canonicalJSON(event)). Altérer/supprimer un événement
// passé casse tous les hash suivants → détectable par verifyChain().

// JSON canonique : clés triées récursivement → empreinte stable indépendante de
// l'ordre de sérialisation (important après un aller-retour JSONB en base).
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(obj[k])}`).join(',')}}`
}

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex')
}

// Corps canonique d'un événement — doit être identique à l'écriture et à la
// vérification pour que les hash concordent.
function eventBody(e: {
  envelopeId: string
  type: string
  recipientId: string | null
  actorLabel: string
  ip: string | null
  userAgent: string | null
  payload: unknown
  createdAt: Date
  prevHash: string | null
}) {
  return {
    envelopeId: e.envelopeId,
    type: e.type,
    recipientId: e.recipientId,
    actorLabel: e.actorLabel,
    ip: e.ip,
    userAgent: e.userAgent,
    payload: e.payload ?? null,
    createdAt: e.createdAt.toISOString(),
    prevHash: e.prevHash,
  }
}

interface RecordOpts {
  actorLabel: string
  recipientId?: string | null
  payload?: Record<string, unknown> | null
  request?: FastifyRequest
}

export async function recordEvent(envelopeId: string, type: string, opts: RecordOpts) {
  const ip = opts.request?.ip ?? null
  const userAgent = (opts.request?.headers['user-agent'] as string | undefined)?.slice(0, 255) ?? null
  const recipientId = opts.recipientId ?? null
  const payload = opts.payload ?? null
  // Sérialisation par enveloppe (verrou consultatif Postgres) : deux écritures
  // concurrentes liraient sinon le même prevHash → chaîne fourchue que
  // verifyChain déclarerait invalide alors que les données sont légitimes.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${envelopeId}))`
    const last = await tx.signEvent.findFirst({
      where: { envelopeId },
      orderBy: { createdAt: 'desc' },
      select: { hash: true, createdAt: true },
    })
    const prevHash = last?.hash ?? null
    // createdAt strictement croissant par enveloppe : verifyChain trie dessus,
    // deux événements dans la même milliseconde rendraient l'ordre ambigu.
    let createdAt = new Date()
    if (last && createdAt.getTime() <= last.createdAt.getTime()) {
      createdAt = new Date(last.createdAt.getTime() + 1)
    }
    const hash = sha256(
      (prevHash ?? '') +
        canonicalJSON(eventBody({ envelopeId, type, recipientId, actorLabel: opts.actorLabel, ip, userAgent, payload, createdAt, prevHash })),
    )
    return tx.signEvent.create({
      data: {
        envelopeId,
        type,
        recipientId,
        actorLabel: opts.actorLabel,
        ip,
        userAgent,
        payload: payload === null ? Prisma.JsonNull : (payload as Prisma.InputJsonValue),
        prevHash,
        hash,
        createdAt,
      },
    })
  })
}

// Recalcule la chaîne et confirme son intégrité (pour PR3 + tests).
export async function verifyChain(envelopeId: string): Promise<boolean> {
  const events = await prisma.signEvent.findMany({ where: { envelopeId }, orderBy: { createdAt: 'asc' } })
  let prevHash: string | null = null
  for (const e of events) {
    if ((e.prevHash ?? null) !== prevHash) return false
    const expected = sha256(
      (prevHash ?? '') +
        canonicalJSON(
          eventBody({
            envelopeId: e.envelopeId,
            type: e.type,
            recipientId: e.recipientId ?? null,
            actorLabel: e.actorLabel,
            ip: e.ip ?? null,
            userAgent: e.userAgent ?? null,
            payload: e.payload ?? null,
            createdAt: e.createdAt,
            prevHash: e.prevHash ?? null,
          }),
        ),
    )
    if (expected !== e.hash) return false
    prevHash = e.hash
  }
  return true
}
