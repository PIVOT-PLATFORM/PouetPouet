# PouetPouet — Guide des fonctionnalités

Tour d'horizon de tout ce qu'on peut faire avec PouetPouet. Ce guide suit le flux d'un utilisateur, depuis l'inscription jusqu'aux animations de session avancées.

---

## 1. Compte utilisateur

### Inscription / connexion
- Création de compte avec **email + nom + mot de passe** (8 caractères min).
- **Vérification de l'email** à l'inscription : un lien est envoyé par email ; la connexion est bloquée tant que l'adresse n'est pas confirmée.
- Connexion via email / mot de passe.
- **Mot de passe oublié** : lien "Mot de passe oublié" sur la page de connexion → email de réinitialisation envoyé ; le lien expire après usage.
- Le token JWT est conservé en `localStorage`. Les pages sous `(app)/` redirigent vers `/login` si pas de token.

### Profil
- Modifier son **nom**, sa **bio** (500 caractères max) et son **thème** (clair / sombre, appliqué globalement).
- Uploader un **avatar** (base64 ≤ 2 Mo).
- Changer son **mot de passe** (vérification du mot de passe actuel).
- **Supprimer son compte** définitivement (confirmation par mot de passe).

---

## 2. Tableau de bord — "Mes boards"

C'est la page d'accueil après login. Trois sections empilées :

- **Mes boards** — ceux dont tu es propriétaire
- **Partagés avec moi** — boards où on t'a invité (rôle VIEWER ou EDITOR)
- **Mes templates** — modèles réutilisables

### Création d'un board
Bouton **"Nouveau board"** → modal avec :
- **Nom** (obligatoire)
- **Description** (optionnelle)
- **Template** — choisis "Vierge" ou un de tes templates pour pré-remplir le contenu
- **Options avancées** (collapsible) :
  - **Image de couverture** (URL) qui remplace l'icône
  - **Nombre max de participants**
  - **Activités disponibles** : Vote, Timer, Dessin, Cadres, Champs

### Carte board
Chaque board affiche :
- Icône gradient (déterministe d'après l'id) ou cover image
- Nom + description
- **⭐ Favori** — clic pour épingler en tête de liste (tri client-side immédiat)
- **🗑️ Corbeille** — supprimer (OWNER uniquement)
- Indicateur de **présence live** (nombre de personnes connectées en temps réel)
- Icône **partage** si le board est partagé
- Badge de rôle si partagé avec toi (Lecture / Éditeur)
- Date de dernière modification + badge "Board"

### Recherche
Champ de recherche en haut → filtre par nom ou description.

---

## 3. Éditeur de board

### Toolbar haute (de gauche à droite)

| Cluster | Contenu |
|---|---|
| Identité | Retour dashboard · **Titre du board** (cliquable pour renommer inline, OWNER uniquement) · Présence (avatars + dropdown au survol) · Badge de rôle |
| Import / Export (OWNER) | **Importer** (Klaxoon .klx, PDF, image) · **Exporter** (PDF, PNG, Excel, .ppb) · **Partager** · **⚙️ Paramètres** |
| Historique | Undo (Ctrl+Z) · Redo (Ctrl+Y) · **Reset** (double-clic pour confirmer) |
| Activités | **Vote** (menu déroulant) · **Timer** (préréglages 1-25 min ou saisie libre) |
| Session | **Session** (lance une session live avec code) |
| Overflow | **Groupes** · **Champs** (menu déroulant) |

Les menus déroulants (Vote, Timer, Overflow) sont **mutuellement exclusifs** : ouvrir l'un ferme automatiquement les autres. **Échap** ferme tous les menus et panneaux ouverts.

### Renommer le board
Clique sur le **titre** dans la toolbar (OWNER uniquement) → champ texte ; Entrée ou blur valide, Échap annule.

### Toolbar latérale flottante (drag & drop)
À gauche du canvas, draggable :
- **Sélection** (curseur)
- **Pan** — déplacer le canvas (équivalent clic molette)
- **Texte** — créer une zone de texte
- **Post-it** — choix de couleurs pastel, flyout couleur
- **Formes** — rectangle, cercle, losange, triangle, étoile, trait ; flyout avec sélecteur de forme, couleur, épaisseur, remplissage et opacité
- **Cadre** — ajouter un cadre directement depuis la toolbar
- **Dessin libre** — stylo avec choix de couleur / épaisseur
- **Lien** — créer une carte LINK
- **Connecter** — relier deux cartes par une flèche

