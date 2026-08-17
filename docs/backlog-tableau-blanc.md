# Tableau blanc collaboratif — Cartographie fonctionnelle & backlog de l'existant

> **Objet** : inventaire exhaustif des fonctionnalités du module tableau blanc (PouetPouet), structuré en backlog produit (Épics → Features → User Stories) pour réutilisation dans un autre contexte (chiffrage, réimplémentation, cahier des charges, import outil de gestion de backlog).
>
> **Méthode** : cartographie établie depuis le code source (modèle de données, API REST, événements temps réel, composants UI), croisée avec la documentation produit (FEATURES.md, cahiers de tests, notes de version).
>
> **État de référence** : version 0.32.2 (juillet 2026). Toutes les User Stories listées sont **livrées et en production**, sauf mention contraire (§ 11).

---

## Vue d'ensemble

Le module est un **tableau blanc collaboratif temps réel** : un canvas infini partagé où plusieurs participants manipulent simultanément des cartes (notes, images, liens, formes, dessins, tableaux), les organisent (groupes, cadres, connexions, champs personnalisés) et animent des ateliers (votes, timer, activités). 

**Chiffres structurants de l'existant :**

| Dimension | Valeur |
|---|---|
| Types de cartes | 7 (TEXT, LABEL, IMAGE, LINK, SHAPE, DRAW, TABLE) |
| Rôles d'accès | 4 niveaux effectifs : créateur (owner immuable), co-propriétaire (OWNER par partage), Éditeur, Lecteur |
| Types de champs personnalisés | 4 (Texte, Nombre, Date, Sélection à options) |
| Formes de connexions | 3 tracés (droit, courbe, orthogonal) × 4 modes de flèches |
| Formats d'import | Klaxoon .klx, PDF, images (JPG/PNG/GIF/WebP), archive native .ppb |
| Formats d'export | PDF, PNG, Excel .xlsx, archive native .ppb |
| Profondeur d'annulation | 30 pas (undo/redo) |
| Charge validée | curseurs temps réel throttlés pour 300+ participants |

**Concepts du modèle de données** (transposables tels quels) :
- **Board** : nom, description, image de couverture, participants max, activités activables, lien de partage (token + rôle du lien), propriétaire.
- **Card** : type, contenu, métadonnées (aperçu de lien), position/taille, couleur, groupe (+couleur de groupe), verrou, calque.
- **CardConnection** : source/cible, libellé, couleur, tracé, flèches, pointillés, épaisseur.
- **Frame** (cadre/zone) : titre, position/taille, couleur, mode actif, calque.
- **BoardField / CardFieldValue** : champs personnalisés au niveau board, valeurs par carte.
- **BoardShare** : partage par utilisateur avec rôle (dont co-propriété).
- **BoardVoteSession / BoardVote** : sessions de vote (quota par personne, votants éligibles, timer) et votes individuels.
- **BoardTemplate** : snapshot réutilisable (cartes + cadres + connexions + champs), avec brouillon d'édition.
- **BoardFavorite** : favoris par utilisateur.

---

## EP-01 — Gestion des boards

*Créer, retrouver, configurer et supprimer les tableaux.*

### F-01.1 Tableau de bord des boards
- **US-01.1.1** — En tant qu'utilisateur, je vois mes boards séparés en « Mes boards » et « Partagés avec moi », triés par date de mise à jour, afin de retrouver rapidement mes espaces de travail.
- **US-01.1.2** — En tant qu'utilisateur, je recherche un board par nom ou description.
- **US-01.1.3** — En tant qu'utilisateur, je marque un board en favori ; les favoris remontent en tête de liste.
- **US-01.1.4** — En tant qu'utilisateur, je vois sur chaque carte de board : l'image de couverture, le badge de mon rôle, le nombre de partages, la date, et le **nombre de participants actuellement connectés** (présence temps réel agrégée sur le dashboard).

### F-01.2 Cycle de vie d'un board
- **US-01.2.1** — En tant qu'utilisateur, je crée un board vierge (nom + description) via une modale.
- **US-01.2.2** — En tant qu'utilisateur, je crée un board **depuis un template** : cartes, cadres, connexions et champs personnalisés sont recopiés (avec remappage des identifiants).
- **US-01.2.3** — En tant que propriétaire, je renomme le board en ligne (inline) depuis l'éditeur.
- **US-01.2.4** — En tant que propriétaire, je supprime un board ; les membres partagés sont **notifiés** de la suppression.
- **US-01.2.5** — En tant que propriétaire, je réinitialise entièrement le board (double confirmation, opération atomique répercutée en direct chez tous les participants, **annulable via Ctrl+Z**).

