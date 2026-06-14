# Activer le multi-instance (scaling horizontal)

> Le code est déjà prêt : adapter Redis Socket.io, registres Scrum/présence en Redis,
> comptage des participants cross-instance (`fetchSockets`). `deploy.yml` est
> paramétré pour le multi-instance, avec des **défauts sûrs = mono-instance**.
> Activer ne demande **aucun changement de code**, seulement de l'infra + des
> variables de dépôt.

## ⚠️ Prérequis bloquant
Sans Redis partagé en prod, passer `max-instances > 1` **casse le temps réel**
(chaque instance est isolée : les broadcasts Socket.io ne traversent pas les instances).
**Provisionner Redis d'abord.**

## Étapes

### 1. Provisionner Redis (Memorystore)
```bash
gcloud redis instances create pouetpouet-redis \
  --size=1 --region=europe-west1 --redis-version=redis_7_0
gcloud redis instances describe pouetpouet-redis \
  --region=europe-west1 --format='value(host,port)'   # note le host (IP) et le port
```

### 2. Connecteur VPC (Cloud Run → Memorystore en IP privée)
```bash
gcloud compute networks vpc-access connectors create pouetpouet-conn \
  --region=europe-west1 --range=10.8.0.0/28
```

### 3. Définir les variables de dépôt GitHub
(`Settings → Secrets and variables → Actions → Variables`)

| Variable | Valeur | Effet |
|----------|--------|-------|
| `REDIS_HOST` | IP Memorystore (étape 1) | branche l'adapter Redis |
| `REDIS_PORT` | `6379` (défaut) | port Redis |
| `VPC_CONNECTOR` | `pouetpouet-conn` | accès Memorystore depuis Cloud Run |
| `MAX_INSTANCES` | ex. `5` | autorise le scaling horizontal |

> Tant que ces variables ne sont pas définies, le déploiement reste en mono-instance
> (`max-instances=1`, `REDIS_HOST=localhost`) — comportement actuel inchangé.

### 4. Déployer
Pousser sur `master` (ou relancer `deploy.yml`). Le service prend les nouvelles
valeurs : l'API se connecte à Redis et Cloud Run peut scaler.

## Validation
- Logs API : connexion Redis OK (plus d'erreur de connexion silencieuse).
- Ouvrir une session/board sur deux clients servis par **deux instances** : présence,
  votes et curseurs se propagent → l'adapter Redis fonctionne cross-instance.
- Surveiller le pool DB : garder `MAX_INSTANCES × DB_CONNECTION_LIMIT < max_connections`
  Cloud SQL (cf. `apps/api/src/lib/prisma.ts`, défaut 10/instance).
- Lancer le load test (`load-test/`) contre l'URL prod et vérifier les SLO.

## Rollback
Repasser `MAX_INSTANCES=1` (et redéployer) suffit à revenir en mono-instance.
