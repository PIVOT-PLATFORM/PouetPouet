# Runbook — Observabilité, SLO & alertes

> Périmètre : objectifs de service (SLO) internes et alertes pour l'API/Web
> (Cloud Run) et la base (Cloud SQL). Complète le runbook
> [backups, restauration & rollback](./backup-restore-rollback.md).
>
> Signaux déjà en place : `GET /health` (DB + Redis + version), `GET /metrics`
> (Prometheus), logs structurés pino, Sentry (API + Web), audit log
> (`/api/auth/security-log`).

---

## 1. SLO / SLA internes

Cibles internes (pas d'engagement contractuel externe à ce stade). Fenêtre : 30 jours glissants.

| SLI | Objectif (SLO) | Source de mesure |
|-----|----------------|------------------|
| Disponibilité API | **99,5 %** (`/health` 200) | Uptime check Cloud Monitoring |
| Disponibilité Web | **99,5 %** | Uptime check Cloud Monitoring |
| Latence API | **p95 < 500 ms** (hors WebSocket) | Métrique Cloud Run `request_latencies` |
| Taux d'erreur API | **< 1 %** de 5xx | Métrique Cloud Run `request_count` (classe 5xx) |

**Error budget** : 99,5 % / 30 j ≈ **3 h 39 min** d'indisponibilité tolérée par mois.
Au-delà, on gèle les évolutions non critiques et on priorise la fiabilité.

> Revue : à chaque rétro mensuelle, comparer le réalisé aux SLO et consigner.

---

## 2. Alertes

> Comme les backups, les politiques d'alerte se créent côté **GCP / Sentry** (pas d'IaC
> dans le repo). Commandes de référence ci-dessous ; canal de notification à brancher
> une fois (`gcloud beta monitoring channels create …` → réutiliser son `CHANNEL_ID`).

### 2.1 API / Web indisponible
Uptime check sur `/health` + politique d'alerte si échec.

```bash
# Uptime check (à faire une fois, ou via la console Monitoring)
gcloud monitoring uptime create pouetpouet-api-health \
  --resource-type=uptime-url \
  --host=<API_HOST> --path=/health --period=60s

# Politique : alerte si l'uptime check échoue
gcloud alpha monitoring policies create \
  --notification-channels=<CHANNEL_ID> \
  --display-name="API indisponible (/health)" \
  --condition-display-name="uptime check failing" \
  --condition-threshold-filter='metric.type="monitoring.googleapis.com/uptime_check/check_passed" AND resource.type="uptime_url"' \
  --condition-threshold-comparison=COMPARISON_LT \
  --condition-threshold-value=1 \
  --condition-threshold-duration=180s
```

### 2.2 Taux d'erreur (5xx)
Alerte si le ratio de réponses 5xx Cloud Run dépasse le SLO (1 %) sur 5 min.
Doublé par une **règle Sentry** « nombre d'erreurs > N sur 5 min » (issue alert)
sur les projets API et Web.

### 2.3 Latence
Alerte si la **p95** de `request_latencies` (Cloud Run, service `pouetpouet-api`)
dépasse 500 ms sur 10 min.

### 2.4 Échec de déploiement
Automatisé dans `.github/workflows/deploy.yml` : le job **`notify-failure`**
(`if: failure()`) poste sur Slack si le secret `SLACK_WEBHOOK_URL` est défini ;
sinon il loggue (GitHub notifie déjà l'auteur du commit par défaut).
Pour activer Slack : créer un Incoming Webhook et l'ajouter en secret `SLACK_WEBHOOK_URL`.

---

## 3. Tableaux de bord

| Quoi | Où |
|------|-----|
| Métriques applicatives | `GET /metrics` (Prometheus) — à scraper / brancher sur un Grafana ou Cloud Monitoring |
| Latence / trafic / erreurs Cloud Run | Console Cloud Run → service → Metrics |
| Erreurs applicatives | Sentry (projets API + Web) |
| Actions sensibles | `/api/auth/security-log` (UI profil) |
| Santé instantanée | `GET /health` |

---

## 4. Réaction aux alertes (runbook)

| Alerte | Premier réflexe | Suite |
|--------|-----------------|-------|
| **API/Web indisponible** | Vérifier `/health`, logs Cloud Run, état Cloud SQL | Rollback révision si lié à un déploiement (cf. [rollback](./backup-restore-rollback.md#4-rollback-de-déploiement-cloud-run)) |
| **Taux d'erreur ↑** | Identifier l'issue dans Sentry (stacktrace, release) | Forward-fix ou rollback ; vérifier migration récente |
| **Latence ↑** | Vérifier charge (connexions, CPU), Cloud SQL (slow queries) | Scaler (cf. ROADMAP P2), pooling DB ; suspecter un N+1 |
| **Échec de déploiement** | Ouvrir le run GitHub Actions en échec | Corriger et re-pousser ; la prod tourne sur la révision précédente |

**Escalade** : si l'error budget mensuel est consommé, geler les évolutions non
critiques et ouvrir un post-mortem (cause, impact, action corrective).

---

## 5. Reste à appliquer (hors repo)

- [ ] Créer le canal de notification Monitoring + les 3 politiques (indispo / erreurs / latence).
- [ ] Créer les uptime checks API et Web.
- [ ] Créer les règles d'alerte Sentry (API + Web).
- [ ] (Optionnel) Ajouter le secret `SLACK_WEBHOOK_URL` pour les notifications.
