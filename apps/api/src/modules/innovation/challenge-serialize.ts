// Sérialisation pure d'un challenge innovation. Extraite pour être testable
// unitairement, comme innovation-serialize.ts.

export type ChallengeRow = {
  id: string
  nom: string
  description: string
  theme: string | null
  status: string
  opensAt: Date | null
  closesAt: Date | null
  ownerId: string
  orgUnitRef: string | null
  createdAt: Date
  updatedAt: Date
  _count: { entries: number }
}

export function serializeChallenge(c: ChallengeRow) {
  return {
    id: c.id,
    nom: c.nom,
    description: c.description,
    theme: c.theme,
    status: c.status,
    opensAt: c.opensAt,
    closesAt: c.closesAt,
    ownerId: c.ownerId,
    orgUnitRef: c.orgUnitRef,
    entryCount: c._count.entries,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}
