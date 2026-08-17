import { describe, it, expect, afterEach, vi } from 'vitest'
import { isContainedKey } from './storage.js'

// Régression (code review) : une clé forgée par un répondant anonyme
// (ex: '../../../.env') ne doit jamais s'échapper du dossier d'upload en dev local.
describe('isContainedKey — anti path traversal', () => {
  it('clé normale préfixée par module → contenue', () => {
    expect(isContainedKey('forms/abc/1234-doc.png')).toBe(true)
    expect(isContainedKey('parcours/xyz/file.pdf')).toBe(true)
  })

  it('remontée de répertoire (../) → rejetée', () => {
    expect(isContainedKey('forms/abc/../../../.env')).toBe(false)
    expect(isContainedKey('../../../../etc/passwd')).toBe(false)
    expect(isContainedKey('..')).toBe(false)
  })

  it('chemin absolu hors dossier → rejeté', () => {
    expect(isContainedKey('/etc/passwd')).toBe(false)
  })
})

// Régression : STORAGE_DRIVER doit primer sur la déduction via NODE_ENV quand il
// est défini (serveur on-premise, NODE_ENV=production + STORAGE_DRIVER=local), et
// ne rien changer au comportement Cloud Run existant quand il est absent.
describe('IS_LOCAL_DEV — sélection du driver de stockage', () => {
  const ORIGINAL_ENV = { ...process.env }

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.resetModules()
  })

  async function loadIsLocalDev() {
    vi.resetModules()
    const mod = await import('./storage.js')
    return mod.IS_LOCAL_DEV
  }

  it('STORAGE_DRIVER=local force le local même en NODE_ENV=production', async () => {
    process.env.STORAGE_DRIVER = 'local'
    process.env.NODE_ENV = 'production'
    expect(await loadIsLocalDev()).toBe(true)
  })

  it('STORAGE_DRIVER=gcs force GCS même hors production', async () => {
    process.env.STORAGE_DRIVER = 'gcs'
    delete process.env.NODE_ENV
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS
    expect(await loadIsLocalDev()).toBe(false)
  })

  it('STORAGE_DRIVER absent + NODE_ENV=production → GCS (comportement Cloud Run inchangé)', async () => {
    delete process.env.STORAGE_DRIVER
    process.env.NODE_ENV = 'production'
    expect(await loadIsLocalDev()).toBe(false)
  })

  it('STORAGE_DRIVER absent hors production → local (comportement dev inchangé)', async () => {
    delete process.env.STORAGE_DRIVER
    delete process.env.NODE_ENV
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS
    expect(await loadIsLocalDev()).toBe(true)
  })
})
