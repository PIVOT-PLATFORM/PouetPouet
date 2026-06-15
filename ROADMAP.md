# Roadmap Pivot — état au 2026-06-16

> Version courante : **0.15.1**
>
> Source unique de suivi : ce fichier centralise la roadmap et les chantiers ouverts.

---

## P0 - Socle CI/CD et qualité

### CI
- [x] Tests unitaires Vitest dans la CI
- [x] Tests d'intégration API avec vraie DB PostgreSQL dans la CI
- [x] Ajouter les tests E2E Playwright dans la CI *(job `e2e`, serveurs prod + Postgres/Redis)*
- [x] Ajouter l'audit accessibilité Playwright + axe-core dans la CI *(`a11y.spec.ts` tourne dans le job `e2e`)*
- [ ] Ajouter des tests de performance
  - [ ] Lighthouse sur la landing page
  - [ ] Définir les budgets de performance par page critique
- [x] Ajouter SonarQube / SonarCloud public *(workflow + configuration de base)*
  - [ ] Quality gate tests unitaires : objectif 90%
  - [ ] Quality gate tests d'intégration : objectif 90%
  - [ ] Quality gate E2E Playwright : objectif 95%
- [x] Ajouter Dependabot
  - [x] Mises à jour npm
  - [x] Mises à jour GitHub Actions
  - [x] Règles d'auto-merge pour les patchs non critiques *(`dependabot-auto-merge.yml` : semver-patch ; requiert `Allow auto-merge` côté GitHub)*

### Release
- [x] Versioning sémantique 0.x.y en place
- [x] Images Docker taguées `:sha` et `:latest`
- [x] Tag Docker `:version` (ex: `:0.15.0`) — lu depuis `package.json` racine, api + web (`deploy.yml`)
- [x] Automatiser les tags git de release *(`release.yml` : tag `v<version>` au push master, idempotent)*
- [x] Générer automatiquement les release notes *(extraites de `patch-notes.ts` → GitHub Release)*

### Déploiement
- [x] Healthcheck API `/health` (DB + Redis + version)
- [x] Vérification migrations Prisma au démarrage container
- [ ] Environnement éphémère pour chaque PR validée
- [x] Stratégie de rollback documentée *(runbook `docs/ops/backup-restore-rollback.md`)*
- [x] Smoke test web post-déploiement
- [x] Validation post-déploiement automatisée en fin de deploy.yml

### Protection des branches *(réglages documentés, application GitHub admin restante)*
- [x] Documenter les réglages admin attendus (`.github/admin-settings.md`)
- [x] Définir les checks obligatoires cible : `Typecheck & Lint`, `Integration tests (PostgreSQL)`
- [ ] Bloquer les push directs sur `master` *(à appliquer dans GitHub settings)*
- [ ] Autoriser les merges uniquement via PR validée *(à appliquer dans GitHub settings)*
- [ ] Rendre obligatoires les checks CI avant merge *(à appliquer dans GitHub settings)*
- [ ] Exiger au moins une review sur `master` *(à appliquer dans GitHub settings)*
- [ ] Activer la suppression automatique des branches après merge *(à appliquer dans GitHub settings)*
- [ ] Vérifier l'activation effective de CODEOWNERS dans la protection de branche

---

## P0 - Sécurité

- [x] En-têtes sécurité web (CSP strict + X-Frame-Options dans next.config.ts)
- [x] Export données RGPD (`GET /api/auth/export`)
- [x] Suppression de compte (`POST /api/auth/delete-account`)
- [x] Rétention des données (cleanup automatique via retention.ts)
- [x] Mentions légales, confidentialité, CGU
- [ ] Formaliser le chantier sécurité avec Valentine
- [ ] Auditer les secrets GitHub Actions et GCP
- [x] Scan de dépendances vulnérables (npm audit / Snyk) *(npm audit critique en CI, seuil high à traiter après xlsx)*
- [x] Scan de secrets dans le code (gitleaks dans `security.yml`, config `.gitleaks.toml`)
- [x] Scan d'images Docker
- [ ] Politique de rotation des secrets
- [x] Durcir les permissions GitHub Actions

