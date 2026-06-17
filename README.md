# PIVOT / PouetPouet

Suite collaborative temps réel pour animer des ateliers, organiser les rituels d'équipe et centraliser les outils de facilitation dans un hub unique.

Le projet est actuellement en version **0.15.0**. Le produit historique **PouetPouet** devient le premier module d'un socle plus large nommé **PIVOT**.

## Modules disponibles

- **PouetPouet** : tableau blanc collaboratif temps réel avec cartes, cadres, groupes, connexions, votes, templates, import/export et partage par rôles.
- **Daily** : stand-up minuté avec tour de parole équitable, participants et sessions d'équipe.
- **Scrum Poker** : estimation d'équipe en temps réel avec tickets, votes et salles partageables.
- **La Roue** : tirage au sort animé, lié aux équipes.
- **Capacité** : planification de capacité d'équipe pour sprint, PI ou release.

Le hub agrège les modules, les favoris, les statistiques et l'activité récente.

## Stack technique

- **Monorepo** : npm workspaces + Turbo
- **Frontend** : Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend** : Fastify 5, Socket.io, TypeScript
- **Base de données** : PostgreSQL 16, Prisma
- **Cache / temps réel multi-instance** : Redis, adaptateur Socket.io Redis
- **Authentification** : JWT, cookies, clés API, OIDC optionnel
- **Observabilité** : healthcheck, métriques Prometheus, Sentry optionnel, audit log
- **Tests** : Vitest, tests d'intégration PostgreSQL, Playwright E2E, axe-core
- **Déploiement** : Docker, GitHub Actions, Google Cloud Run

## Structure du dépôt

```txt
.
├── apps/
│   ├── api/          # API Fastify, Prisma, sockets, modules serveur
│   └── web/          # Application Next.js
├── packages/
│   └── shared/       # Types et manifests de modules partagés
├── keycloak/         # Realm local pour tester le SSO OIDC
├── docker-compose.yml
├── turbo.json
└── package.json
```

## Prérequis

- Node.js **20+**
- npm **11+**
- Docker et Docker Compose

## Installation locale

Installer les dépendances :

```bash
npm ci
```

Démarrer PostgreSQL et Redis :

```bash
docker compose up -d postgres redis
```

Créer le fichier d'environnement de l'API :

```bash
cp .env.example apps/api/.env
```

Générer le client Prisma puis appliquer les migrations :

```bash
npm --workspace apps/api run db:generate
npm --workspace apps/api run db:migrate
```

Démarrer l'application en développement :

```bash
npm run dev
```

Services locaux :

- Web : http://localhost:3000
- API : http://localhost:4000
- Healthcheck : http://localhost:4000/health
- Documentation OpenAPI, hors production : http://localhost:4000/documentation

## Variables d'environnement

Les valeurs minimales de développement sont dans `.env.example`.

Variables principales côté API :

```env
DATABASE_URL="postgresql://pouetpouet:pouetpouet_dev@localhost:5432/pouetpouet"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=change-me-in-production
FRONTEND_URL=http://localhost:3000
PORT=4000
```

Variables publiques côté web :

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

En local, le frontend retombe déjà sur `http://localhost:4000` si ces variables ne sont pas définies.

## SSO OIDC local

Un Keycloak local peut être lancé en profil optionnel :

```bash
docker compose --profile sso up -d keycloak
```

Le realm est importé depuis `keycloak/`.

- URL Keycloak : http://localhost:8081
- Admin : `admin` / `admin`
- Utilisateur de test : `sso-user` / `sso-password`

Configurer ensuite les variables `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` et `OIDC_REDIRECT_URI` dans `apps/api/.env`.

## Scripts utiles

Depuis la racine :

```bash
npm run dev       # démarre les apps en mode développement via Turbo
npm run build     # build web + api
npm run lint      # typecheck API et lint web
npm run test      # tests unitaires Vitest
npm run format    # formatage Prettier
```

API :

```bash
npm --workspace apps/api run db:generate
npm --workspace apps/api run db:migrate
npm --workspace apps/api run db:studio
npm --workspace apps/api run test:integration
```

Web :

```bash
npm --workspace apps/web run test:e2e
```

