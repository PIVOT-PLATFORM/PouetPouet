# ADR-0008 — Versioning 0.x.y sans saut de majeur

> Statut : `Accepté` · Date : 2026-06-17 · Remplace : — · Remplacé par : —

> ADR rétroactive : fige une décision déjà en vigueur dans le repo.

## Contexte

Le produit n'a pas encore atteint sa v1 exploitable (milestone *1.0.0 -
Exploitable*). Il faut un schéma de version qui reflète honnêtement ce statut
pré-1.0, qui pilote les tags git de release et les release notes, et qui reste
lisible dans le temps (la numérotation a déjà connu un rééquilibrage rétroactif).

## Options envisagées

- **SemVer strict dès maintenant** (bumper le majeur à chaque breaking change) —
  ferait grimper la version (2.x, 3.x…) avant même la première vraie v1, ce qui
  envoie un faux signal de maturité.
- **CalVer** (versions datées) — lisible, mais ne porte pas la notion de palier
  produit (« v1 exploitable »).
- **0.x.y, jamais de saut de majeur avant la v1** — toute la pré-v1 reste en `0.`,
  le passage à `1.0.0` marque le palier « exploitable ».

## Décision

Schéma **`0.x.y`**, **jamais de saut de majeur** tant que la v1 n'est pas atteinte.
Le bump de version touche trois `package.json` (racine + `apps/api` + `apps/web`)
et s'accompagne d'une entrée en tête de `patch-notes.ts` (checklist release,
`CLAUDE.md`). Le tag git `v<version>` est posé automatiquement au push `master`
(`release.yml`, idempotent), et les release notes sont extraites de
`patch-notes.ts`.

## Conséquences

- La version communique l'état réel : pré-1.0 ⇒ `0.`, `1.0.0` réservé au palier
  exploitable.
- Tags et release notes dérivent d'une source unique (`patch-notes.ts`) →
  cohérence version ⇄ notes ⇄ tag.
- Prix à payer : la sémantique « breaking change » de SemVer n'est pas portée par
  le numéro en pré-1.0 ; la lisibilité repose sur la discipline de `patch-notes.ts`.
- Un rééquilibrage rétroactif des numéros a déjà eu lieu (alignement
  tags ⇄ patch-notes) — les tags historiques ont été reconstruits a posteriori
  pour rétablir la cohérence.
