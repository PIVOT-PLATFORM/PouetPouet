// Calcul de classement pur (testable sans DB) — moyenne pondérée par critère.
// Un critère non encore noté par aucun juré est exclu du calcul plutôt que compté
// comme 0 : le classement reste représentatif pendant une évaluation partielle.

export interface ScoreRow {
  entryId: string
  criterionId: string
  note: number
}

export interface CriterionRow {
  id: string
  poids: number
}

export interface EntryRow {
  id: string
  ficheId: string
}

export interface CriterionAverage {
  criterionId: string
  average: number | null
}

export interface RankedEntry {
  entryId: string
  ficheId: string
  weightedAverage: number | null
  criteriaAverages: CriterionAverage[]
}

export function computeRanking(entries: EntryRow[], criteria: CriterionRow[], scores: ScoreRow[]): RankedEntry[] {
  const poidsById = new Map(criteria.map((c) => [c.id, c.poids]))

  const ranked = entries.map((entry) => {
    const criteriaAverages: CriterionAverage[] = criteria.map((c) => {
      const notes = scores.filter((s) => s.entryId === entry.id && s.criterionId === c.id).map((s) => s.note)
      return { criterionId: c.id, average: notes.length > 0 ? notes.reduce((a, b) => a + b, 0) / notes.length : null }
    })

    const scored = criteriaAverages.filter((c): c is { criterionId: string; average: number } => c.average !== null)
    const totalWeight = scored.reduce((sum, c) => sum + (poidsById.get(c.criterionId) ?? 0), 0)
    const weightedAverage = scored.length > 0 && totalWeight > 0
      ? scored.reduce((sum, c) => sum + c.average * (poidsById.get(c.criterionId) ?? 0), 0) / totalWeight
      : null

    return { entryId: entry.id, ficheId: entry.ficheId, weightedAverage, criteriaAverages }
  })

  return ranked.sort((a, b) => (b.weightedAverage ?? -1) - (a.weightedAverage ?? -1))
}
