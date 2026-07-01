import type { FormFieldDef, FormFileValue } from '@pouetpouet/shared'

// Logique pure du module Formulaires, extraite des routes pour être testable
// unitairement (sans Fastify ni base de données).

// Détermine si un formulaire est fermé et pourquoi (date dépassée / plafond
// atteint / fermeture manuelle). Retourne null si le formulaire accepte encore
// des réponses.
export function closedReason(
  f: { acceptingResponses: boolean; closesAt: Date | null; maxResponses: number | null },
  responseCount: number,
  now: Date = new Date(),
): 'manual' | 'date' | 'max' | null {
  if (!f.acceptingResponses) return 'manual'
  if (f.closesAt && f.closesAt < now) return 'date'
  if (f.maxResponses != null && responseCount >= f.maxResponses) return 'max'
  return null
}

// Valide une réponse contre la définition d'un champ. Retourne un message
// d'erreur (destiné à l'utilisateur) ou null si la réponse est valide.
export function validateAnswer(f: FormFieldDef, v: unknown): string | null {
  if (f.type === 'section') return null
  const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
  if (empty) return f.required ? `Le champ « ${f.label} » est requis` : null
  if (f.type === 'number') {
    const n = Number(v)
    if (Number.isNaN(n)) return `« ${f.label} » doit être un nombre`
    if (f.min != null && n < f.min) return `« ${f.label} » doit être ≥ ${f.min}`
    if (f.max != null && n > f.max) return `« ${f.label} » doit être ≤ ${f.max}`
  }
  if ((f.type === 'short_text' || f.type === 'long_text') && typeof v === 'string') {
    if (f.maxLength != null && v.length > f.maxLength) return `« ${f.label} » dépasse ${f.maxLength} caractères`
  }
  if (f.type === 'short_text' && f.pattern && typeof v === 'string') {
    try { if (!new RegExp(f.pattern).test(v)) return `« ${f.label} » a un format invalide` } catch { /* regex invalide → ignorée */ }
  }
  if (f.type === 'grid' && f.required) {
    const ans = (v ?? {}) as Record<string, unknown>
    for (const row of f.gridRows ?? []) {
      const rv = ans[row]
      const missing = rv == null || rv === '' || (Array.isArray(rv) && rv.length === 0)
      if (missing) return `« ${f.label} » : répondez à toutes les lignes`
    }
  }
  return null
}

// Vrai si la valeur ressemble à une pièce jointe uploadée ({ key, filename, size }).
export function isFileValue(v: unknown): v is FormFileValue {
  return !!v && typeof v === 'object' && 'key' in (v as object)
}
