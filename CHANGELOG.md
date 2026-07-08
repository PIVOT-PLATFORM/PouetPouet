# Changelog

Toutes les versions notables de Pivot / PouetPouet sont listées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet respecte un [versionnage 0.x](docs/adr/0008-versioning-0x.md) (pas de bump majeur avant la `1.0.0` « exploitable »).

> Les notes de version **détaillées** (groupées par thème, orientées utilisateur) sont la source de vérité in-app : [`apps/api/src/lib/patch-notes.ts`](apps/api/src/lib/patch-notes.ts), affichées dans le panneau de notifications. Ce fichier en est l'index public condensé.

## [0.32.0] — 2026-07-09
**Import Klaxoon** revu : dépôt direct d'un fichier `.klx` (décompression, repérage des activités et conversion automatiques), fidélité de conversion nettement améliorée (tailles et positions réelles, zones → cadres, postits image, dessins au brush, formes et flèches), catégories/dimensions Klaxoon → champs personnalisés sur les cartes, annulation de l'import en un clic, placement anti-collision sous le contenu existant, liaisons en pointillés désormais détectées. **Confort des boards** : taille du texte proportionnelle à la carte (lisible quel que soit le zoom), redimensionnement d'une sélection multiple ou d'un groupe via un cadre englobant, dézoom dynamique adapté aux très grands boards, navigation au clic droit maintenu (comme le clic molette), badge « en cours d'édition » qui n'est plus rogné.

## [0.31.0] — 2026-07-06
Nouveau module **PI Planning** pour organiser un PI SAFe, construit par **composition des modules existants** (cf. [plan](docs/specs/pi-planning-plan.md)). Cycle avec itérations générées automatiquement (IT1…ITn + IP Sprint), équipes du Train (saisie ou import), partage par rôle (RTE propriétaire, Scrum Masters éditeurs). **Logistique** : formulaire (présence, hôtel, repas, allergies) créé en un clic dans les Formulaires et rattaché au PI. **Tâches de préparation** : tableau To-Do créé en un clic et rattaché. **Program board** multi-équipes : tickets typés (Feature, Milestone, Risque, Objectif, Story, Enabler) placés par équipe × itération en glisser-déposer, ligne Train, colonne Non planifié, dépendances en flèches vert/rouge avec note et détection des boucles. Au passage, features génériques : **Formulaires** — destinataires nommés avec lien personnel, invitations email, relances manuelles et automatiques paramétrables, export CSV à colonnes choisies ; **To-Do** — statuts En cours/Bloqué, vue Kanban, assignation multiple et filtre par membre.

## [0.30.0] — 2026-07-05
Nouveau module **To-Do** : listes de tâches personnelles ou partagées (Lecteur/Éditeur), mise en favori, tâches avec priorité, échéance et statut à faire / fait / **annulé** (exclu du calcul de complétion). **Tableaux de bord** combinant plusieurs listes en une vue consolidée — accès transitif via le partage du tableau de bord (même pattern que Portefeuille→Roadmap), rapports (complétion globale et par liste, répartition par priorité, tâches en retard, flux « récemment terminé »).

## [0.29.0] — 2026-07-04
Nouveau module **Innovation** : boîte à idées collaborative. Fiches innovation (pitch, problème/solution/bénéfices) publiques ou privées, votes, favoris, commentaires, pièces jointes, liens externes, image de couverture et bannière, tags multi-valeurs, rattachement organisationnel (LDAP ou hiérarchie interne). **Challenges** administrés avec éligibilité par périmètre, jurys et notation multi-critères pondérée, classement automatique et export CSV, désignation des lauréats. **Dashboard** de reporting (maturation des fiches, top idées, répartition par catégorie) et **gamification** (badges, classement des contributeurs). Cf. [ADR-0012](docs/adr/0012-innovation-referentiel-org-hybride.md) (référentiel organisationnel hybride) et [ADR-0013](docs/adr/0013-innovation-liaison-idee-projet.md) (liaison idée→projet, décision documentée, implémentation différée).

