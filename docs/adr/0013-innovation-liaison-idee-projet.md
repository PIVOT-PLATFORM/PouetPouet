# ADR-0013 — Innovation : liaison idée → projet (Roadmap/Portefeuille) via le bus d'événements

> Statut : `Proposé` · Date : 2026-07-04 · Remplace : — · Remplacé par : —

## Contexte

Une fiche innovation qui passe au statut `ADOPTEE` représente une idée validée pour
passage à l'exécution. Aujourd'hui, `ADOPTEE` n'est qu'une étiquette de statut : rien
ne relie la fiche à un item concret du Roadmap ou du Portefeuille — la vision Pivot
d'un **graphe de données partagé où les modules sont des vues** (cf.
[ADR-0004](./0004-bus-evenements-registre-modules.md)) n'est pas exploitée ici. Le
manifeste du module déclare d'ailleurs explicitement `emits: []` / `listensTo: []`
(`packages/shared/src/forge/modules.ts`) : zéro intégration inter-module.

Ce sujet a été identifié pendant le lot d'amélioration pré-release (benchmark
marché : IdeaScale et Yumana tracent le passage idée→projet avec ROI). Décision de
Julien : **documenter l'approche maintenant** (pendant que le contexte Innovation est
frais) **sans l'implémenter dans ce lot** — l'implémentation attend que le sujet du
bus d'événements inter-modules soit traité plus largement, pas seulement pour ce cas.

## Options envisagées

- **Auto-création d'un `RoadmapItem`** dès le passage à `ADOPTEE` — rejeté : suppose
  de choisir un Roadmap cible sans intervention humaine (un utilisateur peut avoir
  plusieurs Roadmaps actifs, aucun n'est "le bon" par défaut) ; créerait des items
  fantômes si la transition de statut est un test ou se fait par erreur.
- **FK stricte + jointure Prisma directe** (`InnovationFiche.roadmapItemId` avec
  relation vers `RoadmapItem`) — rejeté : viole la règle d'isolation des modules de
  l'ADR-0004 (un module n'importe que son propre dossier + le socle + `shared`) ;
  Innovation devrait connaître le schéma de Roadmap.
- **Bus d'événements existant + référence opaque** — retenu : réutilise
  `apps/api/src/lib/bus.ts` déjà en place (même pattern que *Scrum → Capacité*,
  `apps/api/src/index.ts:189-225`), sans coupler les modules entre eux.

## Décision

1. **Émission d'un événement** `innovation.fiche.adopted` quand une fiche passe (ou
   repasse) au statut `ADOPTEE` — payload `{ ficheId, title, authorId, orgUnitRef }`.
   Manifeste Innovation à mettre à jour : `emits: ['innovation.fiche.adopted']`.
2. **Pas d'auto-création cross-module.** L'abonnement (dans `index.ts`, comme les
   liaisons existantes) se contente de **notifier** l'auteur et les contributeurs
   via le système de notification déjà en place (`notify()`), avec un lien
   invitant à créer/lier manuellement un item Roadmap — l'humain décide où et
   quand, cohérent avec le seul autre précédent cross-module existant
   (*Scrum → Capacity* ne fait que remplir un champ sur un sprint **déjà créé**
   par un humain, jamais une création d'entité à sa place).
3. **Référence opaque, pas de FK.** `InnovationFiche` gagne un champ optionnel
   `linkedRoadmapItemId: string | null`, rempli par une action explicite côté
   utilisateur (« Lier à un item Roadmap ») — même philosophie que `orgUnitRef`
   (`"ldap:<id>" | "int:<id>"`, ADR-0012) : une référence texte non contrainte par
   une FK Prisma, résolue à l'affichage par un appel ciblé si besoin, jamais par
   une jointure directe qui casserait l'isolation des modules.

## Conséquences

- Reste cohérent avec l'ADR-0004 : aucune nouvelle règle d'architecture, juste une
  nouvelle paire émetteur/abonné sur un bus déjà en place.
- L'implémentation est **différée** : pas de PR dans le lot pré-release. Elle
  redevient pertinente dès qu'un second cas d'usage de liaison cross-module
  apparaît (justifiant de mutualiser le pattern plutôt que de le construire pour
  Innovation seul).
- Risque accepté : sans FK, rien n'empêche `linkedRoadmapItemId` de pointer vers un
  item Roadmap supprimé depuis — comportement déjà accepté ailleurs pour
  `orgUnitRef` (référence potentiellement obsolète, résolue au mieux à l'affichage).
- Si un futur besoin réel exige une intégrité forte (ex. reporting consolidé
  idée→ROI), cette ADR sera remplacée plutôt que réécrite (cf. processus au
  [README](./README.md)).