**Changer d'outil déselectionne automatiquement** les cartes et fait disparaître la barre de sélection. Modifier la couleur ou l'épaisseur au sein du même outil ne déselectionne pas.

### Cartes
Chaque carte peut être :
- **Déplacée** par drag (sauf si verrouillée)
- **Redimensionnée** via les poignées sur les 8 directions (sauf si verrouillée)
- **Éditée** en cliquant sur son texte (double-clic pour les cartes TEXT)
- **Recoloriée** depuis la sélection
- **Verrouillée** : icône cadenas → bouge plus, mais peut toujours être éditée/copiée/supprimée. Indicateur visuel : fin liseré gris autour
- **Groupée** avec d'autres cartes (sélection multiple → bouton Grouper) → contour coloré commun (couleur personnalisable), déplacement solidaire ; dissolution automatique si le groupe se réduit à un seul objet
- **Connectée** à d'autres cartes via le mode "Connecter"
- **Supprimée** (touche `Suppr` ou bouton corbeille)
- **Copiée/collée** inter-boards (Ctrl+C / Ctrl+V) : le presse-papier est stocké localement et fonctionne entre différents boards du même compte ; layers et groupes sont préservés ; comportement one-shot (le presse-papier se vide après collage)
- Ouverte en **détail** (panneau latéral) pour éditer le contenu long, la mise en forme et les champs personnalisés
- Assignée à une **couche** (layer) : fond, principal, avant-plan (voir ci-dessous)

### Couches (layers)
Chaque objet appartient à l'une des 3 couches :
- **Fond** — passe sous tous les autres objets
- **Principal** — couche par défaut
- **Avant-plan** — passe au-dessus de tout

Le changement de couche se fait depuis le menu contextuel ou la barre de sélection. Les couches permettent de superposer formes et cartes sans qu'elles ne s'emmêlent.

### Import / Export

**Import :**
- **Klaxoon (.klx)** — importe cartes, post-its, formes et textes depuis une archive Klaxoon
- **PDF** — chaque page devient une carte IMAGE
- **Image** — drag-and-drop ou import depuis le menu ; la carte IMAGE est redimensionnable
- **Coller une image ou du texte** (Ctrl+V système) pour créer une carte instantanément

**Export :**
- **PDF** — tout le board sur une seule page
- **PNG** — capture fidèle du canvas
- **Excel (.xlsx)** — tableau avec toutes les cartes et leurs champs personnalisés
- **Archive PouetPouet (.ppb)** — sauvegarde complète réimportable

### Sélection multiple
- Drag depuis le vide → rectangle de sélection (mode sélection actif)
- Maj+clic pour ajouter/retirer une carte
- Quand plusieurs cartes sont sélectionnées, une barre contextuelle apparaît avec :
  - Nombre d'éléments sélectionnés
  - 7 pastilles de **couleur** pour tout recolorier d'un coup
  - **Verrouiller / Déverrouiller** la sélection
  - **Grouper / Dégrouper**
  - **Copier**, **Supprimer**

### Cadres (frames)
- Bouton "Cadre" → ajoute un cadre 400×300 au centre
- Drag pour déplacer, poignées pour redimensionner
- Titre éditable inline
- Couleur personnalisable
- Les cartes posées dans un cadre se déplacent solidairement avec lui

### Connexions
- Mode "Connecter" : clic sur la carte source, puis sur la carte cible → flèche
- Les flèches se recalculent en temps réel quand on déplace les cartes
- Clic sur une connexion → bouton supprimer

### Dessin libre
- Mode "Dessin" : tracé à la souris devient une carte de type DRAW (SVG path)
- Choix de couleur, épaisseur (fin / moyen / épais), opacité

### Champs personnalisés (Champs)
- Définir des champs au niveau du board : nom, emoji, type (Texte / Nombre / Date / Sélection avec options)
- Les champs apparaissent sur chaque carte dans le panneau de détail
- Accessible depuis le menu Overflow · Champs

