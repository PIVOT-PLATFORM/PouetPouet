// MeetOps — expansion d'une règle de récurrence en dates d'occurrences.
// Fonction pure (pas d'I/O) : utilisée côté API pour générer les réunions et
// côté web pour prévisualiser. Le fuseau est celui de l'environnement d'exécution
// (cohérent serveur + client tant que tous deux stockent/affichent en local).

export type RecurrenceFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export interface RecurrenceRule {
  freq: RecurrenceFreq
  /** Pas entre deux occurrences (toutes les N jours / semaines / mois). >= 1. */
  interval: number
  /** Date + heure de la première occurrence (ISO). L'heure sert d'ancre horaire. */
  startDate: string
  /** WEEKLY uniquement : jours ciblés (0 = dimanche … 6 = samedi). */
  daysOfWeek?: number[]
  /** Fin par date incluse (ISO). Prioritaire sur `count` si les deux sont fournis. */
  until?: string
  /** Fin par nombre d'occurrences. */
  count?: number
}

/** Garde-fou : jamais plus d'occurrences que ça en une génération. */
export const MAX_OCCURRENCES = 200

function atTime(base: Date, hours: number, minutes: number): Date {
  const d = new Date(base)
  d.setHours(hours, minutes, 0, 0)
  return d
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/**
 * Étend une règle de récurrence en une liste de dates d'occurrences, triée.
 * S'arrête au premier atteint entre `until`, `count` et MAX_OCCURRENCES.
 */
export function expandRecurrence(rule: RecurrenceRule): Date[] {
  const interval = Math.max(1, Math.floor(rule.interval || 1))
  const anchor = new Date(rule.startDate)
  if (Number.isNaN(anchor.getTime())) return []

  const hours = anchor.getHours()
  const minutes = anchor.getMinutes()
  const until = rule.until ? atTime(new Date(rule.until), 23, 59) : null
  const cap = Math.min(rule.count ?? MAX_OCCURRENCES, MAX_OCCURRENCES)

  const out: Date[] = []
  const push = (d: Date): boolean => {
    if (until && d > until) return false
    if (d < atTime(anchor, hours, minutes)) return true // avant l'ancre : ignorer, continuer
    out.push(d)
    return out.length < cap
  }

  if (rule.freq === 'DAILY') {
    for (let i = 0; ; i++) {
      const d = atTime(addDays(anchor, i * interval), hours, minutes)
      if (until && d > until) break
      if (!push(d)) break
    }
    return out.slice(0, cap)
  }

  if (rule.freq === 'WEEKLY') {
    const days = rule.daysOfWeek && rule.daysOfWeek.length > 0
      ? [...new Set(rule.daysOfWeek)].sort((a, b) => a - b)
      : [anchor.getDay()]
    // Début de la semaine de l'ancre (dimanche).
    const weekStart = atTime(addDays(anchor, -anchor.getDay()), hours, minutes)
    for (let w = 0; ; w++) {
      const blockStart = addDays(weekStart, w * interval * 7)
      if (until && blockStart > until) break
      let added = false
      for (const day of days) {
        const d = atTime(addDays(blockStart, day), hours, minutes)
        if (until && d > until) continue
        if (d < atTime(anchor, hours, minutes)) continue
        out.push(d)
        added = true
        if (out.length >= cap) break
      }
      if (out.length >= cap) break
      // Évite une boucle infinie si tout est filtré et qu'il n'y a pas de `until`.
      if (!until && !added && blockStart > anchor && w > 0) {
        if (out.length === 0) break
      }
      // Sécurité absolue.
      if (w > MAX_OCCURRENCES * 7) break
    }
    out.sort((a, b) => a.getTime() - b.getTime())
    return out.slice(0, cap)
  }

  // MONTHLY : même quantième chaque `interval` mois (ramené au dernier jour si débordement).
  const day = anchor.getDate()
  for (let i = 0; ; i++) {
    const base = new Date(anchor)
    base.setDate(1)
    base.setMonth(base.getMonth() + i * interval)
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
    base.setDate(Math.min(day, lastDay))
    const d = atTime(base, hours, minutes)
    if (until && d > until) break
    if (!push(d)) break
    if (i > MAX_OCCURRENCES) break
  }
  return out.slice(0, cap)
}
