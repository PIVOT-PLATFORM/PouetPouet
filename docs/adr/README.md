# Architecture Decision Records (ADR)

> Journal des **décisions structurantes** du projet Pivot / PouetPouet.
> Une ADR fige une décision : son contexte, les options pesées, le choix retenu
> et ses conséquences. Source de vérité roadmap : `ROADMAP.md`.

## Pourquoi des ADR

Beaucoup de choix structurants du repo (modèle de branches, auth socket
optionnelle, bus d'événements, épinglage Prisma…) ne vivaient jusqu'ici que dans
le code, `CLAUDE.md` ou les mémoires de session. Une ADR rend ces décisions
**explicites, datées et révisables** — utile à l'approche d'une v1 exploitable et
à l'ouverture future aux plugins.

Une ADR n'est **pas** de la documentation produit : elle capture *pourquoi* un
choix a été fait, pas *comment* l'utiliser (ça reste dans `docs/specs/` et
`docs/ops/`).

## Quand écrire une ADR

Écris-en une quand une décision :

- est **coûteuse à inverser** (schéma de données, modèle de déploiement, auth) ;
- impose une **contrainte transverse** (règle d'isolation des modules, pinning de
  dépendance critique) ;
- arbitre entre **plusieurs options crédibles** qu'un nouvel arrivant pourrait
  légitimement remettre en question.

Pas besoin d'ADR pour un choix local, réversible ou évident.

## Statuts

| Statut | Signification |
|--------|---------------|
| `Proposé` | Décision en discussion, pas encore actée |
| `Accepté` | Décision en vigueur |
| `En cours` | Décision actée, implémentation partielle (PR ouverte) |
| `Déprécié` | Plus recommandé, mais pas encore retiré |
| `Remplacé` | Annulé par une ADR ultérieure (lien dans l'en-tête) |

## Processus

1. Copier [`0000-template.md`](./0000-template.md) en `NNNN-titre-court.md`
   (numéro à 4 chiffres, incrémental).
2. Renseigner l'en-tête (numéro, statut, date) et les sections.
3. Une ADR acceptée n'est **pas réécrite** : pour changer d'avis, on crée une
   nouvelle ADR qui *remplace* l'ancienne (on passe l'ancienne en `Remplacé`
   avec un lien). L'historique des décisions est ainsi préservé.

## Index

| N° | Titre | Statut |
|----|-------|--------|
| [0001](./0001-monorepo-turborepo.md) | Monorepo Turborepo + npm workspaces | Accepté |
| [0002](./0002-modele-de-branches.md) | Modèle de branches feature → develop → master | Accepté |
| [0003](./0003-auth-socket-optionnelle.md) | Authentification Socket.io optionnelle | Accepté |
| [0004](./0004-bus-evenements-registre-modules.md) | Bus d'événements + registre de modules | Accepté |
| [0005](./0005-permissions-moduleshare-polymorphe.md) | Permissions par module via `ModuleShare` polymorphe | En cours |
| [0006](./0006-adapter-redis-socketio.md) | Adapter Redis Socket.io avec fallback mémoire | Accepté |
| [0007](./0007-epinglage-prisma.md) | Épinglage exact de Prisma à 6.19.0 | Remplacé par [0009](./0009-migration-prisma-7.md) |
| [0008](./0008-versioning-0x.md) | Versioning 0.x.y sans saut de majeur | Accepté |
| [0009](./0009-migration-prisma-7.md) | Migration vers Prisma 7 (driver adapter + `prisma.config.ts`) | Accepté |
