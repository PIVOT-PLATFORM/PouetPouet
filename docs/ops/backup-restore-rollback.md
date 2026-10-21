# Runbook — Backups, restauration & rollback

> Périmètre : base **PostgreSQL** de production (Cloud SQL, instance `pouetpouet-db`) et
> service **Cloud Run** `pouetpouet-api`. Les migrations Prisma sont appliquées au
> démarrage du conteneur (`prisma migrate deploy`).
>
> Toutes les commandes `gcloud` supposent que le projet et la région sont configurés
> (`gcloud config set project <GCP_PROJECT_ID>` ; région `europe-west1`).

---

## 1. Stratégie de backup PostgreSQL

Deux niveaux complémentaires :

| Niveau | Quoi | Granularité de restauration |
|--------|------|------------------------------|
| **Backups automatiques Cloud SQL** | Snapshot quotidien managé | Point de restauration quotidien |
| **Point-in-time recovery (PITR)** | Journaux de transactions (WAL) | N'importe quel instant dans la fenêtre de rétention |

### Activation (une fois)

```bash
gcloud sql instances patch pouetpouet-db \
  --backup-start-time=02:00 \
  --enable-point-in-time-recovery \
  --retained-backups-count=7 \
  --retained-transaction-log-days=7
```

- `--backup-start-time` : heure UTC du backup quotidien (creux de trafic).
- `--enable-point-in-time-recovery` : active les WAL pour le PITR.
- Rétention : 7 backups quotidiens + 7 jours de journaux. À ajuster selon le RPO cible.

### Backup manuel à la demande

À lancer **avant toute opération risquée** (migration destructive, import massif) :

```bash
gcloud sql backups create --instance=pouetpouet-db \
  --description="avant migration <nom>"
```

### Export logique (optionnel, hors-site)

Pour conserver une copie indépendante de l'instance (ex. dans un bucket GCS) :

```bash
gcloud sql export sql pouetpouet-db \
  gs://<BUCKET>/backups/pouetpouet-$(date +%F).sql.gz \
  --database=pouetpouet
```

> **À faire (non automatisé) :** planifier cet export (Cloud Scheduler + job) et
> alerter en cas d'échec de backup. Voir ROADMAP « Données et migrations ».

---

## 2. Restauration

> ⚠️ Restaurer **dans une nouvelle instance** (clone) plutôt que d'écraser la prod,
> sauf incident majeur avéré. On valide la copie avant toute bascule.

### Lister les backups disponibles

```bash
gcloud sql backups list --instance=pouetpouet-db
```

### Restaurer un backup quotidien dans une instance de test

```bash
gcloud sql backups restore <BACKUP_ID> \
  --restore-instance=pouetpouet-db-restore-test \
  --backup-instance=pouetpouet-db
```

### Restaurer à un instant précis (PITR) via clone

```bash
gcloud sql instances clone pouetpouet-db pouetpouet-db-pitr \
  --point-in-time='2026-06-14T01:30:00Z'
```

### Vérification post-restauration (checklist)

1. L'instance démarre et accepte les connexions.
2. Compter les lignes des tables critiques et comparer à l'attendu :
   ```sql
   SELECT
     (SELECT count(*) FROM "User")  AS users,
     (SELECT count(*) FROM "Board") AS boards;
   ```
3. Pointer une instance applicative de test sur la base restaurée et vérifier `/health`.
4. Si OK : soit promouvoir le clone, soit supprimer l'instance de test.

### Cadence de test

**Tester la restauration au moins une fois par trimestre** (un backup non testé n'est pas
un backup). Consigner la date et le résultat du dernier test ci-dessous :

| Date du test | Backup testé | Résultat | Par |
|--------------|--------------|----------|-----|
| _à compléter_ | | | |

---

## 3. Rollback d'une migration Prisma

`prisma migrate deploy` **n'applique pas de « down »** automatique. Deux stratégies, par
ordre de préférence :

### A. Forward-fix (par défaut)

Pour la plupart des cas, **ne pas revenir en arrière** : écrire une nouvelle migration
corrective et la déployer normalement. Plus sûr qu'un rollback de schéma.

### B. Restauration (migration destructive ayant corrompu/perdu des données)

1. **Stopper le trafic** vers la révision fautive (cf. §4).
2. Restaurer la base à l'instant **juste avant** la migration via PITR (§2), idéalement
   à partir du backup manuel pris avant l'opération.
3. Redéployer la **révision applicative précédente** (§4) — celle dont le schéma
   correspond à la base restaurée.
4. Marquer l'état des migrations comme cohérent si nécessaire :
   ```bash
   npx prisma migrate resolve --rolled-back <nom_migration>
   ```
5. Rédiger la migration corrective et reprendre le cycle normal.

> **Règle d'or :** toute migration potentiellement destructive (DROP/ALTER de colonnes
> avec données) est précédée d'un **backup manuel** (§1) et, si possible, découpée en
> étapes compatibles (expand → migrate → contract).

---

## 4. Rollback de déploiement (Cloud Run)

> **Historique.** La prod n'est plus sur Cloud Run (projet GCP supprimé le 22/08/2026,
> `deploy.yml` retiré). Rollback actuel : workflow **Publish images** en mode `rollback`
> puis Restart dans Coolify — voir README, « Revenir en arrière ».

Chaque déploiement crée une **révision** immutable. Rollback = renvoyer le trafic vers la
révision précédente (l'image est aussi taguée `:version` et `:sha`, cf. `deploy.yml`).

### Lister les révisions

```bash
gcloud run revisions list --service=pouetpouet-api --region=europe-west1
```

### Basculer 100 % du trafic vers la révision précédente

```bash
gcloud run services update-traffic pouetpouet-api \
  --region=europe-west1 \
  --to-revisions=<REVISION_PRECEDENTE>=100
```

> ⚠️ Un rollback applicatif **ne défait pas** une migration de base déjà appliquée. Si la
> migration est incompatible avec l'ancienne révision, traiter d'abord la base (§3).

Faire de même pour `pouetpouet-web` si nécessaire (le web est sans état).

---

## 5. Ordre de réaction en cas d'incident de déploiement

1. **Détecter** : `/health` KO, pic d'erreurs Sentry, alerte.
2. **Trafic** : basculer Cloud Run sur la révision saine précédente (§4).
3. **Base** : si une migration est en cause, restaurer / PITR (§2-3).
4. **Constater** : `/health` OK, erreurs Sentry retombées, smoke test manuel.
5. **Post-mortem** : noter la cause et l'action corrective (forward-fix).
