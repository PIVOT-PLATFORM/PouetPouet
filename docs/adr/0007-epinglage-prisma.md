# ADR-0007 — Épinglage exact de Prisma à 6.19.0

> Statut : `Accepté` · Date : 2026-06-17 · Remplace : — · Remplacé par : —

> Post-mortem : issue #87 (hotfix après v0.15.1, le 2026-06-16).

## Contexte

`prisma` **6.19.3** est une version de transition dont `@prisma/engines` dépend
d'un **moteur v7** (`engines-version 7.1.1-3`). Ce moteur *flotte* au fetch :

- en local → 7.1.1, qui **exige** `url` dans le datasource ;
- au build Docker Cloud Run → 7.8.0, qui **interdit** `url` (« no longer supported
  in schema files »).

Résultat : `prisma generate` plantait au build avec `P1012`, **bloquant le
déploiement**. Le schéma utilise le classique `url = env("DATABASE_URL")`, accepté
par le moteur `6.19.0-26`. À noter : `6.19.0 → 6.19.3` est un bump **patch** en
semver — une règle Dependabot qui n'ignore que les majors **ne suffit pas**
(Dependabot a rouvert 6.19.3 dans #88/#89, CI rouge).

## Options envisagées

- **Migrer vers Prisma v7 tout de suite** (retrait du `url`, `prisma.config.ts`) —
  la bonne cible à terme, mais c'est un chantier, pas un hotfix de prod cassée.
- **Caret `^6.19.0`** — laisse remonter 6.19.3+ ⇒ rejoue le bug.
- **Épingler exactement `6.19.0`** + bloquer Dependabot sur prisma (tous types de
  bump) jusqu'à la vraie migration v7.

## Décision

**Épinglage exact `6.19.0`** (sans caret) pour `prisma` et `@prisma/client`,
déclarés à la **racine** `package.json` (devDep + dep) pour forcer le hoisting npm
11 dans `node_modules/` racine — layout attendu par `apps/api/Dockerfile`.

`.github/dependabot.yml` **ignore tout bump** de `prisma` / `@prisma/client`
(major, minor **et** patch), pas seulement les majors.

## Conséquences

- Build Docker et déploiement de nouveau verts ; schéma inchangé.
- Prisma est **gelé** à 6.19.0 jusqu'à une migration v7 explicite (retrait du `url`
  + `prisma.config.ts`) — dette assumée et tracée (#87).
- Signal de réouverture : si un build casse sur `prisma generate` / `datasource
  url`, vérifier que le lockfile n'a pas remonté prisma ≥ 6.19.3.
- Cas particulier d'un principe plus large acté ensuite : **les majors npm ne
  passent pas par Dependabot auto** (cf. PR #96 — décision opérationnelle, pas
  d'ADR dédiée).
- Distinct du gotcha Windows `prisma generate` EPERM (DLL verrouillée par `tsx`),
  qui est un problème d'environnement local, pas de versioning.
