import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { runSigndocMaintenance } from './signdoc.scheduler.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@signdoc-sched.int.test'
const HOUR = 3_600_000

async function makeOwner() {
  return prisma.user.create({ data: { email: `owner-${Date.now()}${SUFFIX}`, name: 'Owner', password: 'x', emailVerified: true } })
}

describe('signdoc — maintenance planifiée (integration)', () => {
  beforeAll(async () => { await cleanup() })
  afterAll(async () => { await cleanup() })
  async function cleanup() { await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } }) }

  it('expire les enveloppes dont la date butoir est dépassée', async () => {
    const owner = await makeOwner()
    const env = await prisma.signEnvelope.create({
      data: { ownerId: owner.id, name: 'En retard', originalHash: 'h', pageCount: 1, status: 'SENT', globalDeadline: new Date(Date.now() - HOUR) },
    })
    await prisma.signRecipient.create({ data: { envelopeId: env.id, email: `r${SUFFIX}`, name: 'R', status: 'SENT', accessTokenHash: 'live-hash' } })

    const res = await runSigndocMaintenance()
    expect(res.expired).toBeGreaterThanOrEqual(1)

    const after = await prisma.signEnvelope.findUnique({ where: { id: env.id } })
    expect(after?.status).toBe('EXPIRED')
    const recip = await prisma.signRecipient.findFirst({ where: { envelopeId: env.id } })
    expect(recip?.accessTokenHash).toBeNull() // jeton invalidé
    const evt = await prisma.signEvent.findFirst({ where: { envelopeId: env.id, type: 'expired' } })
    expect(evt).toBeTruthy()
  })

  it('relance un signataire dont l’échéance approche, puis respecte le cooldown', async () => {
    const owner = await makeOwner()
    const env = await prisma.signEnvelope.create({
      data: { ownerId: owner.id, name: 'Bientôt', originalHash: 'h', pageCount: 1, status: 'SENT', ordered: false, globalDeadline: new Date(Date.now() + 24 * HOUR) },
    })
    const r = await prisma.signRecipient.create({ data: { envelopeId: env.id, email: `s${SUFFIX}`, name: 'S', status: 'SENT' } })

    const first = await runSigndocMaintenance()
    expect(first.reminded).toBeGreaterThanOrEqual(1)
    const reminders = await prisma.signEvent.count({ where: { envelopeId: env.id, type: 'reminded' } })
    expect(reminders).toBe(1)
    const refreshed = await prisma.signRecipient.findUnique({ where: { id: r.id } })
    expect(refreshed?.accessTokenHash).toBeTruthy() // nouveau lien généré

    // Deuxième passage immédiat : cooldown → pas de nouvelle relance.
    await runSigndocMaintenance()
    expect(await prisma.signEvent.count({ where: { envelopeId: env.id, type: 'reminded' } })).toBe(1)
  })

  it('ne relance pas si l’échéance est lointaine', async () => {
    const owner = await makeOwner()
    const env = await prisma.signEnvelope.create({
      data: { ownerId: owner.id, name: 'Loin', originalHash: 'h', pageCount: 1, status: 'SENT', ordered: false, globalDeadline: new Date(Date.now() + 10 * 24 * HOUR) },
    })
    await prisma.signRecipient.create({ data: { envelopeId: env.id, email: `t${SUFFIX}`, name: 'T', status: 'SENT' } })

    await runSigndocMaintenance()
    expect(await prisma.signEvent.count({ where: { envelopeId: env.id, type: 'reminded' } })).toBe(0)
  })

  it('alerte le propriétaire (une seule fois) quand une échéance individuelle est dépassée, sans expirer l’enveloppe', async () => {
    const owner = await makeOwner()
    const env = await prisma.signEnvelope.create({
      data: { ownerId: owner.id, name: 'Étape en retard', originalHash: 'h', pageCount: 1, status: 'SENT', ordered: false },
    })
    await prisma.signRecipient.create({
      data: { envelopeId: env.id, email: `u${SUFFIX}`, name: 'U', status: 'SENT', accessTokenHash: 'still-alive', deadline: new Date(Date.now() - HOUR) },
    })

    const res = await runSigndocMaintenance()
    expect(res.deadlineAlerts).toBeGreaterThanOrEqual(1)
    expect(await prisma.signEvent.count({ where: { envelopeId: env.id, type: 'deadline_missed' } })).toBe(1)
    // Pas d'expiration : l'enveloppe reste active et le jeton vivant.
    const after = await prisma.signEnvelope.findUnique({ where: { id: env.id } })
    expect(after?.status).toBe('SENT')
    const recip = await prisma.signRecipient.findFirst({ where: { envelopeId: env.id } })
    expect(recip?.accessTokenHash).toBe('still-alive')
    // Deuxième passage : pas de double alerte.
    await runSigndocMaintenance()
    expect(await prisma.signEvent.count({ where: { envelopeId: env.id, type: 'deadline_missed' } })).toBe(1)
  })
})
