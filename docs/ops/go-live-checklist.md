# Checklist d'activation infra (go-live)

> Séquence **ordonnée** des étapes hors-repo (GCP + admin GitHub) pour activer ce qui
> a été câblé côté code. À exécuter par un compte **admin GitHub** + **GCP** (projet
> `${GCP_PROJECT_ID}`, région `europe-west1`).
>
> ⚠️ Respecter l'ordre : certaines étapes en bloquent d'autres (ex. Redis **avant**
> multi-instance). Les détails de chaque bloc sont dans les runbooks référencés.

Pré-remplir :
```bash
export PROJECT=<GCP_PROJECT_ID>
export REGION=europe-west1
gcloud config set project "$PROJECT"
```

---

## 1. Admin GitHub *(aucun GCP requis)* — réf. `.github/admin-settings.md`
- [ ] **Repository settings** : activer `Allow auto-merge` (requis par `dependabot-auto-merge.yml`) et `Automatically delete head branches`.
- [ ] **Branch protection `master` et `develop`** : PR obligatoire, checks requis (`Quality gates`, `API integration tests`, `E2E & accessibility (Playwright)`, `Secret scan (gitleaks)`, `Runtime dependency audit`, `Container scan (api)`, `Container scan (web)`), conversation resolution, à jour avant merge.

> Note : ajouter `E2E…` et `Secret scan…` à la liste des checks requis (ils n'existaient pas quand `admin-settings.md` a été écrit).

## 2. Secrets GCP (Secret Manager) — réf. `project-email-verification`
Vérifier/créer les secrets consommés par `deploy.yml` :
- [ ] `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` (URL du web déployé), `SMTP_USER`, `SMTP_PASS`.
```bash
printf '%s' "<valeur>" | gcloud secrets create SMTP_USER --data-file=- 2>/dev/null \
  || printf '%s' "<valeur>" | gcloud secrets versions add SMTP_USER --data-file=-
# idem SMTP_PASS, FRONTEND_URL si absents
```
- [ ] Sans ça : les emails de vérification ne partent pas (cf. runbook). Un nouveau déploiement les utilisera automatiquement.

## 3. Backups PostgreSQL — réf. `docs/ops/backup-restore-rollback.md`
- [ ] Activer backups automatiques + PITR :
```bash
gcloud sql instances patch pouetpouet-db \
  --backup-start-time=02:00 --enable-point-in-time-recovery \
  --retained-backups-count=7 --retained-transaction-log-days=7
```
- [ ] Exécuter **un test de restauration** dans une instance clone (consigner la date dans le runbook §2).

## 4. Observabilité & alertes — réf. `docs/ops/observability-slo-alerting.md`
- [ ] Créer un canal de notification Monitoring (`gcloud beta monitoring channels create …`) → noter `CHANNEL_ID`.
- [ ] Uptime checks `/health` (API + Web) + 3 politiques d'alerte (indispo, 5xx, latence p95).
- [ ] Règles d'alerte Sentry (projets API + Web).
- [ ] (Optionnel) secret `SLACK_WEBHOOK_URL` pour la notif d'échec de déploiement (déjà câblée dans `deploy.yml`).

## 5. Activer le multi-instance — réf. `docs/ops/scaling-multi-instance.md`
> ⚠️ **Bloquant** : faire Redis AVANT de monter `MAX_INSTANCES`, sinon le temps réel casse.
- [ ] Provisionner Memorystore :
```bash
gcloud redis instances create pouetpouet-redis --size=1 --region="$REGION" --redis-version=redis_7_0
gcloud redis instances describe pouetpouet-redis --region="$REGION" --format='value(host,port)'
```
- [ ] Créer le connecteur VPC :
```bash
gcloud compute networks vpc-access connectors create pouetpouet-conn --region="$REGION" --range=10.8.0.0/28
```
- [ ] Définir les **variables de dépôt GitHub** (Settings → Actions → Variables) :
  `REDIS_HOST` = IP Memorystore, `REDIS_PORT` = 6379, `VPC_CONNECTOR` = `pouetpouet-conn`.
  ```bash
  gh variable set REDIS_HOST --body "<IP>"
  gh variable set VPC_CONNECTOR --body "pouetpouet-conn"
  ```
- [ ] **Redéployer** (push master) → vérifier que l'API se connecte à Redis (logs).
- [ ] Seulement après validation : `gh variable set MAX_INSTANCES --body "5"` → redéployer.
- [ ] Vérifier le pool DB : garder `MAX_INSTANCES × DB_CONNECTION_LIMIT (=10) < max_connections` Cloud SQL.

## 6. Valider la charge — réf. `load-test/`
- [ ] Lancer le load test contre l'environnement (pas un runner CI) :
```bash
BASE_URL=https://<api-prod> VUS=100 DURATION=2m k6 run load-test/board-load.js
```
- [ ] Vérifier les seuils SLO (p95 < 500 ms, erreurs < 1 %).

---

### Ordre de dépendances (résumé)
```
1 admin GitHub      ─┐
2 secrets GCP        ├─ indépendants
3 backups            │
4 alertes            ┘
5 Redis → vars → MAX_INSTANCES   (séquentiel, Redis d'abord)
6 load test          (après 5, contre l'env cible)
```
