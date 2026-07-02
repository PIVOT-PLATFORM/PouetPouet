# ADR-0011 — Commande publique : l'app gère le workflow, les données viennent toujours d'ailleurs

> Statut : `Accepté` · Date : 2026-06-30 · Remplace : — · Remplacé par : —

## Contexte

Le module Commande publique modélise un processus réel d'entreprise : les contrats,
demandes d'achat et commandes existent dans un PGI (type SAP), l'organigramme dans
un annuaire LDAP/OIDC. Une première itération avait stocké ces entités directement
en base Prisma (CRUD complet Contrat/ContratLot/Commande/DemandeAchat/DemandeAchatLot/
OrgUnit), pratique pour itérer vite mais qui ne reflète pas la réalité : en
production, ces données **n'existeraient pas dans Pivot** — elles viendraient d'un
système déjà en place chez l'utilisateur final, sur lequel l'app n'a aucune autorité
d'écriture (créer/modifier un contrat ou une fiche organisationnelle reste un acte
PGI/RH, pas applicatif).

Décision explicite de l'utilisateur : « il faut que l'application gère les workflow
mais les données doivent toujours venir d'ailleurs ».

## Options envisagées

- **Garder le CRUD interne tel quel** — simple, mais s'éloigne du modèle cible et
  laisserait croire que l'app est source de vérité sur des données qui ne le sont
  pas en prod (contrats, structure organisationnelle).
- **Intégrer directement un vrai connecteur SAP/LDAP dès maintenant** — prématuré en
  phase POC : pas d'accès à un système réel, et ça figerait une intégration avant
  que le contrat d'interface (quels champs, quelle pagination, quelle recherche)
  soit stabilisé par l'usage.
- **Pods mock dédiés simulant les systèmes externes + couche d'accès abstraite côté
  app, jamais déployés en prod** *(retenu)* — permet de valider le pattern
  d'intégration (cache, pagination, enrichissement croisé) sans dépendre d'un vrai
  SAP/LDAP, et de basculer vers le vrai système plus tard en ne changeant qu'une
  URL d'environnement.

## Décision

**L'app ne stocke que ce qu'elle gère réellement** : le circuit de validation
(`CommandeApprobation`), les droits et délégations (`ProfilAchat`,
`DelegationValidation`), les seuils d'approbation et référentiels de gouvernance
(`OrgUnitConfig`, `GovernanceConfig`), la gouvernance projet (`Activite` et ses
sous-ressources). Tout le reste (Contrat, ContratLot, Commande, DemandeAchat,
DemandeAchatLot, OrgUnit) est supprimé du schéma Prisma et lu depuis des services
externes via des pods Docker dédiés :

- `apps/pgi-mock` (port 4100) — simule un PGI type SAP : contrats, demandes
  d'achat, commandes. Commandes vides au démarrage, créées uniquement quand l'app
  valide une demande d'achat (`POST /commandes`).
- `apps/ldap-mock` (port 4102) — simule un LDAP/OIDC : arbre organisationnel
  (nom, niveau, parent, manager).

**Pattern « enveloppe workflow sur donnée externe »** : `DemandeAchatWorkflow`
référence une demande d'achat externe par `demandeAchatExternalId` et ne porte que
ce que l'app gère (périmètre, activité liée, statut de validation). L'absence
d'enveloppe pour un id externe signifie « non engagée » — il n'y a plus de statut
`BROUILLON` stocké.

**Pattern « config étendant une entité externe »** : `OrgUnitConfig` a pour clé
primaire l'id externe LDAP (pas de cuid propre) et ne porte que `seuilApprobation` —
la seule donnée que l'app possède sur un périmètre organisationnel.

**Abstraction réutilisable** (exigée explicitement pour rendre l'ajout d'un futur
pod mécanique) :
- `packages/mock-service-kit` — `createCollection()` (CRUD en mémoire),
  `paginate()` (recherche + filtres + pagination), `createMockService()`
  (scaffold Fastify + `/health`). Un pod = un seed + des routes appelant ces
  primitives.
- `apps/api/src/lib/external-client.ts` — `createExternalServiceClient()`,
  factory générique encapsulant le pattern cache Redis avec repli mémoire déjà
  utilisé par `feature-flags.ts`. `pgi-client.ts`/`ldap-client.ts` sont de fins
  wrappers typés au-dessus ; un futur pod (ex. référentiel Produit/taxonomie,
  délibérément hors périmètre ici) n'ajoute qu'un fichier `<nom>-client.ts`
  similaire.

Conséquence mécanique : Prisma ne peut plus `include` ces relations devenues
externes. Chaque route qui en a besoin fait l'appel `pgiClient`/`ldapClient` et
fusionne en mémoire (`orgUnitRef()`, `mergeWorkflow()`, etc.) plutôt qu'un `include`
Prisma.

Les deux pods ne tournent jamais en production : `PGI_API_URL`/`LDAP_API_URL` sont
vides par défaut et pointeraient vers les vrais systèmes le jour de l'intégration
réelle ; aucune dépendance vers ces pods dans le code ou le `Dockerfile` de
`apps/api`/`apps/web`, uniquement des variables d'environnement.

## Conséquences

- Le modèle Prisma reflète enfin ce que l'app possède réellement ; impossible de
  créer un contrat ou une fiche organisationnelle depuis l'UI (cohérent avec la
  réalité PGI/RH).
- Migration destructive nécessaire (DROP des anciennes tables Contrat/ContratLot/
  Commande/DemandeAchat/DemandeAchatLot/OrgUnit) — pas de chemin de migration de
  données pour les enveloppes de validation existantes (purgées), acceptable en
  phase POC sans donnée de production réelle.
- Ajouter un futur système externe (ex. référentiel Produit/taxonomie) est
  mécanique : un pod via `mock-service-kit`, un client via
  `createExternalServiceClient`, sans toucher au reste.
- Signal de réouverture : le jour d'une vraie intégration SAP/LDAP, cette ADR sert
  de référence pour le contrat d'interface attendu par `pgi-client.ts`/
  `ldap-client.ts` — si l'API réelle diverge significativement (pagination,
  filtres, formats de date), ouvrir une ADR de remplacement.
