# Base de connaissances — Pivot (suite collaborative)

## Présentation générale

Pivot est une suite collaborative auto-hébergée open-source (AGPL-3.0). Elle regroupe 8 modules complémentaires accessibles depuis le Hub. Toutes les données restent sur l'infrastructure de l'équipe — rien ne sort vers des services tiers.

---

## Navigation générale

- **Hub** (`/hub`) : page d'accueil, accès à tous les modules, ressources récentes
- **Profil** (`/profile`) : paramètres du compte, thème, notifications
- **Aide** (`/aide`) : cahiers de tests et guides utilisateur téléchargeables
- **Notifications** : cloche en haut à droite de la navbar — historique des invitations, partages, nouveautés
- **Patch-notes** : cliquer sur le numéro de version en bas du Hub pour voir les nouveautés

---

## Modules disponibles

### Boards collaboratifs (tableau blanc)

Tableau blanc temps réel multi-utilisateurs.

**Ce qu'on peut faire :**
- Créer des cartes texte, image, formes géométriques, dessins libres, libellés, nuage de mots
- Importer une image en la collant (Ctrl+V) ou en la glissant-déposant
- Rogner une image importée (clic sur l'image → outil de rognage)
- Aperçu automatique des liens URL dans les cartes texte (Open Graph)
- Relier des cartes (connexions droites, courbes ou orthogonales)
- Organiser les éléments sur 3 couches : fond, principal, avant-plan
- Créer des cadres pour regrouper et déplacer des blocs
- Travailler en groupe avec une couleur de contour partagée
- Importer depuis Klaxoon (.klx), PDF ou image
- Exporter le board en PDF, PNG ou Excel
- Copier-coller des éléments entre boards (Ctrl+C / Ctrl+V)
- Annuler / Rétablir (Ctrl+Z / Ctrl+Y)
- Lancer des votes sur des cartes
- Démarrer un timer
- Lancer une session live depuis le board

**Comment accéder :** Hub → "Boards" ou `/dashboard`

**Rôles sur un board :**
- Propriétaire : droits complets (gérer membres, supprimer, paramètres, partager, importer/exporter)
- Éditeur : créer/modifier/supprimer des cartes, animer votes et sessions, importer/exporter, partager
- Lecteur : consulter et exporter uniquement

**Partager un board :**
1. Ouvrir le board → menu "…" ou bouton "Partager"
2. Inviter par email (rôle Éditeur ou Lecteur) **ou** créer un lien de partage public
3. Le lien public donne au maximum le rôle Éditeur

---

### Sessions live

Animer des ateliers interactifs. Les participants n'ont pas besoin de compte.

**Ce qu'on peut faire :**
- Lancer depuis n'importe quel board (bouton "Session" dans la barre d'outils)
- Partager un code d'accès à 6 caractères ou un lien direct
- Activités disponibles : Quiz, Sondage, Nuage de mots, Brainstorming, Q&A
- Les membres authentifiés du board participent directement
- Reconnexion automatique après coupure réseau

**Comment rejoindre :** Aller sur `/session/[CODE]` ou scanner le QR code de l'animateur.

---

### Scrum Poker

Estimer des tickets d'équipe de façon anonyme.

**Ce qu'on peut faire :**
- Créer une salle avec un nom
- Choisir l'échelle : Fibonacci (1, 2, 3, 5, 8, 13…) ou Temps (0,5h, 1h, 2h…)
- Ajouter des tickets à estimer
- Voter → les participants votent sans voir les votes des autres
- Révéler tous les votes simultanément
- Recommencer pour le ticket suivant
- Inviter des participants anonymes (pas besoin de compte)
- Reconnexion automatique en cours de session

**Comment accéder :** Hub → "Scrum Poker" ou `/scrum`

**Lancer une salle :**
1. Aller sur `/scrum` → "Créer une salle"
2. Donner un nom → choisir l'échelle
3. Ajouter les tickets
4. Copier le lien d'invitation (bouton code en haut) et le partager

---

### Daily Standup

Animer les réunions de suivi quotidien.

**Ce qu'on peut faire :**
- Créer des équipes avec leurs membres
- Réordonner les membres par glisser-déposer
- Lancer un timer individuel par participant
- Voir le dépassement en rouge
- Mode "Passer" pour sauter un participant absent
- Consulter l'historique des sessions par équipe

**Comment accéder :** Hub → "Daily Standup" ou `/daily`

---

### La Roue

Tirage aléatoire pour désigner des volontaires ou distribuer des rôles.

**Ce qu'on peut faire :**
- Ajouter des participants à la roue
- Mode Équilibré : réduit la probabilité des personnes récemment tirées
- Mode Aléatoire pur : probabilité identique pour tous
- Exclure temporairement un membre
- Réinitialiser les probabilités en un clic
- Consulter l'historique des tirages

**Comment accéder :** Hub → "La Roue" ou `/wheel`

---

### Capacité d'équipe

Planifier et visualiser la capacité de l'équipe.

**Ce qu'on peut faire :**
- Créer des événements de capacité liés à une équipe
- Définir des points engagés et des points livrés
- Visualiser la vélocité de l'équipe sur plusieurs sprints
- Lier avec les estimations Scrum Poker si la salle est associée à une équipe

