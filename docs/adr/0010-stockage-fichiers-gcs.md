# ADR-0010 — Stockage de fichiers sur Google Cloud Storage

> Statut : `Accepté` · Date : 2026-07-01 · Remplace : — · Remplacé par : —

## Contexte

Les modules **Forms** (pièces jointes des réponses anonymes) et **Parcours**
(documents d'étape) introduisent le premier besoin de stockage de fichiers
binaires de la plateforme. Jusqu'ici tout était relationnel (Postgres) ou
éphémère (Redis). Deux flux distincts :

- **Upload authentifié** (documents de parcours) : le client peut uploader
  directement via une *signed URL*.
- **Upload anonyme** (réponses de formulaire public) : le répondant n'a pas de
  compte, le buffer transite donc par l'API qui le persiste.

## Décision

- **Prod : Google Cloud Storage** (`@google-cloud/storage`), bucket
  `GCS_BUCKET`, cohérent avec le déploiement Cloud Run existant (mêmes
  credentials GCP, pas de nouveau fournisseur à opérer). Signed URLs v4 pour
  l'upload/download authentifié ; `save()`/`download()` côté serveur pour le
  flux anonyme.
- **Dev local : système de fichiers** sous `apps/api/.uploads/` (gitignoré),
  exposé via des routes `/_dev/*`. Aucune dépendance GCP requise en local.
- **Confinement des chemins** : toute clé résolue en local passe par un garde
  `path.resolve` + `startsWith(LOCAL_UPLOAD_DIR)` (cf. `apps/api/src/lib/storage.ts`)
  pour empêcher le path traversal via une clé forgée.

Couche unique : `apps/api/src/lib/storage.ts` (`saveFile`, `readFile`,
`deleteStorageFile`, `getUploadSignedUrl`, `getDownloadSignedUrl`), agnostique
du module appelant.

## Conséquences

- Un secret/bucket GCS supplémentaire à garnir en prod (`GCS_BUCKET`).
- Les clés de stockage sont opaques et préfixées par module/ressource
  (`forms/<id>/…`, `parcours/<id>/…`) ; l'autorisation reste portée par les
  routes (rôle + appartenance de la ressource), pas par le stockage.

## Déclencheurs de parcours (cron) — hors périmètre pour l'instant

Le déclencheur **`schedule` (cron, via `node-cron`)** est **différé** : le
moteur de planification (bootstrap au démarrage, activation de la première
étape, persistance de la config cron) n'est pas finalisé. L'option est grisée
dans le FlowBuilder (« bientôt disponible ») et refusée côté API. Les
déclencheurs `manual`, `form_response` et `webhook` restent actifs. Une ADR
dédiée documentera la planification quand elle sera reprise.
