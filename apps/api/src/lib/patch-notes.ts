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
    version: '0.2.0',
    date: '2026-05-31',
    title: 'Édition avancée, comptes & notifications',
    summary:
      "Tout le travail réalisé depuis la première mise en ligne : édition des boards repensée (couleurs, formes, redimensionnement, liaisons), sécurité des comptes, pages légales et nouveau centre de notifications.",
    sections: [
      {
        heading: '✨ Nouveautés',
        items: [
          'Centre de notifications dans la barre de navigation : suivi de l’activité du compte (board partagé, changement de rôle, accès retiré, board supprimé) en temps réel, et notes de version consultables à tout moment.',
          'Vérification de l’adresse email à l’inscription (lien envoyé par email), connexion bloquée tant que l’email n’est pas confirmé.',
          'Suppression définitive du compte depuis le profil, confirmée par le mot de passe.',
          'Pages légales : mentions légales, confidentialité et CGU, adaptées à un éditeur particulier.',
          'Système de couleurs unifié : palette pastel commune à tout l’éditeur, sélecteur de couleur personnalisé et mémorisation des couleurs récentes.',
          'Nouvelles formes : hexagone et étoile.',
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
      'Version initiale déployée de PouetPouet : boards collaboratifs en temps réel et ateliers d’animation d’équipe.',
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