### Panneau des groupes
- Accessible depuis le menu Overflow · Groupes (ou au survol du bouton)
- Liste tous les groupes avec le nombre de cartes
- Clic sur un groupe → **surbrillance** : les cartes hors-groupe sont estompées, les liaisons externes atténuées
- Couleur de contour personnalisable par groupe
- Suppression d'un groupe depuis le panneau (les cartes restent)
- Se fixe quand un groupe est en surbrillance, Échap pour quitter

### Pan & zoom
- **Clic molette + glisser** (ou clic droit) → naviguer dans le canvas
- Les cartes ne bougent pas pendant le pan, même au-dessus d'un élément
- Indicateur de zoom en bas à droite avec boutons + / − et reset

### Undo / Redo
- 30 niveaux d'historique côté client
- Restauration des actions : création, déplacement, redimensionnement, recoloration, suppression, groupage…

### Reset board
- Bouton "Reset" → premier clic affiche "Confirmer ?" en rouge → deuxième clic supprime toutes les cartes/cadres/connexions du board
- L'historique est vidé après reset

### Partage du board (OWNER)
Modal "Partager" :
- **Lien de partage** activable, régénérable, désactivable
  - Choix du rôle attribué via le lien : VIEWER (Lecture) ou EDITOR (Éditeur)
- **Invitations par email** — saisir l'email d'un compte existant, choisir le rôle
- **Liste des membres** avec leur rôle, modification ou révocation

### Paramètres du board (OWNER)
Modal "⚙️ Paramètres" — modifie :
- Nom, description
- Image de couverture (URL)
- Nombre max de participants
- Activités disponibles (toggle Vote / Timer / Dessin / Cadres / Champs)
- **Bouton "Enregistrer comme template"** — snapshot du contenu actuel dans un nouveau template

### Rôles
- **OWNER** — droits complets, peut partager, supprimer, modifier les settings
- **EDITOR** — peut créer/modifier/supprimer tout le contenu, lancer vote/timer/session
- **VIEWER** — lecture seule, voit le contenu en temps réel, peut voter si invité, ne peut rien modifier

### Présence
- Avatars empilés des personnes connectées + compteur N/total
- Survol → liste détaillée (membres en ligne vs hors ligne)
- Mis à jour en temps réel via Socket.io (`board:presence`)

---

## 4. Vote sur cartes

### Configuration
Bouton **Vote** dans la toolbar → modal :
- **Nombre de votes par personne** (1–10)
- **Liste des votants** (cocher parmi les membres du board)
- **Timer optionnel** (durée en secondes)

### Pendant le vote
- Bandeau coloré dans la toolbar avec **timer en MM:SS** (violet → orange ≤30s → rouge ≤10s)
- Chaque carte affiche un compteur de votes en haut
- Boutons **+** et **−** sur chaque carte pour voter / annuler (votants éligibles seulement)
- Compteur "votes restants" à droite du nom
- **OWNER** : boutons **+1m / +2m / +5m** pour rallonger le timer
- **Bouton "Résultats"** ouvre le panneau de résultats en direct

### Fin de vote
Quand le timer expire :
- **Écran de fin** (overlay) avec compte à rebours de 15s avant bascule
- Bascule automatique vers le panneau de résultats

### Panneau de résultats
- Cartes triées par nombre de votes
- Top 3 mis en avant
- Compte total des votes
- "Terminer le vote" (OWNER uniquement — désactivé avec tooltip pour les autres)
- Consultable plus tard via le bouton **"Dernier vote"** dans la toolbar

---

## 5. Timer synchronisé

- Survol du bouton **Timer** → menu déroulant
- **Durée personnalisée** (mm:ss) ou **raccourcis** : 1, 2, 3, 5, 10, 15, 20, 25 minutes
- Le timer est synchronisé entre tous les participants via Socket.io
- Overlay plein écran les 5 dernières secondes
- Couleurs progressives (indigo → orange ≤30s → rouge ≤10s)
- Bouton ✕ pour arrêter (OWNER / EDITOR)

---

## 6. Templates

### Vue d'ensemble
Les templates sont des **modèles de boards réutilisables**, propres à chaque utilisateur. Ils apparaissent dans la section "Mes templates" du dashboard, **visuellement identiques aux boards** (icône, étoile favori, corbeille).

### Créer un template

Deux manières :

1. **Depuis le dashboard** — bouton "Nouveau template" → choisir un board source pour snapshot, ou template vierge
2. **Depuis un board** — Paramètres du board → "Enregistrer comme template" → le contenu actuel (cartes, cadres, champs, connexions) est snapshotté