## [0.28.1] — 2026-07-02
**Feedback** : colonne « Refusé » ajoutée au kanban, colonnes en largeur flexible (les 6 tiennent dans la page), icône navbar d'origine restaurée. **Interface harmonisée** sur tous les modules : titres (taille/style/icône), boutons de création, chevrons à la place des flèches « ← », page Feature flags en pleine largeur sur 2 colonnes, fix du titre Scrum invisible en dark. **Commande publique** : 503 explicite quand le service externe (PGI/LDAP) est indisponible, bandeau d'erreur dans la page Organisation.

## [0.28.0] — 2026-07-02
Deux nouveaux modules de pilotage. **Portefeuille** : vue consolidée de plusieurs roadmaps sur une timeline unique, légende-filtre par roadmap, accès transitif en lecture aux roadmaps rattachées via le partage du portefeuille. **Commande publique** : demandes d'achat avec circuit de validation hiérarchique (seuils, délégations), gouvernance projet (jalons PMPG, risques, budget OPEX/CAPEX/APCO), données de référence lues depuis des services externes PGI/LDAP (pods mock en dev — cf. [ADR-0011](docs/adr/0011-commande-publique-pods-externes.md)). **Roadmap** renforcée : statut et responsable par item (avec filtres), validation serveur des dépendances (cycles, références mortes), export CSV. Divers : tests d'autorisation Capacité/MeetOps, pastille « nouvelle version » fiabilisée (suivi par version vue, #219), bumps sécurité des actions CI.

## [0.27.0] — 2026-07-02
Deux nouveaux modules. **Formulaires** type Google Forms : constructeur visuel (11 types de champs + sections), lien public sans compte, options de collecte (réponse unique, fermeture automatique, plafond), notifications et email de confirmation, vue résumé + réponses détaillées, partage par rôle. **Parcours** : workflows structurés — builder visuel de graphe d'étapes (formulaire, document, validation), instances suivies étape par étape avec historique, webhooks entrants. Corrections : relances/expirations SignDoc actives sans Redis (verrou Postgres), export RGPD réparé. Feedback accessible depuis la navbar.

## [0.26.0] — 2026-07-02
Nouveau module **SignDoc** : signature de documents auto-hébergée façon DocuSign. Atelier avec placement des champs par glisser-déposer, signataires internes et externes (lien email sécurisé sans compte), routage séquentiel ou parallèle, échéances avec relances automatiques, destinataires en copie. Preuve forte : document figé (SHA-256), journal d'événements à chaîne de hachage inviolable, **sceau numérique PAdES** + certificat de réalisation, endpoint de vérification. Divers : icônes de modules devant les titres de pages, outil Tableau toujours actif (flag retiré), panneau des flags limité aux modules.

## [0.25.0] — 2026-07-01
Nouveau module **Feedback** : kanban 5 colonnes (Analyse → Backlog → Implémentation → Parking → Fait) pour remonter bugs et idées. Création publique de tickets, votes en temps réel (Socket.io), édition par l'auteur ou l'admin, déplacement inter-colonnes et suppression réservés aux admins, mise en page plein écran.

## [0.24.0] — 2026-06-28
Nouveau module **PDF Manager** : bibliothèque centralisée de PDF avec dossiers (arborescence), tags, recherche et tri ; éditeur de pages (réordonnage DnD, rotation, extraction, split) ; fusion de documents ; exports variés (texte, images ZIP, DOCX/MD). Corrections **Capacité** : date de fin d'absence, erreurs API visibles, confirmations de suppression.

## [0.23.0] — 2026-06-27
**Quiz interactif** amélioré : séries de bonnes réponses (streak) avec bonus, timer adaptatif par question, jusqu'à 8 options de réponse, mode sans limite de temps, application en masse des réglages. **MeetOps** : vue calendrier complète.

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
