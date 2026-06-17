# ADR-0009 — Migration vers Prisma 7 (driver adapter + prisma.config.ts)

> Statut : `Accepté` · Date : 2026-06-17 · Remplace : ADR-0007 · Remplacé par : —

## Contexte

ADR-0007 avait gelé Prisma à `6.19.0` exact après l'incident #87 : le patch
`6.19.3` embarquait un moteur v7 « flottant » qui rejetait `url = env(...)` dans
le datasource et cassait le build Docker (P1012). La dette tracée était de migrer
proprement vers Prisma 7.

Prisma 7 (stable `7.8.0`) acte plusieurs changements :

- l'`url` (et `directUrl`, `shadowDatabaseUrl`) **n'est plus accepté** dans
  `schema.prisma` (erreur P1012) ;
- la connexion des commandes CLI (`migrate`, `db push`…) est lue depuis un
  fichier **`prisma.config.ts`** (clé `datasource.url`) ;
- le client runtime ne reçoit plus de `datasourceUrl` mais un **driver adapter**
  (ici `@prisma/adapter-pg`, qui s'appuie sur `pg`) ;
- `.env` n'est plus chargé automatiquement par le CLI.

Le générateur `prisma-client-js` (sortie par défaut `node_modules/@prisma/client`)
**reste supporté** en 7.x : les imports `import { PrismaClient } from '@prisma/client'`
sont inchangés. Le rayon d'impact côté code est donc minimal.

## Options envisagées

- **Rester gelé sur `6.19.0`** — dette permanente, vulnérabilité `effect`
  transitive non corrigeable, plus on s'éloigne plus la migration coûte cher.
- **Migrer vers le nouveau générateur `prisma-client`** (output dédié, imports
  réécrits) — possible mais inutile maintenant : `prisma-client-js` fonctionne en
  7.x. Reporté.
- **Migrer vers Prisma 7 avec `prisma.config.ts` + driver adapter `pg`**, en
  gardant le générateur historique. *(retenu)*

## Décision

Migration vers **Prisma `7.8.0`** :

- `schema.prisma` : suppression de `url` du bloc `datasource`.
- `apps/api/prisma.config.ts` : nouveau fichier qui fournit `datasource.url =
  env("DATABASE_URL")` au CLI et charge `.env` via l'API native
  `process.loadEnvFile()` (pas de dépendance `dotenv` — qui ne se résolvait pas
  dans le loader de config du conteneur). `loadEnvFile` n'écrase pas une variable
  déjà présente (compatible avec le `DATABASE_URL` injecté par les tests).
- `src/lib/prisma.ts` : le client runtime utilise `new PrismaClient({ adapter })`
  avec `PrismaPg` (`@prisma/adapter-pg` + `pg`). Le bornage du pool
  (`connection_limit` → `max`, `pool_timeout` → `connectionTimeoutMillis`) est
  conservé via les options du Pool `pg`.
- `Dockerfile` : copie de `prisma.config.ts` dans l'image runner ; le `CMD`
  exécute `prisma migrate deploy --config=/app/apps/api/prisma.config.ts` (le CMD
  tourne depuis `/app`, le `--config` rend la résolution explicite).
- Épinglage **exact** maintenu sur le trio `prisma` / `@prisma/client` /
  `@prisma/adapter-pg` (mêmes versions obligatoires = lock du moteur), et
  dependabot continue d'ignorer ces paquets : les montées de version se font
  manuellement et de façon coordonnée.

## Conséquences

- Build Docker et déploiement de nouveau compatibles avec le moteur v7 ; la dette
  #87 est soldée.
- Vérifié de bout en bout en local : `prisma generate` (build), `migrate deploy`
  (runtime conteneur, connexion DB OK), client runtime via adapter, 36 tests
  d'intégration verts, typecheck API OK.
- Le passage au nouveau générateur `prisma-client` (output dédié) reste une
  évolution possible mais non nécessaire — à ouvrir en ADR dédiée le jour venu.
- Signal de réouverture : si un build casse sur `prisma generate` / `datasource`,
  vérifier la cohérence de version du trio Prisma dans le lockfile.
