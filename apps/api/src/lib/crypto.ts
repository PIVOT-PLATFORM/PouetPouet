import crypto from 'node:crypto'

// Chiffrement symétrique au repos (tokens OAuth Microsoft, etc.).
// Clé dérivée par scrypt d'un secret d'environnement : MS_GRAPH_TOKEN_KEY si fourni,
// sinon JWT_SECRET (déjà requis par l'app). AES-256-GCM = confidentialité + intégrité.

const SECRET = process.env.MS_GRAPH_TOKEN_KEY ?? process.env.JWT_SECRET ?? ''
const key = SECRET ? crypto.scryptSync(SECRET, 'pivot-secret-box', 32) : null

export const isCryptoConfigured = Boolean(key)

/** Chiffre une chaîne → "iv.tag.ciphertext" (base64). */
export function encryptSecret(plain: string): string {
  if (!key) throw new Error('Chiffrement non configuré (JWT_SECRET / MS_GRAPH_TOKEN_KEY manquant)')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.')
}

/** Déchiffre une chaîne produite par encryptSecret. */
export function decryptSecret(payload: string): string {
  if (!key) throw new Error('Chiffrement non configuré')
  const [ivB, tagB, dataB] = payload.split('.')
  if (!ivB || !tagB || !dataB) throw new Error('Payload chiffré invalide')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]).toString('utf8')
}