### F-01.3 Paramètres du board
- **US-01.3.1** — En tant que propriétaire, je configure nom, description et **image de couverture** (URL ou upload ≤ 1,5 Mo).
- **US-01.3.2** — En tant que propriétaire, je fixe un **nombre maximum de participants**.
- **US-01.3.3** — En tant que propriétaire, j'active/désactive les fonctionnalités du board (votes, timer, champs personnalisés, dessin libre…) pour cadrer l'atelier.
- **US-01.3.4** — En tant que propriétaire, j'enregistre le board comme template depuis les paramètres.

---

## EP-02 — Canvas, navigation & productivité

*Se déplacer, viser juste, aller vite.*

### F-02.1 Navigation dans le canvas
- **US-02.1.1** — En tant qu'utilisateur, je zoome (boutons +/−, molette), j'affiche le % courant, je reviens à 100 %, et j'**ajuste la vue au contenu** (fit).
- **US-02.1.2** — En tant qu'utilisateur, je me déplace dans le board : outil main dédié, clic molette, clic droit, ou barre d'espace maintenue.
- **US-02.1.3** — En tant qu'utilisateur, les objets créés ont une **taille constante à l'écran quel que soit le zoom** (la taille de création s'adapte au niveau de zoom).
- **US-02.1.4** — En tant qu'utilisateur sur un très grand board, le dézoom s'adapte à l'étendue du contenu.

### F-02.2 Sélection & manipulation
- **US-02.2.1** — En tant qu'utilisateur, je sélectionne une carte au clic, plusieurs en additif (Shift/Ctrl), ou au **lasso**.
- **US-02.2.2** — En tant qu'utilisateur, je redimensionne une carte depuis n'importe quel bord ou coin (8 poignées).
- **US-02.2.3** — En tant qu'utilisateur, je redimensionne une **sélection multiple de façon homothétique** (cadre englobant avec poignées, disposition relative conservée).
- **US-02.2.4** — En tant qu'utilisateur, je déplace la sélection au pixel près avec les flèches (1 px, 20 px avec Shift).
- **US-02.2.5** — En tant qu'utilisateur, je duplique la sélection (Ctrl+D, copie décalée).
- **US-02.2.6** — En tant qu'utilisateur, la zone cliquable d'une forme, d'un trait ou d'un dessin épouse sa géométrie réelle (pas de « zone morte » rectangulaire).

### F-02.3 Aides au positionnement
- **US-02.3.1** — En tant qu'utilisateur, j'active une **grille d'aimantation** ; ma préférence est mémorisée.
- **US-02.3.2** — En tant qu'utilisateur, des **guides d'alignement** apparaissent pendant le déplacement pour m'aligner sur les autres cartes ; préférence mémorisée.

### F-02.4 Historique & raccourcis
- **US-02.4.1** — En tant qu'utilisateur, j'annule/rétablis mes 30 dernières actions (Ctrl+Z / Ctrl+Y) : déplacements, redimensionnements, création/suppression, couleurs, groupes, connexions, cadres, calques, verrous, et même le reset du board.
- **US-02.4.2** — En tant qu'utilisateur, je dispose de raccourcis : Ctrl+A (tout sélectionner), Ctrl+C/V (copier/coller), Ctrl+D (dupliquer), Suppr (supprimer), Échap (revenir à l'outil Sélection), V (sélection).
- **US-02.4.3** — En tant qu'utilisateur, un guide des raccourcis clavier est accessible depuis l'aide.

### F-02.5 Barre d'outils
- **US-02.5.1** — En tant qu'utilisateur, je dispose d'une barre d'outils **flottante, déplaçable et repliable**, avec indicateur d'outil actif.
- **US-02.5.2** — En tant qu'utilisateur, les pop-ups de paramétrage d'outil se ferment au clic extérieur ou au changement d'outil.

---

## EP-03 — Cartes & contenus

*Les 7 types d'objets posables sur le canvas et leur édition.*