## Tests

Tests unitaires :

```bash
npm run test
```

Tests d'intégration API avec une vraie base PostgreSQL :

```bash
docker compose up -d postgres redis
cp .env.example apps/api/.env
npm --workspace apps/api run test:integration
```

La configuration crée et migre une base de test `pouetpouet_test`.

Tests E2E Playwright :

```bash
docker compose up -d postgres redis
npm --workspace apps/web run test:e2e
```

Playwright démarre automatiquement l'API sur `4000` et le web sur `3000` si les serveurs ne tournent pas déjà.

## Architecture applicative

Le socle PIVOT repose sur un registre de modules partagé :

- les manifests sont déclarés dans `packages/shared/src/forge/modules.ts` ;
- les routes et sockets serveur sont montés depuis `apps/api/src/modules/registry.ts` ;
- chaque module possède ses routes, ses handlers temps réel et ses entités Prisma ;
- les modules communiquent via un bus d'événements typés.

Exemples d'événements :

- `pouetpouet.board.imported`
- `daily.session.ended`
- `scrum.ticket.estimated`
- `wheel.draw.completed`

Le backend expose aussi des services transverses : authentification, sessions live, notifications, équipes, webhooks, clés API, audit log, métriques et healthcheck.

## Sécurité et exploitation

- JWT court avec expiration à 30 minutes
- Authentification par cookie, bearer token ou header `X-API-Key`
- OIDC optionnel avec PKCE S256
- Rôles sur les boards : propriétaire, co-propriétaire, éditeur, lecteur
- Export et suppression de compte
- Rétention automatique des données inactives
- En-têtes de sécurité côté Next.js
- Logs Fastify avec redaction des secrets
- Sentry optionnel côté API et web
- Endpoint `/metrics` compatible Prometheus, protégeable par `METRICS_TOKEN`

## Déploiement

Le dépôt contient deux images Docker :

- `apps/api/Dockerfile`
- `apps/web/Dockerfile`

Le workflow `.github/workflows/deploy.yml` déploie sur Google Cloud Run à chaque push sur `master` :

- build et push de l'image API ;
- migration Prisma au démarrage de l'API ;
- déploiement Cloud Run de l'API ;
- build du frontend avec l'URL d'API produite ;
- déploiement Cloud Run du web.

La CI exécute actuellement :

- installation npm ;
- génération Prisma ;
- lint / typecheck ;
- tests Vitest ;
- tests d'intégration API avec PostgreSQL.

## Documentation

| Sujet | Emplacement |
|-------|-------------|
| Contribuer (workflow, conventions, setup) | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Code de conduite | [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) |
| Sécurité & divulgation de vulnérabilités | [`SECURITY.md`](SECURITY.md) |
| Licence | [`LICENSE`](LICENSE) (AGPL-3.0) |
| Journal des versions | [`CHANGELOG.md`](CHANGELOG.md) |
| Décisions structurantes (ADR) | [`docs/adr/`](docs/adr/) |
| Architecture des plugins | [`docs/specs/plugins-architecture.md`](docs/specs/plugins-architecture.md) |
| Réponse à incident & post-mortem | [`docs/ops/incident-response.md`](docs/ops/incident-response.md) |
| Backups, restauration & rollback | [`docs/ops/backup-restore-rollback.md`](docs/ops/backup-restore-rollback.md) |
| Observabilité, SLO & alertes | [`docs/ops/observability-slo-alerting.md`](docs/ops/observability-slo-alerting.md) |
| Activation infra (go-live) | [`docs/ops/go-live-checklist.md`](docs/ops/go-live-checklist.md) |
| Réglages admin GitHub attendus | [`.github/admin-settings.md`](.github/admin-settings.md) |
| Roadmap | [`ROADMAP.md`](ROADMAP.md) |

## Roadmap courte

Les prochains chantiers identifiés sont suivis dans `ROADMAP.md`, notamment :

- ajout des E2E Playwright et audits accessibilité dans la CI ;
- durcissement sécurité et scans de dépendances/secrets/images ;
- stratégie de rollback et smoke tests post-déploiement ;
- formalisation de l'architecture plugins ;
- documentation d'exploitation et ADR.
