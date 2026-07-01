import { PDFDocument } from 'pdf-lib'
import { SignPdf } from '@signpdf/signpdf'
import { P12Signer } from '@signpdf/signer-p12'
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib'
import { getServerP12 } from './signdoc.crypto.js'

// Abstraction du moteur de signature — point d'extension pour brancher un
// prestataire qualifié (QTSP → QES eIDAS) plus tard sans refondre le module.
// Implémentation auto-hébergée : sceau serveur PAdES (PKCS#7) sur le PDF final.

export interface SealResult {
  sealedBytes: Buffer
  /** Niveau PAdES : 'T' = horodatage TSA externe, 'B' = horloge serveur seule. */
  sealLevel: 'B' | 'T'
}

export interface SignatureEngine {
  seal(pdfBytes: Buffer): Promise<SealResult>
}

// Sceau auto-hébergé : appose une signature numérique PAdES sur le PDF avec la
// clé du serveur. Tout changement d'octet postérieur invalide le sceau
// (vérifiable par Adobe Reader / tout validateur PAdES). L'horodatage RFC 3161
// (PAdES-T) est un point d'extension : tant qu'aucune TSA n'est branchée, on
// scelle au niveau B (horloge serveur), couplé à la chaîne de hachage.
export const selfHostedEngine: SignatureEngine = {
  async seal(pdfBytes: Buffer): Promise<SealResult> {
    const { p12, passphrase } = getServerP12()
    const pdfDoc = await PDFDocument.load(pdfBytes)
    pdflibAddPlaceholder({
      pdfDoc,
      reason: 'Document scellé par Pivot SignDoc',
      contactInfo: 'signdoc@pivot',
      name: 'Pivot SignDoc',
      location: 'Auto-hébergé',
    })
    const withPlaceholder = Buffer.from(await pdfDoc.save({ useObjectStreams: false }))
    const signed = await new SignPdf().sign(withPlaceholder, new P12Signer(p12, { passphrase }))
    return { sealedBytes: Buffer.from(signed), sealLevel: 'B' }
  },
}
