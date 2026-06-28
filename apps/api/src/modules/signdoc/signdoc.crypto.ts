import crypto from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import forge from 'node-forge'

// Clé de scellage du serveur (modèle « notaire »). En prod : fournie via secret
// SIGNDOC_P12_BASE64 (+ SIGNDOC_P12_PASS). En dev : un PKCS#12 auto-signé est
// généré une fois puis persisté sur disque pour rester stable entre redémarrages.
// Jamais commité.

const SIGNDOC_DIR = path.resolve(process.env.SIGNDOC_DIR ?? './uploads/signdoc')
const P12_PATH = path.join(SIGNDOC_DIR, 'server.p12')
const PASSPHRASE = process.env.SIGNDOC_P12_PASS ?? 'pivot-signdoc-dev'

let cached: { p12: Buffer; passphrase: string } | null = null

function generateP12(passphrase: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01' + crypto.randomBytes(8).toString('hex')
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10)
  const attrs = [
    { name: 'commonName', value: 'Pivot SignDoc' },
    { name: 'organizationName', value: 'Pivot' },
    { shortName: 'OU', value: 'SignDoc Self-Hosted' },
  ]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', digitalSignature: true, nonRepudiation: true, keyCertSign: true },
  ])
  cert.sign(keys.privateKey, forge.md.sha256.create())
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, { algorithm: '3des' })
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary')
}

// Renvoie le PKCS#12 du serveur (+ sa passphrase), en le chargeant/générant au besoin.
export function getServerP12(): { p12: Buffer; passphrase: string } {
  if (cached) return cached
  const envB64 = process.env.SIGNDOC_P12_BASE64
  if (envB64) {
    cached = { p12: Buffer.from(envB64, 'base64'), passphrase: PASSPHRASE }
    return cached
  }
  mkdirSync(SIGNDOC_DIR, { recursive: true })
  if (existsSync(P12_PATH)) {
    cached = { p12: readFileSync(P12_PATH), passphrase: PASSPHRASE }
    return cached
  }
  const p12 = generateP12(PASSPHRASE)
  writeFileSync(P12_PATH, p12)
  cached = { p12, passphrase: PASSPHRASE }
  return cached
}