---

## P1 - Gouvernance GitHub

- [x] Template de pull request
- [x] Templates d'issues (Bug / Feature / Tâche technique)
- [x] CODEOWNERS
- [x] Workflow de triage automatique (`needs triage` à l'ouverture/réouverture)
- [x] Documentation des réglages admin GitHub (`.github/admin-settings.md`)
- [x] Roadmap projet via GitHub Issues *(35 issues réparties sur 2 milestones)*
- [x] Labels standards complets (`bug`, `feature`, `tech`, `security`, `ux`, `good first issue`, `needs triage`) *(tous présents dans GitHub, + `priority:P0/P1/P2`)*
  - [x] Labels consommés par les templates/workflow : `bug`, `feature`, `tech`, `needs triage`
  - [x] Créer/normaliser dans GitHub : `security`, `ux`, `good first issue`
- [x] Milestones GitHub *(`0.10.1 - Hardening`, `1.0.0 - Exploitable`)*

---

## P1 - Produit et roadmap

### Hub / Pivot
- [x] Application en mode Hub
- [x] Rebrand FORGE → **PIVOT** côté produit visible
- [x] Parcours principaux du Hub (récents + modules + à venir)
- [x] Navigation shell depuis les manifests modules
- [x] Renommer les identifiants internes `ForgeEvent` / `FORGE_MODULES` / métriques `forge_*` → `pivot` *(optionnel, non visible utilisateur)*

### Plugins
- [ ] Architecture plugins
- [ ] Fiabiliser PouetPouet avant ouverture aux plugins
- [ ] Définir une roadmap plugins
- [ ] Définir le cycle de vie d'un plugin (installation, activation, config, permissions, versioning)

### Feature flags
- [ ] Système de feature flags
- [ ] Flags par environnement
- [ ] Interface d'administration ou fichier de configuration

### Authentification et habilitations
- [x] OpenID Connect / OIDC (PKCE S256, Keycloak local opt-in)
- [x] Matrice d'habilitation Propriétaire / Éditeur / Lecteur + co-propriétaire
- [x] Rôles enforced sur les boards (reset, sessions, votes, export)
- [ ] SAML 2.0
- [ ] Permissions par module pour Daily, Scrum, Roue, Capacité
- [ ] Tests d'autorisation systématiques *(couverture partielle)*

---

## P1 - Observabilité et exploitation

- [x] Logs API centralisés (Fastify + pino)
- [x] Suivi erreurs frontend et backend (Sentry)
- [x] Métriques applicatives Prometheus (`/metrics`)
- [x] Audit log des actions sensibles (`/api/auth/security-log`)
- [x] Alertes (API indisponible, taux erreur, latence, échec déploiement) *(politiques documentées `docs/ops/observability-slo-alerting.md` ; échec déploiement automatisé dans `deploy.yml` ; création GCP/Sentry à appliquer)*
- [x] Runbooks d'exploitation documentés *(`docs/ops/` : backups/rollback + observabilité/alertes)*
- [x] Définir les SLO/SLA internes *(dispo 99,5 %, p95 < 500 ms, 5xx < 1 % — `docs/ops/observability-slo-alerting.md`)*

---

## P1 - Données et migrations

- [x] Migrations Prisma en production (`prisma migrate deploy` au démarrage)
- [x] DB de test représentative pour les tests d'intégration
- [x] Stratégie de backup PostgreSQL *(Cloud SQL auto + PITR — runbook `docs/ops/backup-restore-rollback.md`)*
- [ ] Tester la restauration des backups *(procédure + cadence trimestrielle documentées ; test réel à exécuter)*
- [x] Procédure de rollback migration documentée *(runbook `docs/ops/backup-restore-rollback.md`)*

---

## P1 - Stabilisation produit (bugs & import)

- [x] Bug viewport board corrigé — `overflow-hidden` (BFC) + double `requestAnimationFrame` dans `board-canvas.tsx`
- [x] Import Klaxoon fonctionnel — tuile active, assignation des groupes (`klx-import/converter.ts`)
- [x] Audit robustesse multi-utilisateur *(doc `docs/audits/multi-user-resilience.md` : déconnexion Scrum, late-joiner Daily, reconnexion session — déjà couverts ; correctif comptage participants session cross-instance)*
  - [ ] Reproduire/corriger les races au-delà de ~5 users simultanés *(→ load test, cf. P2)*

---

## P2 - Scalabilité & performance *(objectif : ~100 utilisateurs simultanés)*

### Socle temps réel *(code prêt — provisionnement prod à finaliser)*
- [x] Adapter Redis Socket.io branché (`@socket.io/redis-adapter`, `apps/api/src/index.ts`)
- [x] Registry participants Scrum en Redis hash + fallback mémoire (`scrum.sockets.ts`)
- [x] Présence boards en cache Redis — plus de loop O(n) (`board.sockets.ts`)
- [x] Curseurs coalescés côté serveur
- [x] Rate limiting (`@fastify/rate-limit`)
- [x] Comptage participants session cross-instance (`fetchSockets`, plus de lecture locale) — prérequis multi-instance
- [ ] Activer le multi-instance en prod *(`deploy.yml` prêt et paramétré — vars `MAX_INSTANCES`/`REDIS_HOST`/`VPC_CONNECTOR`, défauts mono-instance ; reste à provisionner Memorystore : guide `docs/ops/scaling-multi-instance.md`)*

### Performance & charge restantes
- [ ] Lazy-loading des éléments hors viewport (boards > 500 éléments)
- [x] Pool de connexions DB borné par instance (`connection_limit`/`pool_timeout` dans `prisma.ts`, défaut 10, `DB_CONNECTION_LIMIT`)
- [x] Load test k6 100 VUs *(script `load-test/board-load.js` + workflow `load-test.yml` ; seuils p95 < 500 ms / erreurs < 1 %)* — reste à exécuter contre un staging représentatif
- [ ] Jobs async (BullMQ sur Redis) : exports, emails, webhooks hors du request cycle

---

## P2 - UI/UX

- [x] Audit accessibilité WCAG AA sur les 10 pages principales (axe-core)
- [ ] Harmoniser les URLs anglais/français
- [ ] Définir une convention de nommage des routes
- [ ] Vérifier les redirections après renommage
- [ ] Tests de non-régression visuelle sur les écrans critiques
- [ ] Revoir les états vides, erreurs et chargements

---

## P2 - Documentation

- [x] Checklist release (CLAUDE.md)
- [x] Commandes de dev/test/build (CLAUDE.md)
- [x] Variables d'environnement (.env.example)
- [x] README projet à jour
- [x] Documenter l'installation locale (README.md)
- [x] Documenter les CI/CD en place
- [x] Documenter l'architecture applicative (README.md)
- [ ] Documenter les décisions structurantes via ADR
- [ ] Checklist d'incident

---

## Points clarifiés
- [x] Branche principale : `master`
- [x] Modules Hub : PouetPouet, Daily, Scrum Poker, La Roue, Capacité, **MeetOps** *(MeetOps livré — cf. docs/specs/meetops.md v0.4)*
- [x] Rôles : Propriétaire / Éditeur / Lecteur (+ co-propriétaire)
- [x] RGPD minimal : export + suppression + rétention + pages légales

## Points encore ouverts
- [ ] Appliquer réellement les réglages `.github/admin-settings.md` dans l'interface GitHub
- [ ] Créer/normaliser les labels manquants dans GitHub
- [ ] Environnement de référence avant prod : staging ou preview PR ?
- [ ] Niveau de conformité RGPD cible pour la v1 exploitable
- [ ] SMTP en prod : câblé dans `deploy.yml` (Gmail) — reste à garnir les secrets GCP Secret Manager (`SMTP_USER`, `SMTP_PASS`, `FRONTEND_URL`)
- [ ] Redis/Memorystore en prod (max-instances bloqué à 1 sans lui)
