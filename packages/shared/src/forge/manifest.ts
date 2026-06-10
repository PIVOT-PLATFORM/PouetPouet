// FORGE — contrat d'intégration d'un module.
// Chaque outil de la suite (PouetPouet, Scrum Poker, Daily, La Roue, Capacité…)
// déclare ici ce qu'il possède, ce qu'il référence et ce qu'il émet/écoute.
// C'est ce contrat qui permet aux modules de communiquer au lieu de coexister :
// - "une entité, un propriétaire" : les entités listées dans `ownedEntities`
//   n'ont qu'UN module de référence ; les autres modules les référencent par
//   identifiant (jamais par copie) via `referencedPivots`.
// - chaque liaison automatique inter-modules = un événement déclaré dans
//   `emits` côté producteur et `listensTo` côté consommateur.

export interface ModuleNavLink {
  label: string
  href: string
  /** Préfixe de pathname qui active le lien ('exact' = égalité stricte). */
  match: string | 'exact'
}

export interface ModuleManifest {
  /** Identifiant stable, en kebab-case ('pouetpouet', 'scrum', …). */
  id: string
  name: string
  description: string
  /** Emoji affiché dans le hub/launcher. */
  icon: string
  /** Couleur d'accent du module (classe ou hexa selon l'usage côté shell). */
  color: string
  /** Entrées de navigation montées dans le shell. */
  nav: ModuleNavLink[]
  /** Préfixe REST monté par le socle API (null = pas de routes HTTP). */
  apiPrefix: string | null
  /** Entités dont ce module est le system of record. */
  ownedEntities: string[]
  /** Objets pivots possédés par un autre module et référencés par id. */
  referencedPivots: string[]
  /** Types d'événements publiés sur le bus ('<module>.<entité>.<action>'). */
  emits: string[]
  /** Types d'événements consommés depuis le bus. */
  listensTo: string[]
}
