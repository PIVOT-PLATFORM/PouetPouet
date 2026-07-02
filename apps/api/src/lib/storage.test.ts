import { describe, it, expect } from 'vitest'
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
