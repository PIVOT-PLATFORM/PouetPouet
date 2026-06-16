# Architecture des plugins Pivot

> Document de conception. Couvre #28 (architecture), #29 (prérequis de fiabilité),
> #30 (roadmap), #31 (cycle de vie). Source de vérité roadmap : `ROADMAP.md` +
> milestone GitHub *1.0.0 - Exploitable*.

## 1. Contexte & vision

Pivot est une **suite collaborative data-centric** : un graphe de données partagé
dont les applications sont des *vues*, communiquant via un **bus d'événements** et
des **objets pivots**. Un « plugin » est l'aboutissement naturel de cette
architecture : un module tiers qui s'enregistre dans le socle sans le modifier.

La bonne nouvelle : le socle expose déjà les briques d'un système de plugins.
**Ouvrir aux plugins, ce n'est pas tout réécrire — c'est durcir et publier les
contrats existants.**

## 2. État actuel — les modules internes sont des proto-plugins

| Brique | Emplacement | Rôle pour les plugins |
|--------|-------------|------------------------|
| `ModuleManifest` | `packages/shared/src/forge/manifest.ts` | Déclare déjà `id`, `nav`, `apiPrefix`, `ownedEntities`, `referencedPivots`, `emits`, `listensTo` → c'est un **manifeste de plugin** |
| Registre | `apps/api/src/modules/registry.ts` (`API_MODULES`) | Monte routes + handlers socket en itérant une liste → point d'enregistrement |
| Bus d'événements | `apps/api/src/lib/bus.ts` (`EventBus`) | Découplage inter-modules (`<module>.<entité>.<action>`) |
| Règle d'isolation | en-tête de `registry.ts` | Un module n'importe que depuis son dossier, `../../lib` (socle) et `@pouetpouet/shared` |
| Partage par ressource | `apps/api/src/lib/module-share.ts` (`ModuleShare`) | Modèle de permissions réutilisable par tout module/plugin |
| Feature flags | `apps/api/src/lib/feature-flags.ts` | Activation/rollout par environnement → activation de plugin |
| Webhooks | `routes/webhooks.ts` | Sortie événementielle vers des intégrations externes |

La frontière de module **tient déjà partiellement** (chaque module vit dans
`modules/<id>/`). Le cap à franchir est de la rendre **étanche et versionnée**.

## 3. Architecture cible (#28)

### 3.1 Anatomie d'un plugin
Un plugin = un package npm `@pivot-plugin/<id>` exportant :

```
manifest        ModuleManifest étendu (cf. 3.2)
api?            { routes: FastifyPluginAsync[], socketHandlers: [] }   // back, optionnel
ui?             { nav, lazy components }                              // front, optionnel
migrations?     SQL idempotent, namespacé par préfixe de table
```

Le socle charge le plugin **par son manifeste**, jamais par import direct : le
registre devient dynamique (lu depuis la base + le système de fichiers / un
registre distant) au lieu d'être la constante `API_MODULES`.

### 3.2 Contrats d'intégration
Le manifeste actuel est étendu de ce qui manque pour un tiers :

- `version` (semver) + `pivotApi` (plage de versions du socle supportée).
- `permissions` : capacités demandées (`db:own-tables`, `bus:emit:<type>`,
  `bus:listen:<type>`, `http:outbound`, `user:identity`). **Refus par défaut** ;
  l'admin accorde à l'installation.
- `ownedEntities` / `referencedPivots` déjà présents : un plugin **ne possède que
  ses entités**, et ne touche aux pivots des autres que **par id, en lecture, via
  le bus ou une API publique** — jamais en SQL direct.

### 3.3 Frontières de responsabilité
| Responsabilité | Socle | Plugin |
|----------------|-------|--------|
| Identité / auth / sessions | ✅ | ❌ (consomme `request.user`) |
| Bus, notifications, webhooks | ✅ | publie/écoute selon permissions |
| Schéma de ses entités | — | ✅ (tables préfixées `<id>_`) |
| Schéma du socle / autres modules | ✅ | ❌ |
| Permissions sur ses ressources | réutilise `ModuleShare` | ✅ via la lib socle |

### 3.4 Isolation & sandboxing
- **V1 (modules de confiance, first-party)** : isolation par convention +
  lint/CI qui vérifie la règle d'imports. Pas de sandbox runtime.
