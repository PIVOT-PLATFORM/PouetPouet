// Séquence complète du tutoriel "Tour du tableau blanc".
//
// L'utilisateur réalise toutes les actions lui-même.
// Les steps 'spotlight' surlignent une zone (canevas, barre…) et laissent
// les clics passer au board. Les steps 'interactive' ouvrent le board entier
// (indispensable quand une modale doit s'ouvrir). Les steps 'centered'
// sont des slides d'explication sans cible.

import type { TutorialStep, TutorialContext } from './tutorials'

export function createBoardTutorialSteps(ctx: TutorialContext): TutorialStep[] {
  const all: TutorialStep[] = [

    // ── 1. Intro ────────────────────────────────────────────────────────────────
    {
      kind: 'centered',
      target: null,
      title: 'Bienvenue sur le tableau blanc 👋',
      body: 'Ce tour va vous guider à travers toutes les fonctionnalités du board.\nVous allez tout faire vous-même : créer des cartes, les déplacer, les relier…\n\nLes slides d\'explication avancent en cliquant n\'importe où. Pour les étapes interactives, réalisez l\'action puis cliquez Suivant →.\n\nVous pouvez quitter et relancer ce tour depuis la page Aide à tout moment.',
    },

    // ── 2. Créer une carte ───────────────────────────────────────────────────────
    {
      kind: 'spotlight',
      target: 'board-canvas',
      blocked: ['board-toolbar'],
      title: 'Créer votre première carte 📌',
      body: 'Double-cliquez n\'importe où sur le canevas pour créer une carte sticky.\n\nUne zone de saisie apparaît directement. Tapez quelque chose, puis cliquez ailleurs pour valider.',
      when: (c) => c.canEdit,
    },

    // ── 3. Sélectionner et déplacer ──────────────────────────────────────────────
    {
      kind: 'spotlight',
      target: 'board-canvas',
      blocked: ['board-toolbar'],
      title: 'Sélectionner et déplacer 🖱',
      body: 'Cliquez sur votre carte pour la sélectionner (contour bleu), puis faites-la glisser à un autre endroit.\n\nLes flèches du clavier déplacent de 1 px (Maj+flèche = 20 px).',
      when: (c) => c.canEdit,
    },

    // ── 4. Changer la couleur ────────────────────────────────────────────────────
    {
      kind: 'spotlight',
      target: 'board-canvas',
      blocked: ['board-toolbar'],
      title: 'Changer la couleur 🎨',
      body: 'Clic-droit sur une carte pour ouvrir le menu contextuel.\n\nChangez la couleur, la forme ou le calque depuis ce menu. Essayez une autre couleur !',
      when: (c) => c.canEdit,
    },

    // ── 5. Créer une 2e carte ────────────────────────────────────────────────────
    {
      kind: 'spotlight',
      target: 'board-canvas',
      blocked: ['board-toolbar'],
      title: 'Ajouter une 2e carte',
      body: 'Créez une deuxième carte en double-cliquant ailleurs sur le canevas. Le board est infini.\n\nVous pouvez aussi faire glisser un type depuis la barre d\'outils à gauche (Texte, Image, Forme…).',
      when: (c) => c.canEdit,
    },

    // ── 6. Connexion ─────────────────────────────────────────────────────────────
    {
      kind: 'spotlight',
      target: 'board-canvas',
      blocked: ['board-toolbar'],
      title: 'Relier deux cartes 🔗',
      body: 'Survolez le bord d\'une carte jusqu\'à voir un point bleu apparaître, puis faites glisser vers l\'autre carte pour créer une flèche.\n\nCliquez sur la connexion pour changer son style (pointillés, double flèche…).',
      when: (c) => c.canEdit,
    },

    // ── 7. Grouper ───────────────────────────────────────────────────────────────
    {
      kind: 'spotlight',
      target: 'board-canvas',
      blocked: ['board-toolbar'],
      title: 'Grouper des cartes 🗂',
      body: 'Tracez un rectangle de sélection autour de plusieurs cartes (ou Ctrl+clic pour multi-sélectionner), puis cliquez sur l\'icône "Grouper" dans la barre contextuelle.\n\nLe groupe se déplace et se redimensionne d\'un bloc.',
      when: (c) => c.canEdit,
    },

    // ── 8. Frame ─────────────────────────────────────────────────────────────────
    {
      kind: 'spotlight',
      target: 'board-toolbar',
      title: 'Cadres (Frames) 🖼',
      body: 'Cliquez sur l\'icône cadre dans la barre d\'outils à gauche, puis dessinez un rectangle sur le canevas pour créer un cadre.\n\nLes cartes à l\'intérieur se déplacent avec le cadre. Cliquez sur son titre pour le renommer.',
      when: (c) => c.canEdit,
    },

    // ── 9. Formes ────────────────────────────────────────────────────────────────
    {
      kind: 'spotlight',
      target: 'board-toolbar',
      title: 'Ajouter une forme 🔷',
      body: 'Cliquez sur l\'icône formes dans la barre d\'outils, choisissez une forme (rectangle, cercle, losange, étoile…) et cliquez-déposez sur le canevas.\n\nDouble-cliquez sur la forme pour y ajouter du texte.',
      when: (c) => c.canEdit,
    },

    // ── 10. Calques ──────────────────────────────────────────────────────────────
    {
      kind: 'centered',
      target: null,
      title: 'Calques 📚',
      body: 'Chaque élément appartient à l\'un des 3 calques : fond · principal · avant-plan.\n\nSélectionnez un élément → clic-droit → "Envoyer en arrière-plan" pour le passer sous les autres.\nIdéal pour les zones colorées et les images de fond.',
      when: (c) => c.canEdit,
    },

    // ── 11. Dessin libre ────────────────────────────────────────────────────────
    {
      kind: 'spotlight',
      target: 'board-toolbar',
      title: 'Dessin libre ✏️',
      body: 'Cliquez sur l\'icône crayon dans la barre d\'outils pour activer le dessin libre. Choisissez la couleur, l\'épaisseur et l\'opacité.\n\nDessinez quelque chose sur le canevas, puis appuyez sur Échap ou cliquez sur l\'outil Sélection (V) pour revenir.',
      when: (c) => c.canEdit && c.drawing,
    },

    // ── 12. Détail d'une carte ───────────────────────────────────────────────────
    {
      kind: 'interactive',
      target: 'board-canvas',
      title: 'Détail d\'une carte 🔍',
      body: 'Double-cliquez sur une carte pour ouvrir son panneau de détail : texte riche, couleur, champs personnalisés.\n\nExplorez le panneau puis fermez-le, et cliquez Suivant.',
    },

    // ── 13. Dupliquer ────────────────────────────────────────────────────────────
    {
      kind: 'spotlight',
      target: 'board-canvas',
      blocked: ['board-toolbar'],
      title: 'Dupliquer (Ctrl+D) 📋',
      body: 'Sélectionnez une ou plusieurs cartes et appuyez sur Ctrl+D pour les dupliquer instantanément (décalées de 24 px).\n\nVous pouvez aussi Ctrl+C puis Ctrl+V — même entre deux boards différents !',
      when: (c) => c.canEdit,
    },

    // ── 14. Annuler / Rétablir ───────────────────────────────────────────────────
    {
      kind: 'spotlight',
      target: 'board-history',
      title: 'Annuler et rétablir ↩↪',
      body: 'Appuyez sur Ctrl+Z pour annuler votre dernière action. Puis Ctrl+Y pour rétablir.\n\nLes boutons ← → ici font la même chose. Essayez plusieurs fois, puis cliquez Suivant.',
      when: (c) => !c.isReadonly,
    },

    // ── 15. Aimantation ──────────────────────────────────────────────────────────
    {
      kind: 'spotlight',
      target: 'board-toolbar',
      title: 'Aimantation 🧲',
      body: 'En bas de la barre d\'outils, deux icônes :\n• Grille d\'aimantation — alignement pixel-perfect\n• Guides d\'alignement — lignes bleues lors du déplacement\n\nActivez-les selon vos préférences.',
      when: (c) => c.canEdit,
    },

    // ── 16. Raccourcis édition ───────────────────────────────────────────────────
    {
      kind: 'centered',
      target: null,
      title: 'Raccourcis — Édition ⌨️',
      body: 'Ctrl+A — sélectionner tout\nCtrl+C / Ctrl+V — copier / coller (même entre boards !)\nCtrl+D — dupliquer en place\nSuppr / Backspace — supprimer la sélection\n← ↑ → ↓ — déplacer de 1 px   (Maj = 20 px)\nV — revenir à l\'outil Sélection\nÉchap — désélectionner / fermer les panneaux',
      when: (c) => !c.isReadonly,
    },

    // ── 17. Raccourcis navigation ────────────────────────────────────────────────
    {
      kind: 'centered',
      target: null,
      title: 'Raccourcis — Navigation 🖱',
      body: 'Molette — zoomer / dézoomer centré sur le curseur\nCtrl + Molette — zoom précis\nClic-molette (maintenu) — déplacer la vue\nEspace (maintenu) — déplacer temporairement\n\nLe canevas est infini : explorez !',
    },

    // ── 18. Titre ────────────────────────────────────────────────────────────────
    {
      kind: 'spotlight',
      target: 'board-title',
      title: 'Renommer le board 📝',
      body: 'Cliquez sur le titre en haut à gauche, tapez un nouveau nom, puis appuyez sur Entrée.\n\nEssayez de renommer ce board maintenant !',
      when: (c) => c.isOwner,
    },

    // ── 19. Présence ─────────────────────────────────────────────────────────────
    {
      kind: 'interactive',
      target: 'board-presence',
      title: 'Collaborateurs en temps réel 👥',
      body: 'Les avatars des personnes connectées s\'affichent ici. Cliquez pour voir la liste complète avec leurs rôles.\n\nLes curseurs et les modifications sont synchronisés en temps réel entre tous les participants.',
    },

    // ── 20. Partage ──────────────────────────────────────────────────────────────
    {
      kind: 'interactive',
      target: 'board-share',
      title: 'Partager le board 🔗',
      body: 'Cliquez sur l\'icône de partage pour ouvrir le panneau :\n• Inviter par e-mail (Lecteur ou Éditeur)\n• Générer un lien de partage public\n• Gérer les membres existants\n\nOuvrez le panneau, explorez les options, puis fermez-le.',
      when: (c) => c.canEdit,
    },

    // ── 21. Import ───────────────────────────────────────────────────────────────
    {
      kind: 'interactive',
      target: 'board-import',
      title: 'Importer du contenu 📥',
      body: 'Cliquez sur l\'icône d\'import pour accéder au hub :\n• Export Klaxoon (.klx)\n• PDF (converti en images par page)\n• Fichier Hub (.ppb)\n\nOuvrez le hub d\'import et explorez les formats disponibles.',
      when: (c) => c.canEdit,
    },

    // ── 22. Export ───────────────────────────────────────────────────────────────
    {
      kind: 'interactive',
      target: 'board-export',
      title: 'Exporter le board 📤',
      body: 'Cliquez sur l\'icône d\'export pour choisir le format :\n• Excel (.xlsx) — tableau des cartes\n• Archive Hub (.ppb) — réimportable sur Pivot\n\nOuvrez le hub d\'export.',
      when: (c) => c.canEdit,
    },

    // ── 23. Paramètres ───────────────────────────────────────────────────────────
    {
      kind: 'interactive',
      target: 'board-settings',
      title: 'Paramètres du board ⚙️',
      body: 'Cliquez sur l\'engrenage :\n• Activer / désactiver des fonctionnalités (dessin, vote, timer, champs…)\n• Limiter le nombre de participants\n• Gérer les membres et leurs rôles\n\nOuvrez les paramètres et explorez.',
      when: (c) => c.canEdit,
    },

    // ── 24. Vote / Timer ─────────────────────────────────────────────────────────
    {
      kind: 'interactive',
      target: 'board-activities',
      title: 'Animer un atelier 🗳⏱',
      body: 'Cliquez sur "Vote" pour configurer un vote en direct (votants, nombre de votes, résultats temps réel).\n\nCliquez sur "⏱" pour démarrer un minuteur partagé visible par tous.\n\nExplorez les deux menus.',
      when: (c) => c.canEdit && (c.voting || c.timer),
    },

    // ── 25. Sessions live ────────────────────────────────────────────────────────
    {
      kind: 'interactive',
      target: 'board-session',
      title: 'Sessions live 📡',
      body: 'Lancez une session pour réunir des participants (sans compte requis) autour d\'activités interactives :\nSondage · Nuage de mots · Brainstorming · Q&A\n\nCliquez sur le bouton de session pour ouvrir le panneau.',
      when: (c) => c.isOwner,
    },

    // ── 26. Outro ────────────────────────────────────────────────────────────────
    {
      kind: 'centered',
      target: null,
      title: "C'est parti ! 🚀",
      body: 'Vous avez exploré toutes les fonctionnalités du tableau blanc.\n\nLes éléments que vous avez créés pendant ce tour sont toujours là. Gardez-les pour continuer à travailler, ou supprimez-les avec le bouton Reset.',
      isOutro: true,
    },
  ]

  return all.filter((s) => !s.when || s.when(ctx))
}
