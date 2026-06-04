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
