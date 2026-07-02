import { describe, it, expect } from 'vitest'
import type { FormFieldDef } from '@pouetpouet/shared'
import { closedReason, validateAnswer, isFileValue } from './forms-validate.js'

// Fabrique un champ minimal du type demandé.
function field(partial: Partial<FormFieldDef> & { type: FormFieldDef['type'] }): FormFieldDef {
  return { id: 'f1', label: 'Champ', required: false, ...partial } as FormFieldDef
}

describe('closedReason', () => {
  const OPEN = { acceptingResponses: true, closesAt: null, maxResponses: null }

  it('formulaire ouvert sans contrainte → null', () => {
    expect(closedReason(OPEN, 0)).toBeNull()
  })

  it('fermeture manuelle (acceptingResponses=false) → "manual"', () => {
    expect(closedReason({ ...OPEN, acceptingResponses: false }, 0)).toBe('manual')
  })

  it('date de fermeture dépassée → "date"', () => {
    const past = new Date('2020-01-01T00:00:00Z')
    expect(closedReason({ ...OPEN, closesAt: past }, 0, new Date('2020-06-01'))).toBe('date')
  })

  it('date de fermeture future → null (encore ouvert)', () => {
    const future = new Date('2999-01-01T00:00:00Z')
    expect(closedReason({ ...OPEN, closesAt: future }, 0)).toBeNull()
  })

  it('plafond de réponses atteint (count >= max) → "max"', () => {
    expect(closedReason({ ...OPEN, maxResponses: 3 }, 3)).toBe('max')
  })

  it('plafond de réponses non atteint (count < max) → null', () => {
    expect(closedReason({ ...OPEN, maxResponses: 3 }, 2)).toBeNull()
  })

  it('priorité : fermeture manuelle l\'emporte sur date et plafond', () => {
    const past = new Date('2020-01-01T00:00:00Z')
    expect(closedReason({ acceptingResponses: false, closesAt: past, maxResponses: 1 }, 5)).toBe('manual')
  })
})

describe('validateAnswer — champ requis / vide', () => {
  it('section → toujours valide (pas un champ de données)', () => {
    expect(validateAnswer(field({ type: 'section', required: true }), undefined)).toBeNull()
  })

  it('champ requis vide (undefined) → message requis', () => {
    expect(validateAnswer(field({ type: 'short_text', required: true, label: 'Nom' }), undefined))
      .toBe('Le champ « Nom » est requis')
  })

  it('champ requis vide (chaîne vide) → message requis', () => {
    expect(validateAnswer(field({ type: 'short_text', required: true, label: 'Nom' }), '')).not.toBeNull()
  })

  it('checkboxes requis avec tableau vide → message requis', () => {
    expect(validateAnswer(field({ type: 'checkboxes', required: true, label: 'Choix' }), []))
      .toBe('Le champ « Choix » est requis')
  })

  it('champ optionnel vide → valide', () => {
    expect(validateAnswer(field({ type: 'short_text', required: false }), '')).toBeNull()
  })
})

describe('validateAnswer — number', () => {
  it('valeur non numérique → message "doit être un nombre"', () => {
    expect(validateAnswer(field({ type: 'number', label: 'Âge' }), 'abc')).toBe('« Âge » doit être un nombre')
  })

  it('en dessous du min → message', () => {
    expect(validateAnswer(field({ type: 'number', label: 'Âge', min: 18 }), 10)).toBe('« Âge » doit être ≥ 18')
  })

  it('au dessus du max → message', () => {
    expect(validateAnswer(field({ type: 'number', label: 'Âge', max: 99 }), 120)).toBe('« Âge » doit être ≤ 99')
  })

  it('valeur dans les bornes → valide', () => {
    expect(validateAnswer(field({ type: 'number', label: 'Âge', min: 0, max: 99 }), 42)).toBeNull()
  })

  it('zéro pour un champ number requis → valide (0 n\'est pas "vide")', () => {
    expect(validateAnswer(field({ type: 'number', required: true, min: 0 }), 0)).toBeNull()
  })
})

describe('validateAnswer — texte', () => {
  it('short_text dépasse maxLength → message', () => {
    expect(validateAnswer(field({ type: 'short_text', label: 'Code', maxLength: 3 }), 'abcd'))
      .toBe('« Code » dépasse 3 caractères')
  })

  it('short_text respecte le pattern → valide', () => {
    expect(validateAnswer(field({ type: 'short_text', pattern: '^[0-9]+$' }), '123')).toBeNull()
  })

  it('short_text ne respecte pas le pattern → message format invalide', () => {
    expect(validateAnswer(field({ type: 'short_text', label: 'Num', pattern: '^[0-9]+$' }), 'abc'))
      .toBe('« Num » a un format invalide')
  })

  it('pattern regex invalide → ignoré (pas de crash, valide)', () => {
    expect(validateAnswer(field({ type: 'short_text', pattern: '(' }), 'xyz')).toBeNull()
  })
})

describe('validateAnswer — grid requise', () => {
  it('une ligne sans réponse → message', () => {
    const f = field({ type: 'grid', required: true, label: 'Dispos', gridRows: ['Lun', 'Mar'] })
    expect(validateAnswer(f, { Lun: 'Oui' })).toBe('« Dispos » : répondez à toutes les lignes')
  })

  it('toutes les lignes renseignées → valide', () => {
    const f = field({ type: 'grid', required: true, gridRows: ['Lun', 'Mar'] })
    expect(validateAnswer(f, { Lun: 'Oui', Mar: 'Non' })).toBeNull()
  })
})

describe('isFileValue', () => {
  it('objet avec key → vrai', () => {
    expect(isFileValue({ key: 'forms/x/y.png', filename: 'y.png', size: 10 })).toBe(true)
  })

  it('chaîne / null / objet sans key → faux', () => {
    expect(isFileValue('texte')).toBe(false)
    expect(isFileValue(null)).toBe(false)
    expect(isFileValue({ filename: 'y.png' })).toBe(false)
  })
})
