# Comptes & données de démonstration

Jeu de comptes et de données réalistes pour explorer **à la main** les modules
Formulaires, Parcours et Feedback. Généré par un script qui passe par l'API HTTP
(donc toute la logique métier : partages, activation de première étape,
notifications). **Dev / démo uniquement.**

## Lancer le seed

Prérequis : les services (`docker compose up -d`) et les serveurs dev tournent
(`npm run dev` à la racine).

```bash
cd apps/api && npm run seed:demo
```

Le script est **idempotent** : relancé, il se connecte aux comptes existants
plutôt que de les recréer (les données — formulaire, parcours, tickets — sont en
revanche recréées à chaque exécution).

Options d'environnement :

```bash
API_URL=http://localhost:4000 DEMO_PASSWORD=Mmdp-1234 npm run seed:demo
```

### Activer le profil admin

Le module Feedback réserve le déplacement/suppression des tickets aux admins,
déterminés par la variable `ADMIN_EMAILS` **lue au démarrage de l'API**. Pour que
`admin@pivot.test` ait les droits admin, positionner dans `apps/api/.env` :

```
ADMIN_EMAILS=admin@pivot.test
```

puis redémarrer l'API. Sans ça, le compte est créé mais sans pouvoirs admin (le
script le signale).

## Les comptes

Mot de passe commun : **`Mmdp-1234`**

| Email | Profil | À voir |
|-------|--------|--------|
| `admin@pivot.test` | 👑 Alex — Admin | `/feedback` : déplacer les cartes entre colonnes, supprimer des tickets. |
| `manager@pivot.test` | 💪 Marie — Power user | Propriétaire d'un formulaire publié (« Satisfaction équipe — Q3 », 3 réponses), d'un parcours « Validation demande de congés » avec une instance en cours, et de tickets feedback. |
| `approver@pivot.test` | ✅ Bruno — Valideur | Instance parcours partagée en EDITOR avec une étape de validation à traiter ; EDITOR sur le formulaire de Marie. |
| `viewer@pivot.test` | 👁️ Chloé — Lectrice | Accès VIEWER (lecture seule) au formulaire et à l'instance de Marie. |

## Parcours de démo suggéré

1. **admin@pivot.test** → `/feedback` : déplace des cartes, observe les votes.
2. **manager@pivot.test** → `/forms` (vue des réponses + export CSV) et `/parcours`
   (le template dans le FlowBuilder).
3. **approver@pivot.test** → `/parcours` : ouvre « Congés été — Marie » et **valide
   l'étape** → l'instance avance.
4. **viewer@pivot.test** sur les mêmes ressources : tout est en lecture seule.