### F-03.1 Notes & texte
- **US-03.1.1** — En tant qu'utilisateur, je crée des **notes adhésives** (TEXT) avec palette de couleurs (couleurs de base + personnalisées + récentes).
- **US-03.1.2** — En tant qu'utilisateur, je crée des **zones de texte / libellés** (LABEL) avec mise en forme riche : taille, gras, italique, souligné, barré, couleur, alignement.
- **US-03.1.3** — En tant qu'utilisateur, j'édite une carte en place au double-clic ; une carte que je viens de créer s'ouvre directement en édition.
- **US-03.1.4** — En tant qu'utilisateur, j'ouvre une modale de détail de carte : texte, formatage, couleur, et saisie des champs personnalisés.
- **US-03.1.5** — En tant qu'utilisateur, le texte reste proportionnel à la carte lors du redimensionnement.

### F-03.2 Images
- **US-03.2.1** — En tant qu'utilisateur, j'ajoute des images par import de fichier (multi-sélection), **collage presse-papiers**, ou **glisser-déposer** (JPG/PNG/GIF/WebP).

### F-03.3 Liens
- **US-03.3.1** — En tant qu'utilisateur, je crée une carte lien via un outil dédié avec popover de saisie d'URL ; l'URL reste éditable ensuite.
- **US-03.3.2** — En tant qu'utilisateur, la carte lien affiche automatiquement un **aperçu enrichi** (image, titre, nom du site) récupéré des métadonnées OpenGraph — également pour une URL collée dans une carte texte.
- (Contrainte technique associée : récupération côté serveur avec protection anti-SSRF — blocage des IP privées/loopback/link-local, redirections revalidées, corps plafonné à 100 Ko, timeout 5 s.)

### F-03.4 Formes & dessin
- **US-03.4.1** — En tant qu'utilisateur, je trace des **formes** : rectangle, cercle, losange, triangle, trait, étoile — avec épaisseur de trait (3 niveaux), remplissage activable, opacité de fond réglable, couleur ; rotation pour les traits.
- **US-03.4.2** — En tant qu'utilisateur, je **dessine à main levée** (couleur et épaisseur), fonctionnalité désactivable par le propriétaire dans les paramètres du board.

### F-03.5 Tableaux
- **US-03.5.1** — En tant qu'utilisateur, je crée des **tableaux éditables** : cellules modifiables, ajout/suppression de lignes et colonnes, ligne d'en-tête teintée.
- **US-03.5.2** — En tant qu'utilisateur, je **redimensionne les colonnes** par glissement.
- **US-03.5.3** — En tant qu'utilisateur, je **colle un tableau depuis Excel / Google Sheets / une table web** : création d'une carte tableau, ou remplissage du tableau sélectionné.

### F-03.6 Propriétés communes des cartes
- **US-03.6.1** — En tant qu'utilisateur, je recolore une carte ou toute la sélection d'un coup.
- **US-03.6.2** — En tant qu'utilisateur, je **verrouille/déverrouille** des cartes (y compris en masse) : une carte verrouillée ne bouge plus, même entraînée par un groupe. Les dessins ne sont pas verrouillables.
- **US-03.6.3** — En tant qu'utilisateur, je répartis les objets sur **3 calques** (arrière-plan / principal / avant-plan), par carte, par cadre ou pour toute la sélection.
- **US-03.6.4** — En tant qu'utilisateur, je copie/colle des cartes **entre deux boards différents** (presse-papiers persistant en session).

---

## EP-04 — Organisation visuelle

*Structurer le contenu : groupes, cadres, connexions, champs.*

### F-04.1 Groupes
- **US-04.1.1** — En tant qu'utilisateur, je groupe/dégroupe des cartes ; un groupe se déplace d'un bloc ; un groupe réduit à un seul membre se dissout automatiquement.
- **US-04.1.2** — En tant qu'utilisateur, j'attribue une **couleur de contour** à un groupe pour l'identifier visuellement.
- **US-04.1.3** — En tant qu'utilisateur, un **panneau « Groupes »** liste tous les groupes du board : survol = mise en évidence, actions de recoloration et suppression.

### F-04.2 Cadres (frames / zones)
- **US-04.2.1** — En tant qu'utilisateur, je crée des **cadres titrés et colorés** pour délimiter des zones du board (nombre maximum par board).
- **US-04.2.2** — En tant qu'utilisateur, je passe un cadre en mode **« actif »** : déplacer le cadre embarque les cartes qu'il contient.
- **US-04.2.3** — En tant qu'utilisateur, je déplace, redimensionne, renomme, recolore, supprime un cadre et change son calque.

