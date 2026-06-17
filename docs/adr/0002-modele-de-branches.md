# ADR-0002 — Modèle de branches feature → develop → master

> Statut : `Accepté` · Date : 2026-06-17 · Remplace : — · Remplacé par : —

> ADR rétroactive : fige une décision déjà en vigueur dans le repo.

## Contexte

Un push sur `master` déclenche le déploiement automatique sur GCP Cloud Run
(`deploy.yml`). Il faut donc un tampon entre le travail en cours et la prod : un
endroit où intégrer et valider sans déployer, et un contrôle explicite du moment
où la prod bouge.

## Options envisagées

- **Trunk-based (tout sur `master`)** — simple, mais chaque merge déploie : aucune
  marge pour intégrer plusieurs chantiers avant une mise en prod maîtrisée.
- **GitHub Flow (feature → master)** — pas de branche d'intégration ; même
  problème de couplage merge ⇄ déploiement.
- **feature/fix → `develop` → `master`** — `develop` intègre en continu sans CI de
  déploiement ; `master` ne reçoit que des merges `develop → master` décidés
  explicitement.

## Décision

**feature/fix → `develop` → `master`**, avec `master` déployée automatiquement.

- `develop` : intégration continue, pas de déploiement.
- `master` : déploiement auto GCP sur push.
- On merge **toujours** `develop → master`, jamais une branche feature
  directement dans `master`.
- Le passage en `master` se fait **sur demande explicite** de l'humain.
- Un chantier = une branche = une PR vers `develop` (l'auteur ne merge pas
  lui-même : la review et le merge restent à la main de Julien).

## Conséquences

- Le déploiement prod est un acte délibéré, pas un effet de bord d'un merge.
- `develop` reste l'état « prochaine release candidate » testable en continu.
- Prix à payer : une étape de merge supplémentaire et le risque de divergence
  `develop`/`master` si la promotion tarde — atténué par des promotions fréquentes
  et la checklist de release (`CLAUDE.md`).
- Réglages de protection de branche cible documentés dans
  [`.github/admin-settings.md`](../../.github/admin-settings.md) (application
  GitHub admin restante).
