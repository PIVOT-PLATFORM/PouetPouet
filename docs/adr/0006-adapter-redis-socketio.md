# ADR-0006 — Adapter Redis Socket.io avec fallback mémoire

> Statut : `Accepté` · Date : 2026-06-17 · Remplace : — · Remplacé par : —

> ADR rétroactive : fige une décision déjà en vigueur dans le repo.

## Contexte

L'objectif de scalabilité est ~100 utilisateurs simultanés, ce qui implique de
pouvoir lancer **plusieurs instances** Cloud Run derrière le même service. Or
Socket.io en mémoire ne diffuse les événements qu'aux clients connectés à
**l'instance locale** : un broadcast émis par l'instance A n'atteint pas les
participants connectés à l'instance B. En dev et en test, en revanche, il n'y a ni
Redis ni multi-instance, et exiger Redis casserait l'expérience locale.

## Options envisagées

- **In-memory seul** — zéro dépendance, mais plafonné à **une** instance : pas de
  montée en charge horizontale.
- **Sticky sessions sans adapter** — garde un client sur une instance, mais ne
  résout pas les broadcasts cross-instance (une room peut s'étaler sur plusieurs
  instances).
- **Adapter Redis, activé conditionnellement** — pub/sub Redis pour propager les
  événements entre instances en prod, fallback in-memory ailleurs.

## Décision

**`@socket.io/redis-adapter`, activé conditionnellement.** Si Redis est connecté
(`redis.status === 'ready'`, prod avec `REDIS_HOST`), on attache l'adapter ; sinon
on conserve l'adapter in-memory par défaut. L'attachement gère aussi la connexion
**différée** (Redis pas encore prêt au démarrage → `redis.once('ready', …)`).

Subtilité câblée : le client *subscriber* duplique la connexion avec
`lazyConnect: false` / `enableOfflineQueue: true` — sinon son `psubscribe`
partirait avant la connexion et échouerait définitivement.

## Conséquences

- Dev et test fonctionnent **sans Redis** (in-memory), aucune friction locale.
- La prod est prête pour le multi-instance dès que Memorystore est provisionné
  (cf. [`docs/ops/scaling-multi-instance.md`](../ops/scaling-multi-instance.md)).
- Tant que Memorystore n'est pas provisionné, `MAX_INSTANCES` reste à 1 : le code
  est prêt, le provisioning prod est le dernier verrou.
- Prix à payer : deux chemins de comportement (avec/sans Redis) à garder cohérents
  — d'où l'exigence d'un comptage de participants **cross-instance**
  (`fetchSockets`) plutôt qu'une lecture locale.
