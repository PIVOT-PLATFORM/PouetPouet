# Changelog

Toutes les versions notables de Pivot / PouetPouet sont listées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet respecte un [versionnage 0.x](docs/adr/0008-versioning-0x.md) (pas de bump majeur avant la `1.0.0` « exploitable »).

> Les notes de version **détaillées** (groupées par thème, orientées utilisateur) sont la source de vérité in-app : [`apps/api/src/lib/patch-notes.ts`](apps/api/src/lib/patch-notes.ts), affichées dans le panneau de notifications. Ce fichier en est l'index public condensé.

## [0.22.0] — 2026-06-25
Nouveau module **Roadmap** : planification visuelle façon Gantt (5 échelles, jalons, dépendances), drag & drop direct sur les barres pour ajuster les dates, filtres combinables par domaine/risque/priorité, export **PDF vectoriel** A4 paginé et export JSON. Partage par rôle (Lecteur / Éditeur / Owner).

## [0.21.0] — 2026-06-25
**Sessions plus longues et fiables.** Durée de session portée à **4 h** (une demi-journée) ; **renouvellement automatique et continu** tant que l'utilisateur est actif (y compris au retour de veille / focus d'onglet), avec **retry** sur échec réseau et le serveur seul juge de l'expiration. Corrige les déconnexions inopinées et la perte de page au rafraîchissement. Côté board : 2 requêtes Prisma redondantes supprimées (ouverture d'un board, partage par lien).

## [0.20.0] — 2026-06-23
Import d'**images** par coller/glisser-déposer et outil de **rognage** sur le board ; **aperçu automatique des liens** dans les tickets texte (image OG, titre, domaine) avec masquage de l'URL brute ; **droits éditeur** étendus (import/export/paramètres/partage) ; nouveau **logo hexagone** Pivot ; et une feature mystère accessible via la section Aide.

## [0.19.0] — 2026-06-20
Nombreux **correctifs board** (hitbox formes/traits, étiquettes, zoom, timer, feature flags) ; correction critique : l'animateur voit les résultats d'activité en temps réel ; lien d'invitation Scrum Poker avec bouton Copier.

## [0.18.0] — 2026-06-18
Cartes **lien** avec aperçu Open Graph (image, titre, nom du site) et **édition** de l'URL ; **image de couverture** de board par import de fichier.

## [0.17.0] — 2026-06-18
Nouveau module **Cahiers de tests** (sections, cas, statuts, progression), partage d'**équipes** par e-mail et de salles Scrum à une équipe, **retrait de participants** et **import Excel** dans Scrum Poker, **statistiques de Daily**, gestion des **activités en session**, et Hub aux **icônes** homogènes.

## [0.16.0] — 2026-06-17
Partage par rôles (Lecteur / Éditeur) des salles Scrum Poker et sessions Daily, sur le même modèle que les tableaux. *(Côté technique : migration Prisma 7 — cf. [ADR-0009](docs/adr/0009-migration-prisma-7.md).)*

## [0.15.1] — 2026-06-16
Corrections : collage Excel dans un tableau existant, alignement des champs des cahiers de tests, allègement des notifications.

## [0.15.0] — 2026-06-15
Feature flags : activation/désactivation et déploiement progressif des fonctionnalités sans redéploiement.

## [0.14.0] — 2026-06-14
Verrou d'édition fiabilisé & file d'estimation Scrum.

## [0.13.0] — 2026-06-13
Tableaux éditables, collage Excel & grille d'aimantation.

## [0.12.0] — 2026-06-12
Palettes de couleurs & hub repensé.

## [0.11.0] — 2026-06-12
Co-propriétaires, matrice des rôles & aide repensée.

## [0.10.0] — 2026-06-12
Collaboration board — retours de recette.

## [0.9.0] — 2026-06-12
Performance temps réel & accessibilité.

## [0.8.0] — 2026-06-12
Connexion SSO, journal de sécurité & fiabilité.

## [0.7.0] — 2026-06-12
Connexions inter-modules, webhooks & équipes.

## [0.6.0] — 2026-06-11
Curseurs temps réel, clés API, RGPD & sécurité.

## [0.5.0] — 2026-06-11
Pivot Équipes, Redis multi-instance & Hub unifié.

## [0.4.0] — 2026-06-11
Capacité, import Klaxoon complet, performances board & socle FORGE.

## [0.3.1] — 2026-06-05
Correctifs sessions & Scrum Poker.

## [0.3.0] — 2026-06-04
Couches, sessions, presse-papier inter-boards & améliorations.

## [0.2.1] — 2026-05-31
Corrections.

## [0.2.0] — 2026-05-31
Édition avancée & notifications.

## [0.1.0] — 2026-05-29
Première mise en ligne.
