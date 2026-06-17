# ADR-0004 — Bus d'événements + registre de modules

> Statut : `Accepté` · Date : 2026-06-17 · Remplace : — · Remplacé par : —

> ADR rétroactive : fige une décision déjà en vigueur dans le repo.

## Contexte

La vision Pivot est une **suite data-centric** : des modules (PouetPouet, Daily,
Scrum, Roue, Capacité, MeetOps) qui partagent un graphe de données et dont les
applications sont des vues. Ces modules doivent réagir aux événements des autres
(ex. *Scrum → Capacité* : une salle estimée remonte la vélocité au sprint) sans se
coupler directement. À terme, des plugins tiers doivent pouvoir s'enregistrer dans
le socle **sans le modifier**.

## Options envisagées

- **Appels directs entre modules** — un module importe et appelle un autre :
  couplage fort, dépendances croisées, impossible d'ouvrir aux plugins.
- **Tout passer par la base** (polling de tables) — découplé mais latent, coûteux,
  et ne porte pas l'intention (« cet événement s'est produit »).
- **Bus d'événements typé + registre de modules** — les modules émettent/écoutent
  des événements `<module>.<entité>.<action>` ; un registre monte routes et
  handlers socket en itérant une liste déclarative.

## Décision

Un **bus d'événements** (`apps/api/src/lib/bus.ts`) et un **registre de modules**
(`apps/api/src/modules/registry.ts`, `API_MODULES`).

- Chaque module vit dans `modules/<id>/` et déclare un `ModuleManifest`
  (`packages/shared/src/forge/manifest.ts` : `id`, `nav`, `apiPrefix`,
  `ownedEntities`, `referencedPivots`, `emits`, `listensTo`).
- **Règle d'isolation** : un module n'importe que depuis son propre dossier, le
  socle (`../../lib`) et `@pouetpouet/shared` — jamais le dossier d'un autre module.
- Les liaisons inter-modules passent par le bus (`bus.subscribe(...)` dans
  `index.ts`), pas par des appels directs.

## Conséquences

- Les modules sont des **proto-plugins** : la frontière étant déjà déclarative et
  isolée, ouvrir aux plugins revient à *durcir et versionner* ces contrats, pas à
  réécrire (cf. [`docs/specs/plugins-architecture.md`](../specs/plugins-architecture.md)).
- Découplage : ajouter une liaison (ex. notifier un webhook sur
  `daily.session.ended`) ne touche pas le module émetteur.
- Prix à payer : un flux indirect (bus) est moins évident à suivre qu'un appel
  direct ; d'où la trace `bus.subscribe('*', …)` qui logge tous les événements.
- La règle d'isolation n'est pour l'instant **pas** verrouillée par l'outillage
  (lint) — elle tient par convention ; un futur garde-fou serait utile avant les
  plugins tiers.
