import { prisma } from '../../lib/prisma.js'
import { readOriginal, sha256, writeSealed } from './signdoc.storage.js'
import { renderFinalPdf } from './signdoc.render.js'
import { selfHostedEngine } from './signdoc.engine.js'

// Compose le PDF final (signatures visuelles + certificat) puis le scelle (PAdES)
// et persiste sealed.pdf + l'empreinte/niveau de sceau. Best-effort sur le sceau :
// en cas d'échec, on conserve quand même le PDF aplati (signatures visibles) avec
// sealLevel null — la preuve forte reste portée par la chaîne d'événements.
export async function finalizeEnvelope(envelopeId: string): Promise<void> {
  const envelope = await prisma.signEnvelope.findUnique({ where: { id: envelopeId } })
  if (!envelope) return
  const recipients = await prisma.signRecipient.findMany({ where: { envelopeId }, orderBy: { routingOrder: 'asc' } })
  const fields = await prisma.signField.findMany({ where: { envelopeId } })
  const head = await prisma.signEvent.findFirst({ where: { envelopeId }, orderBy: { createdAt: 'desc' }, select: { hash: true } })

  const flattened = await renderFinalPdf(readOriginal(envelopeId), envelope, recipients, fields, head?.hash ?? '')

  let finalBytes = flattened
  let sealLevel: string | null = null
  try {
    const sealed = await selfHostedEngine.seal(flattened)
    finalBytes = sealed.sealedBytes
    sealLevel = sealed.sealLevel
  } catch (err) {
    console.error('signdoc: scellage PAdES échoué, PDF aplati conservé', err)
  }

  writeSealed(envelopeId, finalBytes)
  await prisma.signEnvelope.update({ where: { id: envelopeId }, data: { sealedHash: sha256(finalBytes), sealLevel } })
}
