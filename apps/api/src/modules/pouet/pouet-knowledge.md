# Base de connaissances — Pivot (suite collaborative)

## Présentation générale

Pivot est une suite collaborative auto-hébergée. Elle regroupe plusieurs modules complémentaires accessibles depuis le Hub. Toutes les données restent sur l'infrastructure de l'équipe.

---

## Modules disponibles

### Boards collaboratifs (tableau blanc)

Le module principal : un tableau blanc temps réel où plusieurs personnes travaillent ensemble.

**Ce qu'on peut faire :**
- Créer des cartes texte, image, formes géométriques, dessins libres, libellés
- Relier des cartes entre elles (connexions droites, courbes ou orthogonales)
- Organiser les éléments sur 3 couches : fond, principal, avant-plan
- Créer des cadres pour regrouper et déplacer des blocs d'éléments
- Travailler en groupe avec une couleur de contour partagée
- Importer depuis Klaxoon (.klx), PDF ou image
- Exporter le board en PDF, PNG ou Excel
- Copier-coller des éléments entre boards
- Annuler / Rétablir (Ctrl+Z / Ctrl+Y)
- Lancer des votes sur des cartes
- Démarrer un timer
- Lancer une session live depuis le board

**Comment accéder :** Menu Hub → "Boards" ou lien direct `/dashboard`

**Rôles sur un board :**
- Propriétaire : droits complets (gérer les membres, supprimer, partager)
- Éditeur : créer/modifier/supprimer des cartes, animer des votes et sessions
- Lecteur : consulter et exporter uniquement

**Lien de partage :** Le propriétaire peut créer un lien public qui donne au maximum le rôle Éditeur.

---

### Sessions live

Animer des ateliers interactifs avec des équipes, sans que les participants aient besoin d'un compte.

**Ce qu'on peut faire :**
- Lancer une session depuis n'importe quel board (bouton "Session" dans la barre d'outils)
- Partager un code d'accès à 6 caractères ou un lien direct
- Proposer des activités : Quiz, Sondage, Nuage de mots, Brainstorming, Q&A
- Les membres authentifiés du board participent directement
- Reconnexion automatique après coupure réseau

**Comment rejoindre une session :** Aller sur `/session/[CODE]` ou scanner le QR code affiché par l'animateur.

---

### Scrum Poker

Estimer des tickets d'équipe de façon anonyme, puis révéler tous les votes simultanément.

**Ce qu'on peut faire :**
- Créer une salle avec un nom
- Choisir l'échelle : Fibonacci (1, 2, 3, 5, 8, 13…) ou Temps (0,5h, 1h, 2h…)
- Ajouter des tickets à estimer
- Lancer un vote → les participants votent sans voir les votes des autres
- Révéler tous les votes en même temps
- Recommencer pour le ticket suivant
- Inviter des participants anonymes (lien ou code de la salle)
- Reconnexion automatique en cours de session

**Comment accéder :** Hub → "Scrum Poker" ou `/scrum`

**Inviter quelqu'un :** Copier le lien d'invitation depuis le bouton code en haut de la salle. Les participants peuvent rejoindre sans compte.

---

### Daily Standup

Animer les réunions de suivi quotidien avec un timer par participant.

**Ce qu'on peut faire :**
- Créer des équipes avec leurs membres
- Réordonner les membres
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

### Capacité

Planifier et visualiser la capacité de l'équipe sur un sprint ou une période.

**Ce qu'on peut faire :**
- Créer des événements de capacité liés à une équipe
- Définir des points engagés et des points livrés
- Visualiser la vélocité de l'équipe
- Lier automatiquement avec les estimations Scrum Poker si la salle est associée à une équipe

**Comment accéder :** Hub → "Capacité" ou via le profil d'équipe

---

### MeetOps

Gérer et animer des réunions avec agenda, compte-rendu et intégration calendrier.

**Ce qu'on peut faire :**
- Créer des réunions avec participants, ordre du jour et durée
- Générer un fichier .ics pour l'ajouter au calendrier
- Intégration optionnelle Microsoft Graph (Outlook + Teams)
- Consulter l'historique des réunions

**Comment accéder :** Hub → "MeetOps" ou `/meetops`

---

## Compte et profil

**Ce qu'on peut gérer depuis `/profile` :**
- Nom, bio, avatar
- Thème (clair / sombre)
- Palette de couleurs de l'interface
- Réinitialisation du mot de passe
- Notifications d'activité
- Suppression définitive du compte

**Inscription :** Par email avec vérification. Si le mode bypass est activé par l'admin, l'email de vérification est optionnel.

**Réinitialisation de mot de passe :** Depuis la page de login → "Mot de passe oublié" → email envoyé.

---

## Hub (tableau de bord)

Page d'accueil de la suite (`/hub`). Affiche tous les modules disponibles et les ressources récentes (boards, salles Scrum, etc.).

---

## Questions fréquentes

**Q : Faut-il un compte pour participer à une session live ou Scrum Poker ?**
Non. Les participants peuvent rejoindre via le lien ou le code sans créer de compte.

**Q : Comment partager un board avec quelqu'un ?**
Dans le board → bouton "Partager" → inviter par email (rôle Éditeur ou Lecteur) ou créer un lien de partage.

**Q : Comment lancer un atelier Scrum Poker ?**
Aller sur `/scrum` → "Créer une salle" → ajouter les tickets → "Voter →" → partager le lien d'invitation.

**Q : Comment créer une session live depuis un board ?**
Dans la barre d'outils du board → bouton "Session" → choisir les activités → partager le code.

**Q : Peut-on exporter le contenu d'un board ?**
Oui : export PDF, PNG ou Excel depuis le menu d'export du board.

**Q : Comment changer de thème (clair/sombre) ?**
Aller dans `/profile` → section "Préférences" → choisir le thème.

**Q : Comment supprimer son compte ?**
Aller dans `/profile` → "Supprimer mon compte" en bas de page.
