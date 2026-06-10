// FORGE — enveloppe des événements inter-modules.
// Le type transite par le bus (in-process aujourd'hui, Redis pub/sub demain) ;
// il est dans shared pour que producteurs et consommateurs partagent le contrat.

export interface ForgeEvent<T = unknown> {
  /** '<module>.<entité>.<action>' — ex. 'scrum.ticket.estimated'. */
  type: string
  /** Id du module émetteur (cf. ModuleManifest.id, 'core' pour le socle). */
  module: string
  /** Horodatage ISO, posé par le bus à la publication. */
  at: string
  /** Utilisateur à l'origine de l'action quand il est connu. */
  actorId?: string
  payload: T
}
