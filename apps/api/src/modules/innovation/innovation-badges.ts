// Gamification (PR E, lot pré-release) : points et badges calculés à la volée à partir
// des compteurs existants (fiches créées, votes reçus, challenges gagnés) — pas de
// ledger persisté ni d'historique de date d'obtention, cohérent avec le choix de
// simplicité déjà fait sur les commentaires à plat.

export interface InnovationContributionStats {
  ficheCount: number
  votesReceived: number
  challengesWon: number
}

export interface InnovationBadgeDef {
  id: string
  label: string
  icon: string
  description: string
  check: (stats: InnovationContributionStats) => boolean
}

export const INNOVATION_BADGES: InnovationBadgeDef[] = [
  { id: 'first-fiche', label: 'Premier pas', icon: '🌱', description: 'Publier une première fiche', check: (s) => s.ficheCount >= 1 },
  { id: 'five-fiches', label: 'Contributeur régulier', icon: '💡', description: 'Publier 5 fiches', check: (s) => s.ficheCount >= 5 },
  { id: 'ten-votes', label: 'Voix qui compte', icon: '👍', description: 'Recevoir 10 votes au total', check: (s) => s.votesReceived >= 10 },
  { id: 'first-win', label: 'Lauréat', icon: '🏆', description: 'Gagner un challenge', check: (s) => s.challengesWon >= 1 },
]

export function computePoints(stats: InnovationContributionStats): number {
  return stats.ficheCount * 1 + stats.votesReceived * 2 + stats.challengesWon * 5
}