### F-04.3 Connexions entre cartes
- **US-04.3.1** — En tant qu'utilisateur, je relie deux cartes via un mode « connecter » (anti-auto-lien, anti-doublon dans les deux sens) ; les flèches se **recalculent en temps réel** quand les cartes bougent (4 points d'ancrage).
- **US-04.3.2** — En tant qu'utilisateur, je personnalise chaque connexion : tracé (droit/courbe/orthogonal), flèches (aucune/début/fin/les deux), couleur, épaisseur, pointillés, **libellé**.
- **US-04.3.3** — En tant qu'utilisateur, je relie une carte à plusieurs autres en série (mode « relier » multiple).

### F-04.4 Champs personnalisés
- **US-04.4.1** — En tant qu'éditeur, je définis des **champs personnalisés au niveau du board** (Texte, Nombre, Date, Sélection à options), avec emoji et ordre d'affichage, via un panneau de gestion.
- **US-04.4.2** — En tant qu'utilisateur, je renseigne les valeurs de ces champs **carte par carte** (saisie dans la modale de détail), et je peux les effacer.

---

## EP-05 — Collaboration temps réel

*Plusieurs personnes, un seul état, zéro conflit visible.*

### F-05.1 Synchronisation d'état
- **US-05.1.1** — En tant que participant, toute modification (cartes, connexions, cadres, champs, valeurs) est répercutée **en direct** chez tous les participants du board.
- **US-05.1.2** — En tant que participant qui rejoint, je reçois l'**état complet** du board (contenus + rôle + verrous d'édition en cours + timer actif rejoué).
- **US-05.1.3** — En tant que participant, une **reconnexion automatique** restaure l'état après une coupure réseau.

### F-05.2 Présence & curseurs
- **US-05.2.1** — En tant que participant, je vois qui est connecté au board (liste, compteur, avatars) ; la présence est agrégée côté serveur (cache Redis, repli mémoire).
- **US-05.2.2** — En tant que participant, je vois les **curseurs des autres en temps réel** (nom + avatar), avec régulation de débit côté serveur (lots à 20 Hz) validée pour 300+ participants simultanés.

### F-05.3 Prévention des conflits
- **US-05.3.1** — En tant que participant, un badge « **Untel édite…** » s'affiche sur une carte en cours d'édition par quelqu'un d'autre (verrou doux éphémère, libéré au blur, à la sortie ou à la déconnexion).
- **US-05.3.2** — En tant que participant, le serveur applique un **contrôle d'accès sur chaque mutation** (écriture réservée Éditeur+, lecture seule stricte pour les Lecteurs).

### F-05.4 Timer d'atelier
- **US-05.4.1** — En tant qu'animateur, je lance un **timer partagé** visible de tous : présets 1–25 min ou durée personnalisée mm:ss ; arrêt manuel ; overlay de fin (fermeture locale par participant).
- **US-05.4.2** — En tant que participant, le décompte reste juste malgré le décalage d'horloge client/serveur, et le timer est rejoué à ceux qui arrivent en cours.

### F-05.5 Performance
- **US-05.5.1** — En tant que participant sur un gros board, seules les cartes **visibles dans le viewport** sont rendues (virtualisation du rendu).

---

## EP-06 — Votes & animation d'atelier

*Transformer le board en outil d'atelier facilité.*

### F-06.1 Sessions de vote
- **US-06.1.1** — En tant qu'animateur, je configure et lance une **session de vote** : nombre de voix par personne, liste des votants éligibles, timer optionnel. Lancer une session clôt automatiquement la précédente.
- **US-06.1.2** — En tant que votant éligible, je vote/dévote sur les cartes dans la limite de mon quota (quota garanti côté serveur en transaction sérialisable, timer et éligibilité contrôlés).
- **US-06.1.3** — En tant que participant, les **badges de votes** s'affichent en surimpression sur les cartes en temps réel.
- **US-06.1.4** — En tant qu'animateur, je **prolonge** le timer de vote (+1/+2/+5 min) ou je clôture manuellement.
- **US-06.1.5** — En tant que participant, je consulte le **panneau de résultats** et les résultats de la dernière session clôturée.

### F-06.2 Sessions live & activités
- **US-06.2.1** — En tant qu'animateur, j'anime des **sessions live** rattachées au board : code de session, participants **anonymes sans compte** ou membres authentifiés.
- **US-06.2.2** — En tant qu'animateur, je lance des **activités** (ex. nuage de mots avec regroupement des mots proches) : panneau côté hôte, overlay de réponse côté participant, gestion des membres/résultats/historique avec enregistrement manuel.

---

## EP-07 — Partage, rôles & sécurité d'accès

