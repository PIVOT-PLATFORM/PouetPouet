import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { runFormReminders } from './forms.scheduler.js'
import { prisma } from '../../lib/prisma.js'
import crypto from 'node:crypto'

const SUFFIX = '@forms-sched.int.test'
const HOUR = 3_600_000
const DAY = 24 * HOUR
// Fixé en journée (10h) pour rester dans la fenêtre d'envoi 8h–18h du scheduler.
const NOON = new Date(); NOON.setHours(10, 0, 0, 0)

async function makeOwner() {
  return prisma.user.create({ data: { email: `owner-${Date.now()}-${Math.random()}${SUFFIX}`, name: 'Owner', password: 'x', emailVerified: true } })
}

async function makeForm(ownerId: string, patch: Partial<{ remindersEnabled: boolean; reminderFrequencyDays: number; acceptingResponses: boolean }> = {}) {
  return prisma.form.create({
    data: {
      ownerId,
      title: 'Form',
      isPublished: true,
      publicToken: crypto.randomBytes(9).toString('base64url'),
      remindersEnabled: true,
      reminderFrequencyDays: 7,
      ...patch,
    },
  })
}

async function makeRecipient(formId: string, patch: Partial<{ invitedAt: Date; lastRemindedAt: Date; respondedAt: Date | null }> = {}) {
  return prisma.formRecipient.create({
    data: {
      formId,
      name: 'R',
      email: `r-${Date.now()}-${Math.random()}${SUFFIX}`,
      token: crypto.randomBytes(24).toString('base64url'),
      invitedAt: new Date(NOON.getTime() - 8 * DAY),
      ...patch,
    },
  })
}

describe('Forms — relances automatiques planifiées (integration)', () => {
  beforeAll(async () => { await cleanup() })
  afterAll(async () => { await cleanup() })
  async function cleanup() { await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } }) }

  it('relance un destinataire non-répondant dont la fréquence est due', async () => {
    const owner = await makeOwner()
    const form = await makeForm(owner.id)
    const rec = await makeRecipient(form.id)

    const res = await runFormReminders(NOON)
    expect(res.reminded).toBe(1)
    const refreshed = await prisma.formRecipient.findUnique({ where: { id: rec.id } })
    expect(refreshed?.lastRemindedAt).not.toBeNull()
    expect(refreshed?.remindersSent).toBe(1)
  })

  it('ne relance pas si la fréquence n\'est pas encore due', async () => {
    const owner = await makeOwner()
    const form = await makeForm(owner.id)
    await makeRecipient(form.id, { invitedAt: new Date(NOON.getTime() - 2 * DAY) }) // fréquence 7j, dû dans 5j

    const res = await runFormReminders(NOON)
    expect(res.reminded).toBe(0)
  })

  it('respecte le cooldown de 20h même si la fréquence est due', async () => {
    const owner = await makeOwner()
    const form = await makeForm(owner.id, { reminderFrequencyDays: 1 })
    await makeRecipient(form.id, {
      invitedAt: new Date(NOON.getTime() - 10 * DAY),
      lastRemindedAt: new Date(NOON.getTime() - 2 * HOUR), // relancé il y a 2h < cooldown 20h
    })

    const res = await runFormReminders(NOON)
    expect(res.reminded).toBe(0)
  })

  it('ne relance pas un destinataire ayant déjà répondu', async () => {
    const owner = await makeOwner()
    const form = await makeForm(owner.id)
    await makeRecipient(form.id, { respondedAt: new Date() })

    const res = await runFormReminders(NOON)
    expect(res.reminded).toBe(0)
  })

  it('ne relance pas si les relances automatiques sont désactivées', async () => {
    const owner = await makeOwner()
    const form = await makeForm(owner.id, { remindersEnabled: false })
    await makeRecipient(form.id)

    const res = await runFormReminders(NOON)
    expect(res.reminded).toBe(0)
  })

  it('ne relance pas un formulaire fermé (arrêt naturel)', async () => {
    const owner = await makeOwner()
    const form = await makeForm(owner.id, { acceptingResponses: false })
    await makeRecipient(form.id)

    const res = await runFormReminders(NOON)
    expect(res.reminded).toBe(0)
  })

  it('hors fenêtre d\'envoi (nuit) → aucune relance', async () => {
    const owner = await makeOwner()
    const form = await makeForm(owner.id)
    await makeRecipient(form.id)

    const night = new Date(NOON); night.setHours(23, 0, 0, 0)
    const res = await runFormReminders(night)
    expect(res.reminded).toBe(0)
  })
})