### Modifier le contenu d'un template

**Click sur la carte template** → ouvre un **brouillon éditable** (un board temporaire caché de la liste "Mes boards") pré-rempli avec le contenu du template.

- Bandeau ambre en haut du board : "Mode édition de template — les modifications doivent être enregistrées explicitement"
- Deux boutons :
  - **Enregistrer le template** — snapshot le brouillon vers le template, supprime le brouillon, retour dashboard
  - **Annuler** — supprime le brouillon, retour dashboard sans toucher au template
- Si tu fermes l'onglet sans valider, le brouillon est conservé : un nouveau clic "Modifier le contenu" te ramène dessus (pas de doublon)

### Modifier les infos d'un template
Toutes les autres propriétés (nom, description, image, max participants, activités) se modifient via le **settings modal du board en mode brouillon** — exactement comme pour un board normal.

### Utiliser un template
Lors de la création d'un nouveau board, sélectionne le template dans la liste : son contenu est copié, et les métadonnées (description, cover, max, activités) sont pré-remplies (modifiables).

### Favoris
Étoile sur la carte template → remontée immédiate en tête de liste (tri client-side et serveur).

### Supprimer un template
Bouton corbeille avec confirmation. Si un brouillon non sauvegardé existe, il devient un board orphelin (la FK est soft).

---

## 7. Sessions live (animations type Klaxoon)

L'animateur peut lancer une **session live** sur un board pour interagir avec des participants — invités anonymes ou membres authentifiés du board.

### Côté animateur (hôte)
- Bouton **Session** dans la toolbar → la session démarre, un code à 6 caractères s'affiche en vert
- **Panneau d'hôte** (HostPanel) qui apparaît sur le côté droit avec :
  - **Compteur de participants** connectés en temps réel
  - **Activity Launcher** pour lancer une animation
  - **Activity Results** une fois l'activité fermée
- L'hôte se **reconnecte automatiquement** à sa session active après un rafraîchissement de page ou une perte réseau (via localStorage).

### Activités disponibles
- **QUIZ** — questions à choix multiples
- **POLL** — sondages
- **WORDCLOUD** — nuage de mots
- **BRAINSTORM** — collecte d'idées
- **QA** — questions/réponses libres

### Côté participant
Deux modes de participation :

**Invité anonyme** — via URL `/session/<code>` :
- Saisie d'un nom (aucun compte requis)
- Reçoit en temps réel l'activité lancée par l'hôte
- Se reconnecte automatiquement après un rafraîchissement de page (sessionStorage)
- Écran "Session terminée" quand l'hôte clôture

**Membre authentifié du board** :
- Si une session est active sur un board auquel l'utilisateur a accès, un badge de code apparaît dans la navbar du board
- L'utilisateur rejoint automatiquement la session sans quitter le board
- L'overlay d'activité s'affiche directement sur le canvas
- Reconnexion automatique après refresh ou perte réseau

### Sécurité
- Seul le propriétaire du board peut créer/clôturer une session et lancer/fermer des activités (vérifié côté HTTP et socket).

