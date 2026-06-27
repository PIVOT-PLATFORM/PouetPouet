// Moteur de tutoriels — définitions déclaratives.
//
// Types de step :
//   'centered'    — plein écran grisé, carte centrée. Clic n'importe où = suivant.
//   'spotlight'   — zone éclairée (data-tutorial). Bandes sombres bloquent les clics
//                   en dehors de la cible. La cible est totalement interactive (vrai UI).
//                   'blocked' permet de re-masquer certains éléments dans le trou.
//   'interactive' — aucune bande : tout le board est accessible. Idéal quand une modale
//                   doit s'ouvrir depuis la zone ciblée. Anneau lumineux sur la cible.

export type StepKind = 'centered' | 'spotlight' | 'interactive'

export interface TutorialContext {
  isReadonly: boolean
  isOwner: boolean
  canEdit: boolean
  drawing: boolean
  frames: boolean
  voting: boolean
  timer: boolean
  fields: boolean
  tables: boolean
}

export interface TutorialStep {
  kind?: StepKind
  /** Sélecteur `data-tutorial` de la cible, ou `null` pour les étapes centrées. */
  target: string | null
  title: string
  body: string
  /** Marge (px) autour de la zone éclairée. Défaut : 8. */
  pad?: number
  /**
   * Éléments à masquer en plus, même s'ils tombent dans le trou spotlight.
   * Ex : ['board-toolbar'] pour cacher la barre d'outils quand on spotlight le canevas.
   */
  blocked?: string[]
  /** Filtre : l'étape n'est gardée que si le prédicat renvoie `true`. */
  when?: (ctx: TutorialContext) => boolean
  /** Dernier step : affiche les boutons "Terminé" + "Reset". */
  isOutro?: boolean
}
