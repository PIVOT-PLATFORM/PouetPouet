# ADR-0012 — Innovation : référentiel organisationnel hybride (LDAP externe + interne)

> Statut : `Accepté` · Date : 2026-07-03 · Remplace : — · Remplacé par : —

## Contexte

Le module Innovation (épique #222) doit permettre de rattacher une fiche innovation
ou un challenge à un périmètre organisationnel (direction, division, département,
équipe), pour filtrer et restreindre l'éligibilité. Le module Commande publique
dispose déjà d'un référentiel organisationnel externe (LDAP, cf.
[ADR-0011](./0011-commande-publique-pods-externes.md)) : réutiliser ce référentiel
évite un doublon et respecte la vision Pivot d'un graphe de données partagé.

Mais toutes les entreprises cibles n'ont pas de LDAP en place au moment d'adopter le
module Innovation, ou souhaitent des groupes ad hoc (comités d'innovation transverses,
groupes de travail) qui n'existent pas dans l'annuaire RH. Décision explicite de
Julien (2026-07-03) : garder le LDAP **et** permettre une hiérarchie interne saisie
dans l'app — les deux doivent cohabiter, pas l'un ou l'autre.

## Options envisagées

- **LDAP uniquement** (comme Commande publique) — cohérent avec la vision « les
  données viennent toujours d'ailleurs », mais bloque les entreprises sans LDAP ou
  les groupements ad hoc.
- **Hiérarchie interne uniquement** — plus simple à implémenter, mais duplique un
  référentiel déjà résolu pour Commande publique et perd la synchronisation avec la
  structure RH réelle.
- **Hybride : LDAP + hiérarchie interne, unifiés par un identifiant préfixé**
  *(retenu)* — chaque unité organisationnelle est référencée par une chaîne
  `ldap:<id>` ou `int:<id>` ; les deux arbres restent distincts en base (aucune
  fusion de schéma), mais sont combinés à la lecture par un résolveur commun.

## Décision

- Le référentiel LDAP externe n'est **jamais dupliqué en base** — comme pour
  Commande publique, on continue d'interroger `ldapClient` (cache Redis/mémoire,
  `ExternalUnavailableError` en cas d'indisponibilité).
- Un nouveau modèle `InnovationOrgUnit` (PR3, #225) porte la hiérarchie **interne**,
  administrée dans l'app (nom, niveau, `parentId`).
- Toute référence organisationnelle dans le module Innovation (`orgUnitRef` sur
  `InnovationFiche`/`InnovationChallenge`) est une chaîne opaque préfixée :
  `ldap:<id>` pour une unité LDAP, `int:<id>` pour une unité interne. Un ref ne peut
  être l'ancêtre/descendant que d'un ref du même préfixe (les deux arbres ne se
  croisent jamais).
- Un helper `resolveOrgUnits()` (PR3) fusionne les deux référentiels en une forme
  commune `{ ref, nom, niveau, parentRef, source }` pour l'affichage (sélecteur
  arborescent avec badge d'origine) et les calculs d'éligibilité (sous-arbre).
- **Si le LDAP est indisponible**, les unités internes restent servies (le module
  Innovation ne doit pas devenir inutilisable faute de LDAP) : `resolveOrgUnits()`
  intercepte `ExternalUnavailableError` localement, journalise un avertissement, et
  renvoie un indicateur `ldapDegraded: true` plutôt que de propager un 503 global —
  une exception assumée à la convention Commande publique (où l'indisponibilité LDAP
  bloque tout, cf. `ExternalUnavailableError` → 503 dans `apps/api/src/index.ts`),
  justifiée ici par la cohabitation avec un référentiel interne toujours disponible.

## Conséquences

- Les ids d'unités organisationnelles Innovation ne sont **pas** des clés Prisma
  directes (impossible d'avoir une FK vers un identifiant LDAP externe) — toute
  validation d'un `orgUnitRef` se fait par résolution applicative, pas par contrainte
  de base.
- Un futur module qui voudrait, lui aussi, un référentiel organisationnel devra
  choisir entre le pattern Commande publique (LDAP strict, bloquant) et ce pattern
  hybride (LDAP + interne, dégradable) selon son besoin de résilience.
