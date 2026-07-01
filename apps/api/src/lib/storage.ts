import { Storage } from '@google-cloud/storage'
import fs from 'node:fs/promises'
import path from 'node:path'

const BUCKET = process.env.GCS_BUCKET ?? 'pouetpouet-documents'

// En local (pas de credentials GCS), on stocke les fichiers dans .uploads/
// et on expose des endpoints dev /api/parcours/_dev/:key
const IS_LOCAL_DEV = !process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.NODE_ENV !== 'production'
export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), '.uploads')
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

let _storage: Storage | null = null
function gcs() {
  if (!_storage) _storage = new Storage()
  return _storage
}

// Vrai si la clé, résolue, reste contenue dans LOCAL_UPLOAD_DIR (pas de
// path traversal via `../`). Exporté pour être testable unitairement.
export function isContainedKey(key: string): boolean {
  const resolved = path.resolve(LOCAL_UPLOAD_DIR, key)
  return resolved === LOCAL_UPLOAD_DIR || resolved.startsWith(LOCAL_UPLOAD_DIR + path.sep)
}

// Résout un chemin local en garantissant qu'il reste contenu dans LOCAL_UPLOAD_DIR.
// Empêche le path traversal (`../`) via une clé forgée en dev local.
function localPath(key: string): string | null {
  if (!isContainedKey(key)) return null
  return path.resolve(LOCAL_UPLOAD_DIR, key)
}

export async function getUploadSignedUrl(key: string, mimeType: string): Promise<string> {
  if (IS_LOCAL_DEV) {
    const dest = localPath(key)
    if (!dest) throw new Error('Clé de stockage invalide')
    await fs.mkdir(path.dirname(dest), { recursive: true })
    return `${API_BASE}/api/parcours/_dev/${key}?mimeType=${encodeURIComponent(mimeType)}`
  }
  const [url] = await gcs().bucket(BUCKET).file(key).getSignedUrl({
    version: 'v4', action: 'write', expires: Date.now() + 15 * 60 * 1000, contentType: mimeType,
  })
  return url
}

export async function getDownloadSignedUrl(key: string): Promise<string> {
  if (IS_LOCAL_DEV) {
    return `${API_BASE}/api/parcours/_dev/${key}`
  }
  const [url] = await gcs().bucket(BUCKET).file(key).getSignedUrl({
    version: 'v4', action: 'read', expires: Date.now() + 15 * 60 * 1000,
  })
  return url
}

export async function deleteStorageFile(key: string): Promise<void> {
  if (IS_LOCAL_DEV) {
    const dest = localPath(key)
    if (dest) await fs.unlink(dest).catch(() => {})
    return
  }
  await gcs().bucket(BUCKET).file(key).delete({ ignoreNotFound: true })
}

// Écrit/lit un buffer reçu côté serveur (upload public formulaires : on ne passe
// pas par une signed URL côté client car le répondant est anonyme).
export async function saveFile(key: string, buffer: Buffer): Promise<void> {
  if (IS_LOCAL_DEV) {
    const dest = localPath(key)
    if (!dest) throw new Error('Clé de stockage invalide')
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.writeFile(dest, buffer)
    return
  }
  await gcs().bucket(BUCKET).file(key).save(buffer)
}

export async function readFile(key: string): Promise<Buffer | null> {
  if (IS_LOCAL_DEV) {
    const src = localPath(key)
    if (!src) return null
    try { return await fs.readFile(src) } catch { return null }
  }
  try { const [buf] = await gcs().bucket(BUCKET).file(key).download(); return buf } catch { return null }
}