### F-07.1 Lien de partage public
- **US-07.1.1** — En tant que propriétaire, j'active un **lien de partage à token** avec un rôle attaché (Lecture ou Édition), je le copie, le régénère, change son rôle ou le désactive.
- **US-07.1.2** — En tant que destinataire du lien, je rejoins le board via une page dédiée ; un accès à ce rôle m'est créé automatiquement.

### F-07.2 Invitations & gestion des accès
- **US-07.2.1** — En tant que propriétaire, j'invite par email avec un rôle : Lecture, Édition ou **Propriétaire (co-propriété)**.
- **US-07.2.2** — En tant que gestionnaire, je change le rôle d'un membre ou révoque son accès ; l'intéressé est **notifié** (partage reçu, changement de rôle, révocation, suppression du board).
- **US-07.2.3** — Règles de gouvernance : un Éditeur peut gérer les partages mais **ne peut ni attribuer ni toucher un rôle Propriétaire** ; le créateur du board n'est **jamais rétrogradable** ; le reset du board est réservé au propriétaire.

### F-07.3 Rôles à l'usage
- **US-07.3.1** — En tant que Lecteur, je consulte le board en lecture seule stricte (toutes les actions d'édition masquées et refusées côté serveur) ; badge de rôle visible dans l'éditeur.

---

## EP-08 — Templates

### F-08.1 Cycle de vie des templates
- **US-08.1.1** — En tant qu'utilisateur, je crée un template **de zéro** ou en **snapshotant un board existant** (cartes + cadres + connexions + champs).
- **US-08.1.2** — En tant qu'utilisateur, je gère mes templates : liste (favoris en tête), favoris, renommage, suppression.
- **US-08.1.3** — En tant qu'utilisateur, j'**édite le contenu d'un template** via un board brouillon dédié (bannière « brouillon » : enregistrer dans le template ou abandonner).
- **US-08.1.4** — En tant qu'utilisateur, je choisis un template au moment de créer un board.

---

## EP-09 — Import / Export

### F-09.1 Import Klaxoon (.klx)
- **US-09.1.1** — En tant qu'utilisateur, j'importe une archive Klaxoon par **glisser-déposer ou sélection de fichier** (≤ 50 Mo, limité à 5 imports/min) ; si l'archive contient plusieurs tableaux, je choisis lequel importer.
- **US-09.1.2** — En tant qu'utilisateur, je vois un **aperçu chiffré avant import** (post-its, zones, textes, dessins, formes, images, liaisons, groupes, champs, éléments ignorés).
- **US-09.1.3** — Conversion fidèle : post-its→notes/images, textes→libellés (styles conservés), dessins→tracés, rectangles→formes, zones→cadres, liaisons→connexions, groupes préservés, **catégories/dimensions→champs personnalisés avec valeurs**, médias embarqués récupérés.
- **US-09.1.4** — En tant qu'utilisateur, l'import se place **sans chevaucher l'existant** (décalage anti-collision, ordre d'empilement et arrière-plans respectés).
- **US-09.1.5** — En tant qu'utilisateur, j'**annule un import** en un clic (suppression de tous les objets créés par cet import).
- **US-09.1.6** — L'import émet un événement d'intégration (`board.imported`) sur le bus inter-modules.

### F-09.2 Autres imports
- **US-09.2.1** — En tant qu'utilisateur, j'importe un **PDF** : une carte-image par page.
- **US-09.2.2** — En tant qu'utilisateur, j'importe des **images** (JPG/PNG/GIF/WebP).
- **US-09.2.3** — En tant qu'utilisateur, je réimporte une **archive native .ppb** (round-trip complet avec l'export).

### F-09.3 Exports
- **US-09.3.1** — En tant qu'utilisateur, j'exporte le board en **PDF** (board entier).
- **US-09.3.2** — En tant qu'utilisateur, j'exporte le board en **image PNG haute résolution**.
- **US-09.3.3** — En tant qu'utilisateur, j'exporte les données en **Excel** (cartes, liaisons, cadres).
- **US-09.3.4** — En tant qu'utilisateur, j'exporte une **archive native .ppb** (ZIP versionné : manifeste + contenu JSON + médias) réimportable à l'identique.
- **US-09.3.5** — En tant qu'utilisateur, mes boards sont inclus dans mon **export RGPD** (dump JSON de mes données).

---

## EP-10 — Socle technique transverse (exigences non fonctionnelles livrées)

*À reprendre comme exigences si le module est réimplémenté ailleurs.*