- **V2 (tiers)** : exécution back hors-process (worker/container) communiquant
  avec le socle via une API contractuelle + bus ; quotas CPU/mémoire ; pas
  d'accès direct au `PrismaClient` du socle (un client restreint à ses tables).
- Front : composants chargés en lazy, montés dans des routes namespacées ; pas
  d'accès au store global au-delà d'une API `usePivot()` exposée.

## 4. Cycle de vie d'un plugin (#31)

```
 Découverte → Installation → Activation → Configuration → Mise à jour → Désactivation → Désinstallation
```

1. **Installation** : résolution du package + vérif `pivotApi`, lecture du
   manifeste, **revue des permissions demandées par un admin**, exécution des
   migrations namespacées. État : `INSTALLED` (inactif).
2. **Activation** : pilotée par **feature flag** (`plugin:<id>`) → rollout par
   environnement/pourcentage possible. Routes & handlers montés à chaud (ou au
   prochain boot tant que le montage à chaud n'est pas livré).
3. **Configuration** : valeurs propres au plugin, par environnement, stockées
   dans une table socle `PluginConfig (pluginId, environment, key, value)`.
4. **Permissions** : capacités du manifeste accordées/révoquées par l'admin ;
   permissions sur les *ressources* du plugin via `ModuleShare`.
5. **Versioning** : semver. Mises à jour mineures/patch automatisables ; une
   majeure exige une nouvelle revue de permissions. Migrations **forward-only**,
   idempotentes, réversibles documentées.
6. **Désactivation** : flag off — données conservées.
7. **Désinstallation** : `deleteResourceShares` + drop des tables `<id>_*` +
   purge `PluginConfig` ; le socle et les autres plugins ne sont jamais touchés.

## 5. Prérequis de fiabilité avant ouverture (#29)

À traiter **avant** d'accepter le moindre plugin tiers :

- [ ] **Étanchéité de la frontière de module** : règle d'imports vérifiée en CI
      (un module ne touche que son dossier + socle + shared).
- [ ] **Extraction en packages** : `packages/module-*` réellement isolés (cf. note
      « quand cette frontière tiendra » dans `registry.ts`).
- [ ] **API socle versionnée** : contrat `pivotApi` semver + tests de
      compatibilité ; OpenAPI publié.
- [ ] **Bus durable** : passage de l'`InProcessBus` à un transport persistant
      (Redis Streams) avec garanties de livraison et types d'événements versionnés.
- [ ] **Modèle de permissions/capacités** généralisé (au-delà de `ModuleShare`
      ressource → capacités plugin).
- [ ] **Migrations namespacées** + client Prisma restreint par plugin.
- [ ] **Observabilité par plugin** : métriques, logs, erreurs attribués au plugin
      (cf. `docs/ops/observability-slo-alerting.md`).
- [ ] **Quotas & coupe-circuit** : un plugin lent/en boucle ne dégrade pas le socle.
- [ ] **Tests d'autorisation systématiques** (#37) étendus à chaque module.

## 6. Roadmap plugins (#30)

Alignée sur les phases plateforme (memory `project-forge-roadmap`, F0→F6) :

| Jalon | Contenu | Dépend de |
|-------|---------|-----------|
| **P0 — Socle modulaire** *(en cours)* | Registre, manifeste, bus in-process, isolation par convention, `ModuleShare`, feature flags | — |
| **P1 — Frontière étanche** | Lint/CI d'imports, extraction `packages/module-*`, OpenAPI publié | P0 |
| **P2 — Contrats publics** | Manifeste étendu (`version`, `pivotApi`, `permissions`), bus persistant + événements versionnés | P1 |
| **P3 — Plugins first-party hors-arbre** | Un module chargé dynamiquement depuis son package, montage par manifeste | P2 |
| **P4 — Cycle de vie complet** | Install/activation/config/désinstall + `PluginConfig`, montage à chaud | P3 |
| **P5 — Plugins tiers** | Sandbox runtime, client Prisma restreint, quotas, revue de permissions, registre de distribution | P4, #29 |
| **P6 — Composeur** | Assemblage de vues multi-plugins (fin de roadmap Pivot) | P5 |

**Principe directeur** : chaque jalon est livrable indépendamment et n'ouvre aux
plugins tiers (P5) qu'une fois la checklist #29 verte. On n'expose jamais un
contrat qu'on n'est pas prêt à maintenir en semver.
