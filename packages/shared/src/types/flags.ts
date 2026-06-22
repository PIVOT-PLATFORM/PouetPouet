// Feature flags — catalogue typé partagé API/web + types d'évaluation.
//
// Le CODE définit quels flags existent et leur défaut (FLAG_DEFINITIONS) ;
// la BASE ne stocke que les surcharges runtime (enabled / rolloutPercent / whitelist),
// par environnement. Un flag sans ligne en base ⇒ enabled = defaultEnabled, rollout = 100.

export interface FlagDefinition {
  key: string
  label: string
  description: string
  defaultEnabled: boolean
}

export const FLAG_DEFINITIONS: FlagDefinition[] = [
  // Gating des modules du Hub — clé = `module.<id>` (cf. PIVOT_MODULES).
  { key: 'module.daily', label: 'Module Daily', description: 'Active le module Daily (Hub + accès direct /daily).', defaultEnabled: true },
  { key: 'module.scrum', label: 'Module Scrum Poker', description: 'Active le module Scrum Poker (Hub + accès direct /scrum).', defaultEnabled: true },
  { key: 'module.wheel', label: 'Module La Roue', description: 'Active le module La Roue (Hub + accès direct /wheel).', defaultEnabled: true },
  { key: 'module.capacity', label: 'Module Capacité', description: 'Active le module Capacité (Hub + accès direct /capacity).', defaultEnabled: true },
  { key: 'module.meetops', label: 'Module MeetOps', description: 'Active le module MeetOps (Hub + accès direct /meetops).', defaultEnabled: true },
  { key: 'module.quiz', label: 'Module Quiz interactif', description: 'Active le module Quiz interactif (Hub + accès direct /quiz).', defaultEnabled: true },
  // Fonctionnalités board — gating in-code via useFlag().
  { key: 'board.tables', label: 'Tableaux sur les boards', description: "Active l'outil Tableau dans l'éditeur de board.", defaultEnabled: true },
]

export const FLAG_KEYS: string[] = FLAG_DEFINITIONS.map((f) => f.key)

// Résultat d'évaluation envoyé au client : clé → actif pour cet utilisateur.
export type EvaluatedFlags = Record<string, boolean>

// Objet complet pour l'admin : catalogue fusionné avec l'état runtime de l'environnement courant.
export interface AdminFlag {
  key: string
  label: string
  description: string
  defaultEnabled: boolean
  environment: string
  enabled: boolean
  rolloutPercent: number
  whitelist: string[]
}
