import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

// Stockage fichier des enveloppes SignDoc — un dossier par enveloppe, miroir du
// module PDF (filesystem local). L'original est figé à la création ; le PDF scellé
// (sealed.pdf) arrivera en PR3.
const SIGNDOC_DIR = path.resolve(process.env.SIGNDOC_DIR ?? './uploads/signdoc')

export function envelopeDir(id: string): string {
  return path.join(SIGNDOC_DIR, id)
}
export function originalPath(id: string): string {
  return path.join(envelopeDir(id), 'original.pdf')
}
export function sealedPath(id: string): string {
  return path.join(envelopeDir(id), 'sealed.pdf')
}

export function writeOriginal(id: string, bytes: Buffer): void {
  mkdirSync(envelopeDir(id), { recursive: true })
  writeFileSync(originalPath(id), bytes)
}

export function readOriginal(id: string): Buffer {
  return readFileSync(originalPath(id))
}

export function originalExists(id: string): boolean {
  return existsSync(originalPath(id))
}

export function originalStream(id: string) {
  return createReadStream(originalPath(id))
}

export function writeSealed(id: string, bytes: Buffer): void {
  mkdirSync(envelopeDir(id), { recursive: true })
  writeFileSync(sealedPath(id), bytes)
}
export function sealedExists(id: string): boolean {
  return existsSync(sealedPath(id))
}
export function readSealed(id: string): Buffer {
  return readFileSync(sealedPath(id))
}
export function sealedStream(id: string) {
  return createReadStream(sealedPath(id))
}

export function deleteEnvelopeFiles(id: string): void {
  const dir = envelopeDir(id)
  if (existsSync(dir)) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* best-effort */
    }
  }
}

// SHA-256 hex des octets du document — empreinte d'intégrité figée à la création.
export function sha256(bytes: Buffer): string {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}