### Cycle de vie
- Session `OPEN` → activité `ACTIVE` (au lancement) → activité `CLOSED` → session `CLOSED` (clôture par l'hôte)
- Une seule activité active à la fois ; les nouveaux participants reçoivent l'activité courante au join

---

## 8. Scrum Poker

Module d'estimation collaborative pour les sprints.

### Hôte
- Crée une **room** avec un nom et une **échelle** :
  - **Story Points (Fibonacci)** : `1, 2, 3, 5, 8, 13, 21, ?, ☕`
  - **Temps** : `0.5h, 1h, 2h, 4h, 6h, 8h, 1j, 2j, ?, ☕`
- Code à 6 caractères pour rejoindre
- **Tickets** ajoutés à la room (unitairement ou en masse) avec titre et statut (PENDING / VOTING / REVEALED / DONE)
- Workflow par ticket : démarrer le vote → reveal → fixer l'estimation → ticket suivant
- Historique des votes et estimation par ticket
- Changement d'échelle en cours de session (les votes en cours sont réinitialisés)
- Se **reconnecte automatiquement** à sa room après un rafraîchissement ou une perte réseau

### Participants
- Rejoignent via URL ou code, avec un nom (pas besoin de compte)
- Voient le ticket courant et votent en cliquant sur leur carte
- Reconnexion automatique après rafraîchissement (sessionStorage)
- Une fois reveal lancé, voient toutes les cartes retournées avec les noms

---

## 9. Daily standup

Pour animer les daily meetings avec timer par personne.

### Équipes (Mes équipes)
- Créer/modifier des **équipes persistées** : nom, couleur, description, liste de membres ordonnée
- Réutilisables d'une session à l'autre

### Sessions de daily
- Sélectionne une équipe (ou crée des participants ad-hoc)
- Définis le **temps par personne** (défaut 120s)
- États : `PENDING` → `RUNNING` (au start) → `DONE`
- Pendant le run :
  - Une personne **parle** à la fois (statut `SPEAKING`)
  - **Suivant** ou **Skip** pour passer au prochain
  - Timer par personne, affiché en temps réel
  - Statuts par participant : `WAITING` / `SPEAKING` / `DONE` / `SKIPPED`

---

## 10. Roue aléatoire (La roue)

Tirage au sort pondéré avec mémoire des passages.

### Principe
- Définis un **pool** (équipe persistée ou liste ad-hoc)
- Choisis le **nombre** de personnes à tirer
- **Mode pondéré** (par défaut) ou **aléatoire pur**
- Possibilité d'**exclure** certaines personnes du tirage

### Pondération
Les personnes tirées récemment ont moins de chances d'être retirées : `poids = 1 / (score_récent + 1)`. Au fil des sessions, la roue tend à équilibrer les passages. Personne n'est jamais éliminé du pool.

### Historique
- Chaque tirage est enregistré (`WheelDraw`) avec date, équipe, mode, résultats
- Possibilité de grouper plusieurs tirages dans un **événement** (`WheelEvent`) pour les retrouver ensemble

---

## 11. Raccourcis clavier

| Raccourci | Action |
|---|---|
| `Ctrl+Z` | Annuler (création, déplacement, redimensionnement, recoloriage, suppression, groupe, couleur de groupe, verrouillage) |
| `Ctrl+Y` | Rétablir |
| `Ctrl+C` | Copier la sélection (stocké en local, utilisable sur d'autres boards) |
| `Ctrl+V` | Coller depuis le presse-papier board (one-shot) ou depuis le presse-papier système |
| `Ctrl+A` | Sélectionner toutes les cartes |
| `Ctrl+D` | Dupliquer la sélection |
| `Suppr` / `Backspace` | Supprimer la sélection |
| `Échap` | Revenir en mode sélection · désélectionner · fermer tous les menus et panneaux ouverts |
| `V` | Revenir en mode sélection |
| `Entrée` | Valider l'édition d'un titre |
| Flèches | Déplacer la sélection de 1 px (+ Maj = 20 px) |
| Clic molette + drag | Pan du canvas |
| Maj + clic | Ajouter/retirer une carte de la sélection |

---

## 12. Indicateurs visuels et états

- **Liseré gris fin** autour d'une carte = verrouillée
- **Contour coloré commun** = cartes groupées
- **Outline indigo** = carte sélectionnée
- **Cartes estompées** = surbrillance d'un groupe active (objets hors-groupe atténués)
- **Animation pulse verte** sur l'avatar = utilisateur en ligne
- **Bordure ambre dashed** = mode édition de template (bannière haute du board)
- **Badges colorés** :
  - Vert = session live active (code affiché pour l'hôte)
  - Indigo pulse = membre authentifié participant à une session (code affiché dans la navbar)
  - Indigo = sélection / board
  - Violet → orange → rouge = timer/vote progressant vers expiration
  - Amber = template draft

---

## 13. Limitations connues

- L'undo/redo est local au client : un utilisateur ne peut pas annuler les actions des autres.
- Les drafts de templates abandonnés ne sont pas auto-nettoyés (visibles uniquement via le re-clic sur "Modifier le contenu").
- Les images de couverture sont des URL externes (pas d'upload géré côté serveur pour le moment).
- La présence Socket.io est en mémoire : pour scaler horizontalement il faudrait activer l'adapter Redis.

---

## Voir aussi

- [README.md](README.md) — Stack technique et démarrage en local
- [ideatank.txt](ideatank.txt) — Idées et fonctionnalités à venir