**Comment accéder :** Hub → "Capacité" ou via le profil d'équipe

---

### MeetOps

Gérer et animer des réunions avec agenda et compte-rendu.

**Ce qu'on peut faire :**
- Créer des réunions avec participants, ordre du jour et durée
- Générer un fichier .ics pour l'ajouter au calendrier
- Intégration optionnelle Microsoft Graph (Outlook + Teams)
- Consulter l'historique des réunions

**Comment accéder :** Hub → "MeetOps" ou `/meetops`

---

### Roadmap Gantt

Planification visuelle de projets sous forme de diagramme de Gantt interactif.

**Ce qu'on peut faire :**
- Créer des éléments de roadmap avec dates de début et de fin
- Choisir une catégorie (Produit, Tech, Design, Business, Autre) et une priorité (Must / Should / Could)
- Marquer un élément comme jalon (date unique → affiché en diamant ⬦)
- Visualiser sur 5 échelles de temps : Jour, Semaine, Mois, Trimestre, Année
- Déplacer ou redimensionner les barres par glisser-déposer
- Créer des dépendances visuelles entre éléments (flèches)
- Filtrer par catégorie, risque ou priorité "Must"
- Exporter la roadmap en PDF vectoriel (A4 paysage, paginé)
- Exporter / Importer en JSON
- Partager par rôle (Propriétaire / Éditeur / Lecteur)

**Comment accéder :** Hub → "Roadmap" ou `/roadmap`

**Créer une roadmap :**
1. Hub → "Roadmap" → "Nouvelle roadmap"
2. Donner un nom → ajouter des éléments via le bouton "+"
3. Renseigner titre, dates, catégorie, risque, priorité
4. Naviguer dans le Gantt avec les contrôles d'échelle en haut

---

### Équipes

Gérer les équipes de l'organisation et les partager avec d'autres membres.

**Ce qu'on peut faire :**
- Créer une équipe avec un nom et une couleur
- Ajouter des membres avec leur rôle (ex : dev, QA, PO) et leur FTE (disponibilité)
- Partager une équipe avec un autre compte (Éditeur ou Lecteur)
- Les équipes partagées apparaissent avec un badge de rôle

**Comment accéder :** Hub → "Équipes" ou `/equipes`

---

## Compte et profil

**Ce qu'on peut gérer depuis `/profile` :**
- Nom, bio, avatar
- Thème (clair / sombre)
- Palette de couleurs de l'interface
- Changement de mot de passe
- Notifications d'activité
- Suppression définitive du compte

**Inscription :** Par email avec vérification.

**Mot de passe oublié :** Page de login → "Mot de passe oublié" → un email est envoyé avec un lien de réinitialisation.

---

## Hub (tableau de bord)

Page d'accueil de la suite (`/hub`). Affiche :
- Tous les modules disponibles avec leurs icônes
- Les ressources récentes (boards, salles Scrum, roadmaps…)
- Les statistiques d'utilisation
- Le numéro de version (cliquer pour voir les nouveautés)

---

## Notifications

La cloche en haut à droite de la navbar affiche :
- Les invitations reçues sur des boards, roadmaps ou équipes
- Les nouveautés de l'application (patch-notes)

Cliquer sur une notification la marque comme lue et redirige vers la ressource concernée.

---

## Questions fréquentes

**Q : Faut-il un compte pour participer à une session live ou Scrum Poker ?**
Non. Les participants rejoignent via un lien ou un code à 6 caractères, sans créer de compte.

**Q : Comment partager un board avec quelqu'un ?**
Dans le board → bouton "Partager" → inviter par email (Éditeur ou Lecteur) ou créer un lien public.

**Q : Comment lancer un Scrum Poker ?**
`/scrum` → "Créer une salle" → ajouter les tickets → partager le lien d'invitation.

**Q : Comment créer une session live depuis un board ?**
Barre d'outils du board → bouton "Session" → choisir les activités → partager le code à 6 caractères.

**Q : Peut-on exporter un board ?**
Oui : export PDF, PNG ou Excel depuis le menu d'export du board (icône en haut à droite).

**Q : Comment importer une image sur un board ?**
Coller (Ctrl+V) une image copiée, ou glisser-déposer un fichier image directement sur le board.

**Q : Comment changer de thème clair/sombre ?**
`/profile` → section "Préférences" → choisir le thème.

**Q : Comment supprimer mon compte ?**
`/profile` → "Supprimer mon compte" en bas de page. L'action est irréversible.

**Q : Comment créer une roadmap Gantt ?**
Hub → "Roadmap" → "Nouvelle roadmap" → donner un nom → ajouter des éléments via le bouton "+".

**Q : Comment marquer un élément comme jalon dans la Roadmap ?**
Dans le formulaire d'édition d'un élément → cocher "Marquer comme jalon" (les dates début et fin deviennent identiques → affiché en ⬦ sur le Gantt).

**Q : Comment exporter la roadmap en PDF ?**
Dans la roadmap → bouton "Exporter" → choisir "PDF" (génère un PDF vectoriel A4 paysage paginé).

