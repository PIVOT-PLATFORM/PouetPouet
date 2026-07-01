import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { SignEnvelope, SignRecipient, SignField } from '@prisma/client'

// Compose le PDF final : appose les signatures visuelles à leur emplacement puis
// ajoute une page « certificat de réalisation » (preuve lisible). Le résultat
// sera ensuite scellé (PAdES) par le moteur de signature.

function fmt(d: Date | null): string {
  return d ? new Date(d).toLocaleString('fr-FR') : '—'
}

export async function renderFinalPdf(
  originalBytes: Buffer,
  envelope: SignEnvelope,
  recipients: SignRecipient[],
  fields: SignField[],
  chainHead: string,
): Promise<Buffer> {
  const pdf = await PDFDocument.load(originalBytes)
  const pages = pdf.getPages()
  const font = await pdf.embedFont(StandardFonts.Helvetica)

  // 1) Signatures visuelles à leur position (fractions 0..1, origine haut-gauche).
  for (const f of fields) {
    const page = pages[f.page]
    if (!page || !f.value) continue
    const { width: W, height: H } = page.getSize()
    const x = f.x * W
    const w = f.w * W
    const h = f.h * H
    const y = H - f.y * H - h // conversion vers l'origine bas-gauche de pdf-lib
    if ((f.type === 'SIGNATURE' || f.type === 'INITIALS') && f.value.startsWith('data:image')) {
      try {
        const png = await pdf.embedPng(Buffer.from(f.value.split(',')[1] ?? '', 'base64'))
        page.drawImage(png, { x, y, width: w, height: h })
      } catch {
        /* image illisible : on ignore le visuel, la preuve reste dans le certificat */
      }
    } else {
      page.drawText(f.value.slice(0, 120), { x: x + 2, y: y + h / 2 - 4, size: 9, font, color: rgb(0.07, 0.09, 0.15) })
    }
  }

  // 2) Page certificat de réalisation.
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let page = pdf.addPage()
  const { height: H } = page.getSize()
  let y = H - 60
  const line = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number] } = {}) => {
    page.drawText(text, { x: 50, y, size: opts.size ?? 10, font: opts.bold ? bold : font, color: rgb(...(opts.color ?? [0.1, 0.1, 0.12])) })
    y -= (opts.size ?? 10) + 8
  }

  line('Certificat de réalisation — Pivot SignDoc', { size: 18, bold: true, color: [0.05, 0.58, 0.53] })
  y -= 6
  line(`Document : ${envelope.name}`, { size: 12, bold: true })
  line(`Identifiant d'enveloppe : ${envelope.id}`)
  line(`Statut : ${envelope.status}`)
  line(`Créée le : ${fmt(envelope.createdAt)}`)
  line(`Finalisée le : ${fmt(envelope.completedAt)}`)
  y -= 6
  line('Intégrité', { size: 12, bold: true })
  line(`Empreinte du document original (SHA-256) : ${envelope.originalHash}`, { size: 8 })
  line(`Tête de chaîne de preuve (SHA-256) : ${chainHead}`, { size: 8 })
  y -= 6
  line('Signataires', { size: 12, bold: true })
  for (const r of recipients) {
    line(`• ${r.name} <${r.email}>${r.userId ? '' : ' (externe)'}`, { size: 10, bold: true })
    line(`   Statut : ${r.status}   Signé le : ${fmt(r.signedAt)}   IP : ${r.ip ?? '—'}`, { size: 8, color: [0.4, 0.4, 0.45] })
    if (y < 80) { page = pdf.addPage(); y = page.getSize().height - 60 } // rebind : line() dessine sur la page courante
  }
  y -= 10
  line('Ce certificat atteste du parcours de signature. Toute modification ultérieure du', { size: 8, color: [0.5, 0.5, 0.55] })
  line('document scellé invalide la signature numérique apposée par le serveur.', { size: 8, color: [0.5, 0.5, 0.55] })

  return Buffer.from(await pdf.save())
}
