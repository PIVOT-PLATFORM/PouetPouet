// Source of truth for the in-app release notes shown in the notifications panel.
// Add a new entry at the TOP for each release; `date` (ISO) drives the "new" indicator,
// which compares the latest entry's date against the user's `patchNotesSeenAt`.
//
// `summary` is the one-liner shown on the card; `sections` is the full, grouped
// changelog shown when a card is opened in detail.

export interface PatchNoteSection {
  heading: string
  items: string[]
}

export interface PatchNote {
  version: string
  date: string // ISO date (YYYY-MM-DD)
  title: string
  summary: string
  sections: PatchNoteSection[]
}

export const PATCH_NOTES: PatchNote[] = [
  {
    version: '0.16.0',
    date: '2026-06-17',
    title: 'Partage des sessions Scrum & Daily',
    summary: 'Vous pouvez désormais partager une salle Scrum Poker ou une session Daily avec vos collègues, en Lecteur (consultation) ou Éditeur (pilotage), comme pour les tableaux. Les ressources partagées apparaissent dans vos listes avec leur rôle.',
    sections: [
      {
        heading: '🤝 Partage par rôle',
        items: [
          'Scrum Poker & Daily : un bouton « Partager » (réservé au propriétaire) permet d\'inviter un collègue par e-mail en Lecteur ou Éditeur.',
          'Un Éditeur peut piloter la session (créer/estimer des tickets, lancer le tour de parole) ; un Lecteur suit en consultation seule.',
          'Les salles et sessions partagées avec vous apparaissent dans vos listes avec un badge indiquant votre rôle.',
          'Seul le propriétaire peut gérer les partages (inviter, changer un rôle, révoquer) et supprimer la ressource.',
        ],
      },
    ],
  },
  {
    version: '0.15.1',
    date: '2026-06-16',
    title: 'Corrections : tableaux, cahiers de tests & moins de notifications',
    summary: 'Le collage Excel/Sheets dans un tableau existant remplit correctement la grille, les zones de saisie des cahiers de tests sont bien placées, et les notifications sont allégées (fini les notifs sur vos propres actions).',
    sections: [
      {
        heading: '🐛 Corrections',
        items: [
          'Tableaux : coller des données Excel/Sheets dans un tableau déjà présent remplit la grille cellule par cellule au lieu de tout concaténer dans une seule case.',
          'Cahiers de tests : les champs de saisie (Commentaire, en-tête, bilan, signature) sont désormais alignés sur leur ligne dans les PDF.',
          'Notifications : les libellés des notifications de board (partage, rôle, accès, suppression) ne sont plus affichés avec des caractères incorrects.',
        ],
      },
      {
        heading: '🔔 Moins de bruit',
        items: [
          'Plus de notification pour vos propres actions : daily terminé, tous les tickets Scrum estimés, import de board et tirage de la Roue n\'envoient plus de notification (les webhooks correspondants restent actifs).',
        ],
      },
      {
        heading: '🎨 Marque',
        items: [
          'La suite s\'affiche désormais sous le nom « PIVOT » dans l\'en-tête, le titre de l\'onglet, les écrans de connexion et les pages légales, avec sa nouvelle icône.',
        ],
      },
    ],
  },
  {
    version: '0.15.0',
    date: '2026-06-15',
    title: 'Feature flags',
    summary: 'Les administrateurs peuvent activer, désactiver ou déployer progressivement des fonctionnalités sans redéploiement, depuis une page dédiée.',
    sections: [
      {
        heading: '🚩 Feature flags',
        items: [
          'Nouvelle page d\'administration (réservée aux admins) pour piloter les fonctionnalités : activation/désactivation et déploiement progressif par pourcentage.',
          'Les valeurs sont propres à chaque environnement (dev / prod) et prennent effet immédiatement, sans redéploiement.',
          'Premiers usages : masquer un module du Hub (Daily, Scrum, La Roue, Capacité, MeetOps) ou désactiver l\'outil Tableau des boards.',
        ],
      },
    ],
  },
  {
    version: '0.14.0',
    date: '2026-06-14',
    title: 'Verrou d\'édition fiabilisé & file d\'estimation Scrum',
    summary: 'L\'édition à plusieurs sur un board est garantie côté serveur, l\'indicateur d\'édition distante est bien plus visible, et Scrum Poker enchaîne les tickets dans une file ordonnée.',
    sections: [
      {
        heading: '🤝 Collaboration board',
        items: [
          'Verrou d\'édition appliqué côté serveur : impossible de modifier une carte qu\'un autre participant est en train d\'éditer, même en cas de tentative simultanée — la garantie ne repose plus seulement sur l\'affichage.',
          'Indicateur d\'édition distante plus visible : un badge « Untel édite… » clair apparaît sur la carte en cours de modification par quelqu\'un d\'autre.',
          'Timer de session rejoué à la reconnexion : retrouver une session en cours réaffiche le minuteur au bon temps.',
        ],
      },
      {
        heading: '🃏 Scrum Poker',
        items: [
          'File d\'estimation ordonnée : enchaînez les tickets dans l\'ordre, avec bascule automatique vers le suivant une fois l\'estimation révélée.',
        ],
      },
    ],
  },
  {
    version: '0.13.0',
    date: '2026-06-13',
    title: 'Tableaux éditables, collage Excel & grille d\'aimantation',
    summary: 'Créez de vrais tableaux sur vos boards, collez-y vos données Excel ou Google Sheets, redimensionnez les colonnes, et alignez tout au cordeau grâce à la grille d\'aimantation et aux guides intelligents.',
    sections: [
      {
        heading: '✨ Nouveautés',
        items: [
          'Tableaux sur les boards : créez et éditez de vrais tableaux directement sur le board.',
          'Collage Excel / Google Sheets : collez des cellules pour les transformer instantanément en tableau ; coller dans un tableau existant le remplit au lieu d\'en créer un nouveau.',
          'Colonnes redimensionnables : ajustez la largeur de chaque colonne d\'un tableau.',
          'Grille d\'aimantation et guides d\'alignement intelligents : les objets s\'accrochent à une grille et des repères apparaissent pour aligner et espacer proprement.',
        ],
      },
    ],
  },
  {
    version: '0.12.0',
    date: '2026-06-12',
    title: 'Palettes de couleurs & hub repensé',
    summary: 'Choisissez votre palette (charte FDE incluse) depuis votre profil. Le hub gagne une section "Modules à venir" et des récents plus compacts.',
    sections: [
      {
        heading: '🎨 Palettes de couleurs',
        items: [
          'Sept palettes au choix dans Profil → Préférences : Défaut, FDE Bleu-Vert, FDE Orange-Vert, FDE Bleu-Orange, Améthyste, Océan et Rubis.',
          'Chaque palette se combine avec le mode nuit et s\'applique instantanément à toute l\'interface.',
        ],
      },
      {
        heading: '✨ Hub',
        items: [
          'Les éléments récents tiennent sur une ligne, triés du plus frais au plus ancien — "Tout afficher" pour dérouler.',
          'Nouvelle section "Modules à venir" : un aperçu de ce qui arrive sur la plateforme.',
        ],
      },
      {
        heading: '🔧 Corrections',
        items: [
          'Capacité : la liste des événements plantait dès qu\'un événement existait — corrigé.',
        ],
      },
    ],
  },
  {
    version: '0.11.0',
    date: '2026-06-12',
    title: 'Co-propriétaires, matrice des rôles & aide repensée',
    summary: 'Nommez des co-propriétaires sur vos boards. Les rôles Propriétaire / Éditeur / Lecteur sont clarifiés, appliqués partout, documentés visuellement dans l\'aide — dont les sections sont désormais dépliables.',
    sections: [
      {
        heading: '✨ Nouveautés',
        items: [
          'Co-propriétaires : invitez quelqu\'un en "Propriétaire" — il obtient les mêmes droits que vous (gestion des partages, paramètres, suppression). Le créateur du board reste intouchable.',
          'Matrice des rôles : la page Aide affiche désormais le tableau complet des permissions par rôle.',
          'Page Aide : sections dépliables (Fonctionnalités ouverte par défaut, le reste replié) — navigation clavier et lecteurs d\'écran pris en charge.',
        ],
      },
      {
        heading: '🛡️ Clarification des rôles',
        items: [
          'Réinitialiser un board est désormais réservé aux propriétaires.',
          'Les éditeurs peuvent prolonger un vote (en plus de le lancer et le clôturer).',
          'Les éditeurs peuvent démarrer, animer et fermer une session live.',
          'Le lien de partage donne au maximum le rôle Éditeur — jamais la propriété.',
        ],
      },
    ],
  },
  {
    version: '0.10.0',
    date: '2026-06-12',
    title: 'Collaboration board — retours de recette',
    summary: 'Le travail à plusieurs sur un board devient fiable : plus de vol de focus, verrou d\'édition visible, reset annulable, résultats de vote et d\'activité montrés à tous.',
    sections: [
      {
        heading: '🤝 Collaboration',
        items: [
          'Verrou d\'édition : quand quelqu\'un écrit dans une carte, les autres voient "Untel écrit…" et ne peuvent pas l\'ouvrir en même temps.',
          'Plus de vol de focus : une carte créée par un collègue ne capture plus votre curseur pendant que vous écrivez.',
          'Compteur de participants fiable : la liste des membres se met à jour quand quelqu\'un rejoint via un lien de partage (fini le "2/1").',
        ],
      },
      {
        heading: '✨ Améliorations',
        items: [
          'Reset du board : suppression atomique (plus d\'éléments fantômes) et Ctrl+Z restaure le contenu effacé.',
          'Votes : à la clôture, les résultats s\'affichent chez tous les participants ; les formes ne sont plus votables.',
          'Activités de session : à la clôture d\'un sondage, quiz ou brainstorm, le rapport de résultats reste affiché pour l\'animateur et les participants.',
          'Timer : fermer l\'écran de fin ne coupe plus le timer des autres.',
          'Cadres : limite de 2 par board pour préserver la lisibilité.',
        ],
      },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-06-12',
    title: 'Performance temps réel & accessibilité',
    summary: 'Les boards tiennent désormais 300+ participants simultanés. Toute l\'application passe l\'audit d\'accessibilité WCAG AA, et les webhooks réessaient automatiquement en cas d\'échec.',
    sections: [
      {
        heading: '⚡ Performance',
        items: [
          'Curseurs temps réel : les positions sont regroupées côté serveur (20 envois/seconde par board au lieu d\'un message par mouvement) — un même board supporte désormais 300+ participants simultanés avec une latence inférieure à 15 ms.',
          'Moins de travail côté navigateur : l\'affichage des curseurs se met à jour en un seul rendu par lot.',
        ],
      },
      {
        heading: '✨ Améliorations',
        items: [
          'Accessibilité : contrastes relevés et étiquettes lecteurs d\'écran sur toute l\'application — zéro violation WCAG AA critique, vérifié automatiquement à chaque build.',
          'Webhooks : en cas d\'échec de livraison (erreur réseau ou 5xx), une nouvelle tentative part automatiquement après 30 secondes — les deux tentatives sont visibles dans l\'historique.',
        ],
      },
      {
        heading: '🔧 Corrections',
        items: [
          'Supervision web : la politique de sécurité bloquait l\'envoi des rapports d\'erreurs du navigateur — corrigé.',
          'Préparation multi-instance : le connecteur Redis temps réel ne pouvait pas s\'abonner aux événements inter-instances — corrigé avant d\'en avoir besoin.',
        ],
      },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-06-12',
    title: 'Connexion SSO, journal de sécurité & fiabilité',
    summary: 'Connectez-vous via votre fournisseur d\'identité (Keycloak, Google, Azure AD…). Votre profil affiche le journal des actions sensibles de votre compte. La connexion est de nouveau fiable même sans cache.',
    sections: [
      {
        heading: '✨ Nouveautés',
        items: [
          'Connexion SSO (OIDC) : si votre instance est reliée à un fournisseur d\'identité, un bouton "Se connecter avec…" apparaît sur la page de connexion. Votre compte local est lié automatiquement par email.',
          'Journal de sécurité : consultez depuis votre profil les 50 dernières actions sensibles (connexions, tentatives échouées, mots de passe, clés API, webhooks).',
        ],
      },
      {
        heading: '🛡️ Fiabilité',
        items: [
          'Nettoyage automatique : les sessions fermées (30 j), notifications lues (90 j) et entrées d\'audit (180 j) sont purgées quotidiennement.',
          'Tenue de charge validée : 100 participants simultanés sur un même board (latence p99 < 100 ms).',
          'Reconnexion : rafraîchir la page pendant un vote Scrum ou une session live re-connecte automatiquement, désormais couvert par des tests.',
        ],
      },
      {
        heading: '🔧 Corrections',
        items: [
          'Connexion / inscription : le limiteur de requêtes plantait quand le cache Redis est indisponible (erreur 500 systématique au login) — il s\'efface désormais proprement.',
          'Supervision : les erreurs normales de session expirée ne sont plus remontées comme des bugs.',
        ],
      },
    ],
  },
  {
    version: '0.7.0',
    date: '2026-06-12',
    title: 'Connexions inter-modules, webhooks & équipes',
    summary: 'Abonnez-vous aux événements PouetPouet via webhooks signés HMAC, avec historique des livraisons. Scrum Poker alimente la Capacité, les équipes sont unifiées entre modules, et le hub affiche votre activité récente.',
    sections: [
      {
        heading: '✨ Nouveautés',
        items: [
          'Webhooks sortants : créez jusqu\'à 20 webhooks pour recevoir des événements (import board, daily terminé, Scrum estimé, tirage roue) sur votre endpoint HTTP. Signature HMAC-SHA256 dans l\'en-tête X-Webhook-Signature.',
          'Test de webhook : bouton ⚡ pour envoyer un ping signé et vérifier la connectivité en temps réel.',
          'Webhooks — historique des livraisons : bouton 🕐 sur chaque webhook pour consulter les 50 dernières tentatives (statut HTTP, message d\'erreur, durée, date).',
          'Scrum → Capacité : liez une salle Scrum Poker à une équipe — quand tous les tickets sont estimés, le total de points remplit automatiquement le sprint en planification.',
          'Équipes — gestion centralisée : les équipes créées dans Daily, Capacité ou Scrum sont désormais un seul et même objet partagé entre tous les modules.',
          'Hub — modules favoris : cliquez l\'étoile sur une tuile pour la mettre en favori ; les favoris apparaissent en premier.',
          'Hub — activité récente : section "Récent" listant vos derniers boards modifiés, dailys, salles Scrum et tirages.',
          'Notifications enrichies : import de board (résumé cartes + connexions), Scrum terminé (total story points), tirage Roue (résultat).',
          'Scrum Poker — recherche par équipe dans la liste des salles.',
        ],
      },
      {
        heading: '🔧 Corrections',
        items: [
          'Daily — enrichissement du payload de fin de session (nombre de participants, durée) sur l\'auto-fin comme sur la fin manuelle.',
          'Déploiement : correction du packaging Docker de l\'API et d\'une migration corrompue qui bloquaient les mises en production.',
        ],
      },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-06-11',
    title: 'Curseurs temps réel, clés API, RGPD & sécurité',
    summary: 'Voyez les curseurs de vos collaborateurs en direct sur le board. Générez des clés API pour vos scripts. Exportez vos données personnelles (RGPD). En-têtes de sécurité CSP.',
    sections: [
      {
        heading: '✨ Nouveautés',
        items: [
          'Curseurs collaboratifs : les positions de tous les membres actifs d\'un board s\'affichent en temps réel (nom + curseur coloré, throttlé à 20 fps).',
          'Clés API : créez jusqu\'à 10 clés par compte, révoquez-les à tout moment depuis votre profil, avec suivi de la dernière utilisation.',
          'Authentification par header X-API-Key en complément du JWT pour les appels programmatiques.',
          'Export RGPD : bouton "Exporter mes données" dans le profil → télécharge un JSON complet (profil, boards, dailys, salles, équipes, tirages, notifications).',
        ],
      },
      {
        heading: '🔒 Sécurité',
        items: [
          'En-têtes HTTP de sécurité : Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS (prod).',
        ],
      },
      {
        heading: '🐛 Correctifs',
        items: [
          'Viewport board : overflow-hidden + double requestAnimationFrame corrigent le décalage de toCanvas() / fitToContent() au chargement initial.',
        ],
      },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-06-11',
    title: 'Pivot Équipes, Redis multi-instance & Hub unifié',
    summary: 'Les modules Capacité et Daily partagent désormais un pivot Équipe unique. Le hub devient la page d\'accueil. Les serveurs peuvent scaler horizontalement grâce à Redis.',
    sections: [
      {
        heading: '✨ Nouveautés',
        items: [
          'Hub : page d\'accueil par défaut après connexion, avec compteurs cross-modules en temps réel.',
          'Pivot Équipe : les équipes Daily et Capacité sont unifiées en un seul objet Équipe partagé entre les modules.',
          'Liaisons événementielles : notification automatique quand un daily se termine ou quand tous les tickets Scrum sont estimés.',
          'Nouvelles icônes dans la cloche pour les types de notifications DAILY_SESSION_ENDED et SCRUM_ALL_ESTIMATED.',
        ],
      },
      {
        heading: '⚡ Performances & Scalabilité',
        items: [
          'Redis Socket.io adapter : les événements socket se propagent entre instances — le service peut maintenant scaler horizontalement (max-instances=10).',
          'Présence board mise en cache dans Redis hash — plus de fetchSockets() O(n) sur toutes les instances.',
          'Participants Scrum Poker stockés dans Redis hash (TTL 24h) — registry partagé entre instances, fallback Map en dev.',
        ],
      },
      {
        heading: '🔒 Sécurité',
        items: [
          'Rate limiting activé en production : inscription (5/h), connexion (10/5min), renvoi vérification (3/h), mot de passe oublié (3/h), import Klaxoon (5/min).',
        ],
      },
      {
        heading: '🧪 Qualité',
        items: [
          '61 tests unitaires : bus d\'événements, mailer, calculs de capacité (22 cas), patch-notes, JWT, formats.',
          'Typecheck strict maintenu sur API et Web.',
        ],
      },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-06-11',
    title: 'Capacité, import Klaxoon complet, performances board & socle FORGE',
    summary: "Nouveau module Capacité, formes et dessins Klaxoon importes fidelement, boards charges enfin fluides et nets, hub des modules, et durcissement multi-utilisateur de tous les ateliers.",
    sections: [
      {
        heading: '✨ Nouveautés',
        items: [
          "Module Capacité : planification de capacite d'equipe par PI / sprint / release — membres (FTE, role), absences, focus factor, calcul live jours-homme / heures / points, indicateurs engage vs realise et retour des PI precedents.",
          "Import Klaxoon : les rectangles deviennent de vraies formes editables, les dessins a segments droits sont reconstruits, et l'empilement d'origine (cadres sous les post-its) est preserve.",
          "Import Klaxoon : les cartes sont dimensionnees selon leur texte, les grandes captures plafonnees et les petites icones gardent leur taille reelle ; les titres conservent leur hierarchie visuelle.",
          "Hub des modules : nouvelle page regroupant tous les outils (icone grille dans la barre de navigation).",
          "Etat de sante enrichi : /health verifie la base de donnees et Redis ; suivi d'erreurs Sentry optionnel cote API et web.",
        ],
      },
      {
        heading: '⚡ Performances',
        items: [
          "Boards charges : seules les cartes visibles a l'ecran sont rendues ; deplacer une carte ne redessine plus tout le board.",
          "Nettete : le texte redevient net des la fin du zoom/deplacement, meme tres dezoome.",
        ],
      },
      {
        heading: '🐛 Corrections',
        items: [
          "Scrum Poker : seul l'animateur peut reveler, reinitialiser ou estimer ; le compteur de participants n'inclut plus l'animateur ; un vote survit au rafraichissement de la page.",
          "Daily : seul le proprietaire pilote la session ; un double-clic sur Suivant ne saute plus de speaker.",
          "Votes de board : impossible de depasser son quota de votes en cliquant tres vite.",
          "Stabilite : la suppression simultanee d'objets par plusieurs utilisateurs ne provoque plus d'erreurs serveur.",
          "Viewport board : plus de decalage du board au chargement initial.",
        ],
      },
    ],
  },
  {
    version: '0.3.1',
    date: '2026-06-05',
    title: 'Correctifs sessions & Scrum Poker',
    summary: 'Participants anonymes peuvent enfin rejoindre les sessions, reconnexion automatique effective et bouton Scrum bloque corrige.',
    sections: [
      {
        heading: '🐛 Corrections',
        items: [
          "Sessions : les participants anonymes peuvent desormais rejoindre une session (la connexion socket refusait les acces sans compte, rendant le lien de session non fonctionnel).",
          "Sessions : un participant recharge la page et rejoint automatiquement sa session sans ressaisir son prenom (la resilience annoncee en v0.3.0 est desormais effective).",
          "Scrum Poker : le bouton Connexion ne reste plus bloque en chargement apres un rechargement de page en mode participant anonyme.",
        ],
      },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-06-04',
    title: 'Couches, sessions, clipboard inter-boards & améliorations',
    summary: 'Couches (layers), copier-coller entre boards, sessions enrichies avec reconnexion, import/export multi-format, cadres actifs, mise en forme texte et groupes avances.',
    sections: [
      {
        heading: '✨ Nouveautés',
        items: [
          "Couches (layers) : chaque objet peut etre place sur l'une des 3 couches (fond, principal, avant-plan) ; les objets de couche superieure passent toujours au-dessus.",
          "Copier-coller inter-boards (Ctrl+C / Ctrl+V) : la selection est copiee dans le presse-papier local et peut etre collee sur n'importe quel autre board du meme compte, avec preservation des couches et des groupes. Le presse-papier se vide automatiquement apres le collage.",
          "Sessions de board enrichies : les membres authentifies du board participent aux activites directement depuis la page board, sans lien de session distinct.",
          "Resilience des sessions : l'hote et les participants se reconnectent automatiquement apres un rafraichissement de page ou une perte de connexion reseau.",
          "Scrum Poker resilient : l'hote et les participants rejoignent automatiquement la salle apres un rafraichissement ou une coupure reseau.",
          "Reinitialisation du mot de passe : lien de reinitialisation envoye par email depuis la page de connexion.",
          "Annuler/Retablir etendu : grouper, degrouper, changer la couleur d'un groupe, verrouiller et deverrouiller sont desormais annulables avec Ctrl+Z.",
          "Import de boards depuis un fichier Klaxoon (.klx), un PDF (une carte par page) ou une image ; coller une image ou du texte directement sur le board (Ctrl+V).",
          "Export multi-format : PDF (tout le board sur une page), PNG, tableur Excel (.xlsx) et archive PouetPouet (.ppb).",
          "Cartes IMAGE : nouveau type de carte affichant une image, redimensionnable depuis n'importe quel bord ou coin.",
          "Cadres actifs/inactifs : en mode actif, deplacer un cadre emporte automatiquement tous les objets non-verrouilles qu'il contient.",
          "Redimensionnement de tous les objets (carte, forme, dessin, libelle, image, cadre) depuis n'importe quel bord ou coin, avec ancrage du cote oppose.",
          "Panneau des groupes : liste tous les groupes avec le nombre de cartes, surbrillance au clic (les autres cartes sont estompees).",
          "Double-clic sur une carte TEXT pour entrer en edition ; la carte s'agrandit automatiquement a la saisie.",
          "En-tete coloree sur les cartes TEXT : teinte derivee automatiquement de la couleur de la carte.",
          "Mise en forme du texte dans les cartes TEXT depuis la modale de detail : taille, gras, italique, souligne, barre, couleur et alignement.",
          "Couleur de contour personnalisee par groupe, persistante et partagee entre tous les participants.",
          "Suppression d'un groupe depuis le panneau (les cartes restent sur le board).",
          "Dissolution automatique d'un groupe reduit a un seul objet.",
        ],
      },
      {
        heading: '🛠️ Améliorations',
        items: [
          "Barre d'outils : Echap ferme tous les menus et panneaux ouverts (menu Vote, Timer, Overflow, panneau des groupes).",
          "Barre d'outils : les menus Vote, Timer et Overflow sont mutuellement exclusifs ; ouvrir l'un ferme automatiquement les autres.",
          "Barre d'outils : ouvrir un modal (import, export, partage, parametres, vote) ferme tous les menus et le panneau des groupes.",
          "Barre d'outils : changer d'outil deselectionne automatiquement les cartes et fait disparaitre la barre de selection flottante.",
          "Liaisons hors-groupe attenuees en mode surbrillance pour isoler visuellement le groupe actif.",
          "Panneau des groupes ouvert au survol, ancre sous le bouton Groupes ; se fixe si un groupe est en surbrillance, se ferme en cliquant en dehors.",
        ],
      },
      {
        heading: '🐛 Corrections',
        items: [
          "Sessions : verification de propriete sur toutes les actions hote (creation, fermeture, lancement d'activite) cote HTTP et socket.",
          "Scrum Poker : les votes sont correctement reinitialises lors d'un changement d'echelle d'estimation (plus de cumul entre echelles).",
          "Scrum Poker : affichage correct de l'estimation finale en mode Temps (champ estimateTime au lieu de estimate).",
          "Cadre actif : quand un cadre capture une carte appartenant a un groupe, tout le groupe se deplace avec lui, meme si les autres membres sont hors du cadre.",
          "Hauteur des cartes TEXT correctement preservee apres la sortie de l'edition (plus de collapse inattendu).",
          "Liaisons mises a jour immediatement apres modification d'une carte TEXT (correction d'une condition de course socket).",
          "Curseur positionne a l'endroit du clic lors de l'entree en edition d'une carte TEXT.",
          "Panneau des groupes ancre sous le bouton Groupes au lieu du coin superieur droit.",
          "Distance du popup de timer corrigee pour respecter l'ecart habituel sous la barre de navigation.",
        ],
      },
    ],
  },
  {
    version: '0.2.1',
    date: '2026-05-31',
    title: 'Corrections v0.2.1',
    summary: "Trait simple en remplacement de l'hexagone, flèches propres sur les liaisons et meilleur positionnement du sélecteur de couleur.",
    sections: [
      {
        heading: '🐛 Corrections',
        items: [
          "Hexagone remplacé par un trait simple (ligne horizontale, plus utile comme séparateur visuel).",
          'Flèches sur les liaisons rendues via marqueurs SVG natifs : plus de débordement de trait sous la pointe.',
          'Sélecteur de couleur en sélection multiple ancré sur le badge de sélection, aligné sous la barre de navigation comme les autres popups.',
          'Reconnexion automatique au board après une coupure réseau : les modifications reprennent sans devoir quitter et revenir.',
        ],
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-05-31',
    title: 'Édition avancée & notifications',
    summary:
      "Refonte de l'édition des boards, sécurité des comptes et nouveau centre de notifications.",
    sections: [
      {
        heading: '✨ Nouveautés',
        items: [
          'Centre de notifications dans la barre de navigation : suivi de l’activité du compte (board partagé, changement de rôle, accès retiré, board supprimé) en temps réel, et notes de version consultables à tout moment (frise des versions + détail complet par version).',
          'Numéro de version affiché dans l’interface (sur le logo et en pied de page), cliquable pour ouvrir les notes de version.',
          'Vérification de l’adresse email à l’inscription (lien envoyé par email), connexion bloquée tant que l’email n’est pas confirmé.',
          'Suppression définitive du compte depuis le profil, confirmée par le mot de passe.',
          'Pages légales : mentions légales, confidentialité et CGU, adaptées à un éditeur particulier.',
          'Système de couleurs unifié : palette pastel commune à tout l’éditeur, sélecteur de couleur personnalisé et mémorisation des couleurs récentes.',
          'Nouvelles formes : trait simple et étoile.',
          'Redimensionnement des objets par poignées sur les 8 directions (façon Klaxoon), avec ancrage du côté opposé.',
          'Liaisons enrichies : tracé droit, courbe ou orthogonal, flèches dans un sens ou les deux, couleur, épaisseur, pointillés, libellé, 4 points d’ancrage fixes (N/S/E/O) et mini-barre contextuelle.',
          'Verrouillage des objets : un objet verrouillé ne peut plus être déplacé, modifié, supprimé ni capturé dans un cadre, mais reste connectable et déverrouillable (les dessins, eux, ne sont pas verrouillables).',
          'Outil main dans la barre d’outils + déplacement du board avec la barre d’espace, et centrage automatique sur le contenu.',
          'Export PDF du board (tout le board sur une page), accessible depuis la fenêtre de partage.',
          'Sélection multiple repensée : barre d’outils compacte et repliable, raccourcis (Ctrl+A / Ctrl+D, déplacement aux flèches) et arrangement des objets (vertical, horizontal, grille).',
          'Liaison de plusieurs cartes d’un coup en mode « relier » (Ctrl+clic).',
          'Session d’authentification glissante de 30 minutes avec avertissement avant expiration.',
        ],
      },
      {
        heading: '🛠️ Améliorations',
        items: [
          'Zoom plus fin : amortissement au-delà de 100 %, pincement au trackpad et zoom sur la sélection.',
          'En-têtes de pages uniformes, barres de recherche, icônes de suppression et mise en page revue (daily, scrum).',
          'Logo et pied de page cohérents avec le reste du site sur les pages légales.',
          'Barre d’outils flottante maintenue sous les modales et de hauteur constante en sélection groupée.',
        ],
      },
      {
        heading: '🐛 Corrections',
        items: [
          'Maintien de la page courante au rafraîchissement (F5) au lieu d’une redirection intempestive.',
          'Pop-up de couleurs rendue dans un portail et alignée sur sa barre d’outils.',
          'Barre d’édition d’une forme ou d’un libellé qui ne chevauche plus jamais l’objet.',
          'Barres d’édition individuelles masquées pendant une sélection multiple.',
          'Curseur (main / flèche) toujours visible grâce à un contour noir permanent.',
          'Export PDF compatible avec les couleurs modernes (oklch).',
          'Robustesse des cartes et liaisons face aux suppressions simultanées entre clients.',
        ],
      },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-05-29',
    title: 'Première mise en ligne',
    summary:
      'Boards collaboratifs en temps réel et ateliers d’animation d’équipe.',
    sections: [
      {
        heading: '✨ Au programme',
        items: [
          'Boards collaboratifs en temps réel : cartes, formes, dessins, cadres et connexions.',
          'Partage de boards par lien ou par invitation, avec rôles lecteur / éditeur.',
          'Templates de boards, favoris et votes sur les cartes.',
          'Ateliers d’animation : Scrum Poker, Daily Standup, La Roue et gestion des équipes.',
          'Comptes utilisateurs, profil et thème clair / sombre.',
        ],
      },
      {
        heading: '🐛 Corrections',
        items: [
          'Correction du timer de daily qui ne s’arrêtait plus, et diverses améliorations d’ergonomie.',
          'Corrections de build et de déploiement (Docker).',
        ],
      },
    ],
  },
]

// Most recent release date — used server-side to decide whether a user has unseen notes.
export const LATEST_PATCH_DATE = PATCH_NOTES[0]?.date ?? null