**Q : Comment déplacer une barre dans le Gantt ?**
Cliquer-glisser sur la barre pour la déplacer. Utiliser les poignées aux extrémités pour redimensionner (modifier les dates).

**Q : Comment partager une roadmap ou une équipe ?**
Ouvrir la roadmap ou l'équipe → bouton "Partager" → inviter par email avec le rôle souhaité (Éditeur ou Lecteur).

**Q : Quel module utiliser pour animer un atelier de priorisation ?**
Le Board collaboratif (tableau blanc) avec une session live. Lance la session depuis le board → activité "Sondage" ou "Brainstorming".

**Q : Quel module pour planifier un sprint ?**
Le module Capacité pour la charge de l'équipe, et Scrum Poker pour les estimations des tickets.

**Q : Quel module pour planifier des projets sur plusieurs mois ?**
Le module Roadmap (diagramme de Gantt interactif).

**Q : Je ne reçois pas l'email de vérification, que faire ?**
Vérifier le dossier spam. Si le problème persiste, contacter l'administrateur de l'instance.

**Q : Peut-on utiliser Pivot sans connexion internet ?**
Non, la suite nécessite une connexion au serveur Pivot de votre organisation.

---

## Astuces & bonnes pratiques

**Board :**
- Utilise les **cadres** (Frame) pour regrouper des blocs thématiques sur un board chargé — tu peux déplacer tout un cadre d'un coup.
- Le **nuage de mots** est idéal en début d'atelier pour collecter les idées de toute l'équipe en 2 minutes.
- L'**export Excel** du board exporte les cartes texte dans un tableur — pratique pour transformer un brainstorming en backlog.
- Tu peux **coller une image** directement depuis le presse-papiers (Ctrl+V) sans passer par un bouton d'import.

**Scrum Poker :**
- Lance la salle **avant la réunion** et partage le lien en avance — les participants peuvent rejoindre sans compte.
- Si l'équipe est souvent d'accord sur les mêmes valeurs, essaie l'échelle **Temps** plutôt que Fibonacci.

**La Roue :**
- En **mode Équilibré**, les personnes récemment tirées ont moins de chances d'être choisies à nouveau — idéal pour les équipes où les mêmes volontaires se portent toujours.
- Tu peux **exclure** un membre absent d'un simple clic sans le supprimer définitivement.

**Daily Standup :**
- Réordonne les membres par **glisser-déposer** avant le standup pour suivre l'ordre d'intervention habituel.
- Le timer individuel passe **en rouge** dès que le temps est dépassé — visible par tout le monde.

**Roadmap :**
- Utilise les **jalons** (diamonds ⬦) pour marquer les dates clés (livraison, démo, release) — ils apparaissent sur toutes les échelles de temps.
- L'export **JSON** te permet de sauvegarder ou de partager une roadmap hors ligne.

---

## Raccourcis clavier — Board

### Navigation & vue

| Raccourci | Action |
|---|---|
| **Espace** (maintenir) | Mode panoramique temporaire — déplacer la vue librement quel que soit l'outil actif |
| **Bouton milieu** (drag) | Panoramique de la vue |
| **Molette** | Zoom centré sur le curseur (min 10 %, max 300 %) |
| **Ctrl / Cmd + Molette** | Zoom rapide (pas ×12) |
| **Double-clic** (zone vide) | Créer une carte texte à l'emplacement du clic |

### Sélection

| Raccourci | Action |
|---|---|
| **Shift + Clic** ou **Ctrl/Cmd + Clic** | Ajouter / retirer la carte de la sélection (multi-sélection) |
| **Double-clic** sur une carte TEXT/LABEL | Passer en mode édition du contenu |

### Édition

| Raccourci | Action |
|---|---|
| **Ctrl+C / Cmd+C** | Copier les cartes sélectionnées dans le presse-papiers du board |
| **Ctrl+V / Cmd+V** | Coller les cartes copiées (à la position du curseur) ou coller une image depuis le système |
| **Ctrl+Z / Cmd+Z** | Annuler la dernière action |
| **Ctrl+Y / Cmd+Y** | Rétablir |

### Validation / Annulation

| Raccourci | Action |
|---|---|
| **Entrée** | Valider l'édition (champ texte, URL, titre de cadre, libellé de connexion) |
| **Échap** | Annuler l'édition en cours / fermer un popover / désélectionner une connexion |
| **Échap** (mode liaison) | 1ʳᵉ pression : désélectionner la carte source — 2ᵉ pression : quitter le mode liaison |

> En mode lecture seule, tous les raccourcis de modification sont désactivés.

---

## L'équipe qui a créé Pivot

Pivot est un projet open-source construit avec passion par une petite équipe :

- **Julien** — Chef
- **Valentine** — Personne importante
- **Maxime** — Développement et intégrations
- **Léo** — En vacances
- **Lélény** — contribution et support
- **Papi Alex** — Tiiiiiiiiiiiitiiiiiiiiii

Merci à tous ceux qui contribuent, testent et font évoluer la suite au quotidien.
