# ADR-0001 — Monorepo Turborepo + npm workspaces

> Statut : `Accepté` · Date : 2026-06-17 · Remplace : — · Remplacé par : —

> ADR rétroactive : fige une décision déjà en vigueur dans le repo.

## Contexte

Le produit comprend un frontend (Next.js), un backend (Fastify + Socket.io) et
des types partagés entre les deux (`packages/shared`). Ces trois briques évoluent
ensemble : un changement de contrat (type partagé, événement du bus) doit pouvoir
toucher web + api + shared dans un seul changement cohérent.

## Options envisagées

- **Dépôts séparés** (web / api / shared en packages publiés) — isolation forte,
  mais synchronisation pénible : un changement de type partagé impose un cycle
  publish/bump/install, et les PR transverses deviennent multi-repos.
- **Monorepo avec npm workspaces seul** — un seul `npm install`, types partagés
  consommés par chemin, mais pas d'orchestration ni de cache de tâches.
- **Monorepo Turborepo + npm workspaces** — workspaces pour le lien local des
  packages, Turbo pour l'orchestration (`dev`, `build`, `lint`) et le cache.

## Décision

Monorepo **Turborepo + npm workspaces**. `apps/web`, `apps/api` et
`packages/shared` cohabitent ; `@pouetpouet/shared` est consommé par chemin
workspace ; Turbo orchestre les tâches en parallèle (`npm run dev` lance api + web).

## Conséquences

- Une PR peut modifier contrat partagé + producteur + consommateur de façon
  atomique ; la CI valide l'ensemble en une fois.
- Un seul `npm ci` installe tout ; le hoisting npm 11 à la racine est exploité
  (cf. [ADR-0007](./0007-epinglage-prisma.md) pour Prisma).
- Prix à payer : le cache Turbo et le hoisting créent des subtilités de layout
  `node_modules` (le Dockerfile API en dépend) ; un build Docker doit refléter la
  structure de hoisting attendue.
