# Backlog Pivot — état au 2026-06-13

> Version courante : **0.10.0** — branche en cours : `feat/rebrand-pivot`

---

## P0 - Socle CI/CD et qualité

### CI
- [x] Tests unitaires Vitest dans la CI
- [x] Tests d'intégration API avec vraie DB PostgreSQL dans la CI
- [ ] Ajouter les tests E2E Playwright dans la CI *(specs existent localement, pas encore dans ci.yml)*
- [ ] Ajouter l'audit accessibilité Playwright + axe-core dans la CI *(a11y.spec.ts local seulement)*
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
  - [ ] Règles d'auto-merge pour les patchs non critiques

### Release
- [x] Versioning sémantique 0.x.y en place
- [x] Images Docker taguées `:sha` et `:latest`
- [ ] Tag Docker `:version` (ex: `:0.10.0`)
- [ ] Automatiser les tags git de release *(manuel actuellement)*
- [ ] Générer automatiquement les release notes *(patch-notes.ts est manuel)*

### Déploiement
- [x] Healthcheck API `/health` (DB + Redis + version)
- [x] Vérification migrations Prisma au démarrage container
- [ ] Environnement éphémère pour chaque PR validée
- [ ] Stratégie de rollback documentée
- [x] Smoke test web post-déploiement
- [x] Validation post-déploiement automatisée en fin de deploy.yml

### Protection des branches *(GitHub settings — non configurés)*
- [ ] Bloquer les push directs sur `master`
- [ ] Autoriser les merges uniquement via PR validée
- [ ] Rendre obligatoires les checks CI avant merge
- [ ] Exiger au moins une review
- [ ] Activer la suppression automatique des branches après merge

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
- [ ] Scan de secrets dans le code (truffleHog / gitleaks)
- [x] Scan d'images Docker
- [ ] Politique de rotation des secrets
- [x] Durcir les permissions GitHub Actions

---

## P1 - Gouvernance GitHub

- [ ] Template de pull request
- [ ] Templates d'issues (Bug / Feature / Tâche technique)
- [ ] Backlog projet via GitHub Issues
- [ ] Labels standards (`bug`, `feature`, `tech`, `security`, `ux`, `good first issue`)
- [ ] Milestones
- [ ] Workflow de triage

---

## P1 - Produit et roadmap

### Hub / Pivot
- [x] Application en mode Hub
- [x] Rebrand FORGE → **PIVOT** *(feat/rebrand-pivot, à merger)*
- [x] Parcours principaux du Hub (récents + modules + à venir)
- [x] Navigation shell depuis les manifests modules
- [ ] Renommer les identifiants internes `ForgeEvent` / `FORGE_MODULES` / métriques `forge_*` → `pivot` *(optionnel, non visible utilisateur)*

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
- [ ] Alertes (API indisponible, taux erreur, latence, échec déploiement)
- [ ] Runbooks d'exploitation documentés
- [ ] Définir les SLO/SLA internes

---

## P1 - Données et migrations

- [x] Migrations Prisma en production (`prisma migrate deploy` au démarrage)
- [x] DB de test représentative pour les tests d'intégration
- [ ] Stratégie de backup PostgreSQL
- [ ] Tester la restauration des backups
- [ ] Procédure de rollback migration documentée

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
- [ ] Documenter l'installation locale
- [x] Documenter les CI/CD en place
- [ ] Documenter l'architecture applicative
- [ ] Documenter les décisions structurantes via ADR
- [ ] Checklist d'incident

---

## Points clarifiés
- [x] Branche principale : `master`
- [x] Modules Hub prioritaires : PouetPouet, Daily, Scrum Poker, La Roue, Capacité
- [x] Rôles : Propriétaire / Éditeur / Lecteur (+ co-propriétaire)
- [x] RGPD minimal : export + suppression + rétention + pages légales

## Points encore ouverts
- [ ] Environnement de référence avant prod : staging ou preview PR ?
- [ ] Niveau de conformité RGPD cible pour la v1 exploitable
- [ ] SMTP en prod (secrets deploy.yml à configurer)
- [ ] Redis/Memorystore en prod (max-instances bloqué à 1 sans lui)