- **NFR-1 Sécurité des aperçus de liens** : fetch OpenGraph côté serveur durci anti-SSRF (IP privées/loopback/link-local/CGNAT bloquées en IPv4 et IPv6, redirections revalidées à chaque saut, corps ≤ 100 Ko, timeout 5 s).
- **NFR-2 Autorisation systématique** : chaque route REST et chaque événement socket revalide le rôle de l'appelant côté serveur (couvert par des tests d'autorisation dédiés).
- **NFR-3 Scalabilité temps réel** : adapter Redis pour Socket.io (multi-instance prêt), curseurs coalescés côté serveur (20 Hz), présence en cache Redis avec TTL et repli mémoire.
- **NFR-4 Performance de rendu** : virtualisation (rendu des seules cartes visibles), throttling des broadcasts, dézoom adaptatif.
- **NFR-5 Intégrité** : opérations critiques en transaction (reset de board, quotas de vote en isolation sérialisable), anti-doublon de connexions, garde de limite de cadres.
- **NFR-6 Robustesse client** : reconnexion socket avec restauration d'état, gestion du double montage React StrictMode (émission après `connect`), timer insensible au décalage d'horloge.
- **NFR-7 Limites d'abus** : import limité en taille (50 Mo) et en fréquence (5/min), upload de couverture ≤ 1,5 Mo.
- **NFR-8 Thème** : l'intégralité du module fonctionne en thème clair et sombre.

---

## 11. Ce qui N'EXISTE PAS à ce jour (backlog futur potentiel)

Recensé pour éviter toute sur-promesse en cas de réutilisation du backlog :

| Manque | Détail |
|---|---|
| Mode présentation / plein écran | Aucun mode de présentation ou parcours de cadres détecté |
| Partage à une équipe | Le board a son propre système de partage (lien + invitations individuelles), **sans** le partage d'équipe figé/dynamique dont bénéficient les autres modules de la suite |
| Import Excel/CSV | Annoncé « Bientôt » dans l'UI, désactivé |
| Lazy-loading > 500 éléments | Virtualisation du rendu faite, mais chargement initial complet (item de roadmap ouvert) |
| Commentaires / réactions sur cartes | Pas de fil de discussion ni d'émojis-réactions par carte |
| Historique / versions du board | Undo/redo en session uniquement ; pas de versionnage persistant ni de restauration à une date |
| Recherche dans le board | Recherche sur le dashboard uniquement, pas dans le contenu du canvas |
| Minimap | Pas de vue miniature de navigation |
| Export sélectif | Les exports portent sur le board entier (pas de « exporter la sélection / un cadre ») |
| Load test 100 VUs | Script k6 prêt, jamais exécuté contre un environnement représentatif |

---

## Annexe A — Matrice des rôles (synthèse)

| Action | Lecteur | Éditeur | Co-propriétaire | Créateur |
|---|:-:|:-:|:-:|:-:|
| Consulter, suivre curseurs/timer/votes | ✅ | ✅ | ✅ | ✅ |
| Voter (si éligible) | ✅ | ✅ | ✅ | ✅ |
| Créer/modifier/supprimer du contenu | ❌ | ✅ | ✅ | ✅ |
| Gérer les partages (hors rôles OWNER) | ❌ | ✅ | ✅ | ✅ |
| Attribuer/modifier un rôle Propriétaire | ❌ | ❌ | ✅ | ✅ |
| Renommer, paramètres, reset, suppression du board | ❌ | ❌ | ✅ | ✅ |
| Rétrograder le créateur | ❌ | ❌ | ❌ | ❌ (immuable) |

## Annexe B — Événements temps réel (contrat d'interface)

Familles d'événements socket (salle par board) : présence (`join/leave/presence`), curseurs (batch), cartes (create/move/resize/update/delete/recolor/lock/layer, verrou doux d'édition, meta OpenGraph), groupes (group/ungroup/couleur), connexions (create/update/delete), cadres (create/move/resize/update/delete/layer), champs (create/update/delete, valeurs set/clear), timer (start/stop, rejoué au join), votes (started/updated/closed), reset, import (`board:imported`).

## Annexe C — Traçabilité

| Épic | Sources de vérification |
|---|---|
| EP-01→09 | Code (API `apps/api/src/modules/pouetpouet/`, web `apps/web/src/components/board/`), FEATURES.md, cahier de tests boards v0.19.0 (21 catégories), notes de version 0.3.0 → 0.32.x |
| EP-10 | ADR-0004 (bus d'événements), ADR-0005 (permissions), ADR-0006 (adapter Redis), audits sécurité juillet 2026 (PRs #260-268) |
