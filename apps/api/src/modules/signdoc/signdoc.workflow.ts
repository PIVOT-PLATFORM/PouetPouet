import crypto from 'node:crypto'
import { prisma } from '../../lib/prisma.js'
import { notify } from '../../lib/notify.js'
import { sendSignatureRequestEmail } from '../../lib/mailer.js'
import { recordEvent } from './signdoc.events.js'
import type { SignRecipient } from '@prisma/client'

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'
const TOKEN_TTL_DAYS = 30

// Rôles qui doivent agir (bloquent la complétion). CC = simple copie.
const ACTING_ROLES = new Set(['SIGNER', 'APPROVER'])
const DONE = new Set(['SIGNED', 'DECLINED'])

export function isActingRecipient(r: { role: string }): boolean {
  return ACTING_ROLES.has(r.role)
}

// Étape active courante (séquentiel) = plus petit routingOrder parmi les
// signataires acteurs pas encore traités. En parallèle, tous sont actifs.
export function activeOrder(recipients: { routingOrder: number; status: string; role: string }[]): number | null {
  const pending = recipients.filter((r) => isActingRecipient(r) && !DONE.has(r.status))
  if (pending.length === 0) return null
  return Math.min(...pending.map((r) => r.routingOrder))
}

// Un signataire peut-il agir maintenant ? (envelope ordonnée → seulement à son tour)
export function canSignNow(envelope: { ordered: boolean }, recipient: { routingOrder: number; status: string; role: string }, all: { routingOrder: number; status: string; role: string }[]): boolean {
  if (!isActingRecipient(recipient) || DONE.has(recipient.status)) return false
  if (!envelope.ordered) return true
  return recipient.routingOrder === activeOrder(all)
}

// Jeton d'accès externe : valeur en clair (dans le lien) + hash stocké en base.
export function makeToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token) }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function signingLink(token: string): string {
  return `${FRONTEND_URL}/sign/${token}`
}

// Émet (ou ré-émet) la demande de signature à un destinataire : génère un token,
// le persiste, passe le statut à SENT, notifie en in-app (compte interne) + email.
export async function dispatchToRecipient(
  envelope: { id: string; name: string; globalDeadline: Date | null },
  recipient: SignRecipient,
): Promise<void> {
  const { token, hash } = makeToken()
  const expires = recipient.deadline ?? envelope.globalDeadline ?? new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000)
  await prisma.signRecipient.update({
    where: { id: recipient.id },
    data: { accessTokenHash: hash, tokenExpires: expires, status: 'SENT', authMethod: 'email-link' },
  })
  const link = signingLink(token)
  if (recipient.userId) {
    await notify({
      userId: recipient.userId,
      type: 'SIGN_REQUESTED',
      title: 'Un document vous attend',
      body: `« ${envelope.name} » est à signer.`,
      link: `/sign/${token}`,
    })
  }
  await sendSignatureRequestEmail(recipient.email, recipient.name, envelope.name, link, expires.toISOString())
}

// Relance un destinataire : régénère un lien (nouveau jeton), renotifie
// (in-app + email) et journalise un événement 'reminded'. Ne change pas le statut.
export async function remindRecipient(
  envelope: { id: string; name: string; globalDeadline: Date | null },
  recipient: SignRecipient,
): Promise<void> {
  const { token, hash } = makeToken()
  const expires = recipient.deadline ?? envelope.globalDeadline ?? new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000)
  await prisma.signRecipient.update({ where: { id: recipient.id }, data: { accessTokenHash: hash, tokenExpires: expires } })
  const link = signingLink(token)
  if (recipient.userId) {
    await notify({ userId: recipient.userId, type: 'SIGN_REQUESTED', title: 'Rappel : document à signer', body: `« ${envelope.name} » attend votre signature.`, link: `/sign/${token}` })
  }
  await sendSignatureRequestEmail(recipient.email, recipient.name, envelope.name, link, expires.toISOString())
  await recordEvent(envelope.id, 'reminded', { actorLabel: 'system', recipientId: recipient.id })
}

// Notifie les destinataires de la (nouvelle) étape active qui n'ont pas encore
// reçu leur lien. Renvoie le nombre de demandes émises.
export async function dispatchActiveStep(envelopeId: string): Promise<number> {
  const envelope = await prisma.signEnvelope.findUnique({ where: { id: envelopeId }, select: { id: true, name: true, ordered: true, globalDeadline: true } })
  if (!envelope) return 0
  const recipients = await prisma.signRecipient.findMany({ where: { envelopeId } })
  const order = activeOrder(recipients)
  const targets = recipients.filter((r) => {
    if (!isActingRecipient(r) || DONE.has(r.status)) return false
    if (envelope.ordered && r.routingOrder !== order) return false
    return r.status === 'PENDING' // pas encore notifié
  })
  for (const r of targets) await dispatchToRecipient(envelope, r)
  return targets.length
}
