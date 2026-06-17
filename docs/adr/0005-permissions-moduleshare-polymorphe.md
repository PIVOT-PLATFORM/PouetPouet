# ADR-0005 — Permissions par module via `ModuleShare` polymorphe

> Statut : `Accepté` · Date : 2026-06-17 · Remplace : — · Remplacé par : —

> Décision actée et livrée pour Scrum & Daily (#78, v0.16.0). Roue / Capacité / MeetOps suivront via le même patron.
> Issues #36/#37, milestone *1.0.0 - Exploitable*.

## Contexte

Seuls les **boards** PouetPouet disposent d'un RBAC (table `BoardShare`, rôles
Propriétaire/Co-propriétaire/Éditeur/Lecteur, UI et enforcement socket). Les autres
modules (Scrum, Daily, Roue, Capacité, MeetOps) sont **owner-only** : chaque route
filtre `where: { ownerId }`. Il faut un mécanisme de partage réutilisable pour les
modules collaboratifs, sans dupliquer la logique de `BoardShare` par module.

## Options envisagées

- **Une table de partage par module** (`ScrumShare`, `DailyShare`, …) — FK propre
  vers chaque ressource, mais duplication N fois de la même logique de rôles et de
  garde ; chaque nouveau module repaie le coût.
- **Étendre `BoardShare`** à tous les modules — couplerait les boards (déjà
  stables) à un refactor risqué.
- **Table `ModuleShare` polymorphe** — une table générique
  `(module, resourceId, userId, role)` + une lib de résolution de rôle réutilisable.

## Décision

Table **`ModuleShare` générique et polymorphe** + lib `lib/module-share.ts`
(`resolveRole`, `canManage`, `sharedResourceIds`, `deleteResourceShares`) + routeur
`/api/shares` commun. Appliquée de bout en bout à **Scrum** et **Daily** d'abord ;
Roue/Capacité/MeetOps suivront via le même patron. **Les boards ne sont pas
touchés** (gardent `BoardShare`).

- Invitation par **email** (pas de share-link en v1).
- Enforcement socket : un cache de rôle par ressource ; `host_join` autorisé en
  lecture (VIEWER+), **mutations** gardées par `canManage` (OWNER/EDITOR).
- Polymorphe = **pas de FK** vers la ressource → la cascade à la suppression d'une
  ressource est gérée dans le code (`deleteResourceShares`).

## Conséquences

- Un seul mécanisme de permissions pour tous les modules futurs (et plugins) :
  ajouter le partage à un module = ajouter un resolver, pas une table.
- Coût assumé du polymorphisme : pas d'intégrité référentielle SQL sur
  `resourceId` ; discipline de nettoyage applicatif obligatoire à chaque
  suppression de ressource.
- Coexistence de **deux** systèmes (`BoardShare` historique + `ModuleShare`
  générique) ; convergence des boards vers `ModuleShare` possible plus tard, non
  planifiée.
- S'appuie sur l'enforcement socket auto-vérifié de
  [ADR-0003](./0003-auth-socket-optionnelle.md).
