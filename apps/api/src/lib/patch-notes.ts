// Source of truth for the in-app release notes shown in the notifications panel.
// Add a new entry at the TOP for each release; the "new" indicator compares the
// latest entry's `version` against the user's `patchNotesSeenVersion` (#219).
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
    version: '0.32.2',
    date: '2026-07-11',
    title: 'Correctif PDF & sécurité',
    summary: 'Correction d\'un bug empêchant l\'envoi de PDF (fusion, extraction, découpe) depuis fin juin. Renforcement du contrôle d\'accès sur les Cahiers de tests.',
    sections: [
      {
        heading: '🐛 Corrections',
        items: [
          'PDF Manager : la fusion, l\'extraction et la découpe de pages ne fonctionnaient plus depuis plusieurs jours — corrigé',
          'Cahiers de tests : renforcement du contrôle d\'accès sur la modification des cahiers, sections et cas de test',
        ],
      },
    ],
  },
  {
    version: '0.32.1',
    date: '2026-07-10',
    title: 'Renforcement sécurité',
    summary: 'Durcissement de la sécurité côté serveur : filtrage des requêtes réseau internes, en-têtes HTTP de sécurité, exécution des conteneurs en utilisateur restreint, mise à jour de dépendances.',
    sections: [
      {
        heading: '🔒 Sécurité',
        items: [
          'Filtrage renforcé des requêtes réseau déclenchées par les cartes de lien (protection contre le sondage du réseau interne)',
          'En-têtes HTTP de sécurité standards ajoutés sur l\'API',
          'Conteneurs applicatifs exécutés en utilisateur restreint plutôt qu\'administrateur',
          'Mise à jour de dépendances (dont une faille corrigée sur l\'envoi d\'emails)',
        ],
      },
    ],
  },
  {
    version: '0.32.0',
    date: '2026-07-09',
    title: 'Import Klaxoon & confort des boards',
    summary: 'Import Klaxoon revu : déposez directement un fichier .klx, il se décompresse et se convertit tout seul avec une bien meilleure fidélité (tailles réelles, cadres, images, dessins, champs personnalisés). Et une série d\'améliorations de confort sur les boards : texte proportionnel à la carte, redimensionnement d\'une sélection multiple, dézoom adapté aux grands boards, navigation au clic droit.',
    sections: [
      {
        heading: '📥 Import Klaxoon',
        items: [
          'Déposez directement un fichier .klx : décompression, repérage des activités et conversion automatiques',
          'Fidélité de conversion nettement améliorée : tailles et positions réelles, zones → cadres, postits image, dessins au brush, formes et flèches',
          'Catégories et dimensions Klaxoon converties en champs personnalisés sur les cartes',
          'Annulation de l\'import en un clic, et placement anti-collision sous le contenu existant',
          'Liaisons en pointillés désormais correctement détectées',
        ],
      },
      {
        heading: '🎨 Confort des boards',
        items: [
          'La taille du texte s\'adapte à la taille de la carte (lisible quel que soit le zoom)',
          'Redimensionnement d\'une sélection multiple ou d\'un groupe via un cadre englobant, en un seul geste',
          'Dézoom dynamique : les très grands boards tiennent désormais entièrement à l\'écran',
          'Navigation au clic droit maintenu, comme au clic molette',
          'Badge « en cours d\'édition » qui n\'est plus rogné par la carte',
        ],
      },
    ],
  },
  {
    version: '0.31.0',
    date: '2026-07-06',
    title: 'Module PI Planning',
    summary: 'Nouveau module PI Planning pour organiser un PI SAFe : cycle et itérations du Train, logistique de l\'événement via les Formulaires (destinataires nommés + relances automatiques), tâches de préparation via To-Do (kanban, assignation), et program board multi-équipes avec dépendances.',
    sections: [
      {
        heading: '🚂 PI Planning',
        items: [
          'Créer un PI : itérations générées automatiquement (IT1…ITn + IP Sprint), équipes du Train saisies ou importées depuis vos équipes',
          'Formulaire logistique (présence, hôtel, repas, allergies) créé en un clic dans les Formulaires et rattaché au PI',
          'Tableau des tâches de préparation créé en un clic dans To-Do et rattaché au PI',
          'Program board : tickets typés (Feature, Milestone, Risque, Objectif, Story, Enabler) placés par équipe × itération en glisser-déposer, ligne Train, colonne Non planifié',
          'Dépendances entre tickets en flèches vert (OK) / rouge (bloquant) avec note, détection des boucles',
          'Partage par rôle : le RTE propriétaire, les Scrum Masters éditeurs',
        ],
      },
      {
        heading: '📋 Formulaires — destinataires & relances',
        items: [
          'Destinataires nommés avec lien personnel : suivez qui a répondu, chacun peut revoir et modifier sa réponse',
          'Envoi des invitations par email, relance manuelle ou automatique des non-répondants à la fréquence de votre choix',
          'Export CSV avec choix des colonnes, nom/email du destinataire inclus',
        ],
      },
      {
        heading: '✅ To-Do — kanban & assignation',
        items: [
          'Nouveaux statuts En cours et Bloqué, vue Kanban en glisser-déposer en plus de la vue Liste',
          'Assignation multiple des tâches aux membres de la liste, filtre par membre',
        ],
      },
    ],
  },
  {
    version: '0.30.0',
    date: '2026-07-05',
    title: 'Module To-Do',
    summary: 'Nouveau module To-Do : listes de tâches personnelles ou partagées, mise en favori, et tableaux de bord combinant plusieurs listes avec rapports et statistiques de complétion.',
    sections: [
      {
        heading: '✅ Listes de tâches',
        items: [
          'Créer des listes personnelles, les partager (Lecteur/Éditeur) et les mettre en favori',
          'Tâches avec priorité, échéance et statut à faire / fait / annulé',
          'Une tâche annulée sort du calcul de complétion et passe en fin de liste',
        ],
      },
      {
        heading: '📊 Tableaux de bord',
        items: [
          'Combiner plusieurs listes de tâches dans un tableau de bord consolidé',
          'Accès transitif : un partage sur le tableau de bord donne accès aux listes rattachées',
          'Complétion globale et par liste, répartition par priorité, tâches en retard, flux « récemment terminé »',
        ],
      },
    ],
  },
  {
    version: '0.29.0',
    date: '2026-07-04',
    title: 'Module Innovation',
    summary: 'Nouveau module Innovation : boîte à idées collaborative avec challenges, jurys, gamification et rattachement organisationnel. Fiches innovation publiques ou privées, favoris, commentaires, pièces jointes, liens, tags et export CSV.',
    sections: [
      {
        heading: '💡 Fiches innovation',
        items: [
          'Publier une idée (pitch, problème, solution, bénéfices), visible par toute l\'équipe ou restreinte en privé',
          'Voter, mettre en favori, commenter, ajouter des pièces jointes et des liens externes',
          'Image de couverture (carte) et bannière (fiche), tags multi-valeurs, rattachement à un périmètre organisationnel (LDAP ou interne)',
          'Suivi du statut (Idée → Exploration → Adoptée / Abandonnée), co-contributeurs',
        ],
      },
      {
        heading: '🏆 Challenges',
        items: [
          'Challenges administrés avec fenêtre d\'ouverture, inscriptions et éligibilité par périmètre',
          'Notation multi-critères pondérée par un jury dédié, classement automatique',
          'Désignation des lauréats et export CSV du classement',
        ],
      },
      {
        heading: '📊 Dashboard & gamification',
        items: [
          'Vue d\'ensemble : maturation des fiches, top idées, répartition par catégorie',
          'Badges et classement des contributeurs',
        ],
      },
    ],
  },
  {
    version: '0.28.1',
    date: '2026-07-02',
    title: 'Colonne Refusé & harmonisation de l\'interface',
    summary: 'Le kanban Feedback gagne une colonne « Refusé » et occupe toute la page. Les en-têtes de tous les modules sont harmonisés (titres, boutons, chevrons) et le module Commande publique signale proprement un service externe indisponible.',
    sections: [
      {
        heading: '💬 Feedback',
        items: [
          'Nouvelle colonne « Refusé » en fin de kanban pour les tickets écartés',
          'Les colonnes se partagent toute la largeur de la page (plus de scroll horizontal inutile)',
          'L\'icône Feedback de la barre de navigation retrouve sa bulle d\'origine',
        ],
      },
      {
        heading: '🎨 Interface harmonisée',
        items: [
          'Titres de modules uniformisés : même taille, même style, icône du module partout',
          'Boutons de création alignés (taille, hauteur, effet) sur tous les modules',
          'Tous les liens retour utilisent désormais un chevron (fini les flèches « ← » disparates)',
          'Page Feature flags : pleine largeur et affichage sur 2 colonnes',
          'Correction du titre de salle Scrum invisible en mode sombre',
        ],
      },
      {
        heading: '🏛️ Commande publique',
        items: [
          'Si le PGI ou l\'annuaire externe est indisponible, l\'application l\'annonce clairement au lieu d\'une erreur brute',
        ],
      },
    ],
  },
  {
    version: '0.28.0',
    date: '2026-07-02',
    title: 'Modules Portefeuille & Commande publique',
    summary: 'Deux nouveaux modules de pilotage : Portefeuille (vue consolidée de plusieurs roadmaps) et Commande publique (demandes d\'achat, gouvernance projet, approbations). La Roadmap gagne statuts, responsables, validation des dépendances et export CSV.',
    sections: [
      {
        heading: '🗂️ Module Portefeuille (nouveau)',
        items: [
          'Regroupez plusieurs roadmaps dans un portefeuille et suivez-les sur une timeline consolidée',
          'Légende cliquable par roadmap (couleur) qui sert aussi de filtre',
          'Un clic sur un item ouvre sa roadmap source pour l\'éditer',
          'Partage par rôle : un accès au portefeuille donne un accès en lecture aux roadmaps rattachées, sans partage individuel',
          'Rattachez / détachez vos roadmaps librement — supprimer un portefeuille ne supprime jamais les roadmaps',
        ],
      },
      {
        heading: '🏛️ Module Commande publique (nouveau)',
        items: [
          'Demandes d\'achat avec circuit de validation hiérarchique par seuils d\'approbation et délégations',
          'Gouvernance projet (Activités) : jalons PMPG, risques, budget OPEX/CAPEX/APCO, agrégation par Produit',
          'Organigramme et référentiels lus depuis des services externes (PGI / LDAP) — pods de démonstration inclus en dev',
          'Référentiels configurables par organisation avec héritage descendant (types de jalon, de budget, d\'activité)',
          'Transparence : lecture libre sur toute l\'organisation, édition restreinte à son périmètre',
        ],
      },
      {
        heading: '🗺️ Roadmap — pilotage renforcé',
        items: [
          'Statut par item (À faire / En cours / Bloqué / Terminé) avec badge et filtre',
          'Responsable par item, choisi parmi les collaborateurs de la roadmap, avec filtre dédié',
          'Dépendances validées : plus de cycle ni de référence morte possible (contrôle serveur)',
          'Export CSV (compatible Excel) en plus des exports PDF et JSON',
        ],
      },
      {
        heading: '🔧 Divers',
        items: [
          'Tests d\'autorisation systématiques ajoutés sur les modules Capacité et MeetOps',
          'Pastille « nouvelle version » fiabilisée : deux releases le même jour rallument bien l\'indicateur',
          'Mises à jour de sécurité des actions CI (dependabot)',
        ],
      },
    ],
  },
  {
    version: '0.27.0',
    date: '2026-07-02',
    title: 'Modules Formulaires & Parcours',
    summary: 'Deux nouveaux modules : Formulaires (type Google Forms, lien public et collecte de réponses) et Parcours (workflows structurés avec builder visuel). Plus : relances SignDoc fiabilisées, Feedback dans la navbar, export RGPD réparé.',
    sections: [
      {
        heading: '🧭 Module Parcours (nouveau)',
        items: [
          'Concevez des workflows structurés dans un builder visuel (graphe d\'étapes reliées)',
          'Étapes de type formulaire, document, validation — avec conditions d\'enchaînement',
          'Lancez des instances depuis un template et suivez leur progression étape par étape',
          'Historique complet de chaque parcours et panneau de détail par étape',
          'Webhooks entrants pour déclencher des avancements depuis l\'extérieur',
        ],
      },
      {
        heading: '📋 Module Formulaires (nouveau)',
        items: [
          'Constructeur visuel : 11 types de champs (texte court/long, nombre, date, email, liste, choix unique/multiple, échelle, fichier, grille) + sauts de section',
          'Partage par lien public : les répondants n\'ont pas besoin de compte',
          'Options de collecte : limite d\'une réponse par personne, date de fermeture automatique, nombre maximum de réponses',
          'Notification à chaque réponse (optionnelle) et email de confirmation au répondant',
          'Vue des réponses : résumé agrégé par question + détail réponse par réponse',
          'Partage du formulaire par rôle (Lecteur / Éditeur / Propriétaire)',
        ],
      },
      {
        heading: '🔧 Corrections',
        items: [
          'SignDoc : relances et expirations automatiques fonctionnent désormais sans Redis (verrou Postgres) — elles étaient inactives en production',
          'Export RGPD « Mes données » réparé : le téléchargement échouait car la requête n\'était pas authentifiée',
        ],
      },
      {
        heading: '🎨 Divers',
        items: [
          'Hub : page d\'accueil restructurée par domaine pour s\'y retrouver parmi les 14 modules',
          'Accès direct au Feedback depuis la barre de navigation (icône bulle, à côté de l\'aide)',
          'Feedback : correction du vote (état préservé lors des mises à jour temps réel)',
        ],
      },
    ],
  },
  {
    version: '0.26.0',
    date: '2026-07-02',
    title: 'Module SignDoc — signature de documents',
    summary: 'Nouveau module SignDoc : faites signer vos PDF avec workflow de signataires, page publique de signature, sceau numérique et certificat de réalisation.',
    sections: [
      {
        heading: '✍️ Module SignDoc (nouveau)',
        items: [
          'Créez une demande de signature depuis un PDF (upload ou import PDF Manager)',
          'Atelier visuel : placez les champs Signature / Paraphe / Date / Texte par glisser-déposer, multi-pages',
          'Signataires internes (compte) ou externes (lien email sécurisé, sans compte)',
          'Routage séquentiel (chacun son tour) ou parallèle, échéance globale et par signataire',
          'Signature au choix : dessin à main levée, saisie stylisée (3 polices) ou import d\'image',
          'Destinataires en copie (CC) : lien de consultation à l\'envoi, document final à la complétion',
          'Refus motivé possible ; le propriétaire est notifié à chaque étape (in-app + email)',
        ],
      },
      {
        heading: '🛡️ Preuve et intégrité',
        items: [
          'Document original figé et empreinte SHA-256 calculée à la création',
          'Journal d\'événements inviolable (chaîne de hachage) : consultation, signature, refus, relance… tout est tracé',
          'À la complétion : PDF final avec signatures apposées + page « certificat de réalisation »',
          'Sceau numérique PAdES du serveur : toute modification ultérieure du PDF est détectable (vérifiable dans Adobe Reader)',
          'Bouton « Vérifier » : contrôle d\'intégrité du fichier et de la chaîne de preuve à tout moment',
        ],
      },
      {
        heading: '⏰ Suivi automatique',
        items: [
          'Relances automatiques des signataires à l\'approche de l\'échéance (max 1 / 20 h)',
          'Expiration automatique des demandes dont la date limite globale est dépassée',
          'Alerte au propriétaire quand un signataire dépasse son échéance individuelle',
        ],
      },
      {
        heading: '🎨 Divers',
        items: [
          'Icône colorée du module devant le titre de chaque page (Boards, Capacité, Daily, MeetOps, PDF, Quiz, Roadmap, Scrum, SignDoc, Roue, Cahiers de tests)',
          'L\'outil Tableau des boards est désormais toujours disponible (feature flag retiré)',
          'Le panneau admin des feature flags ne liste plus que les modules',
        ],
      },
    ],
  },
  {
    version: '0.25.0',
    date: '2026-07-01',
    title: 'Module Feedback — kanban retours & idées',
    summary: 'Nouveau module Feedback : kanban 5 colonnes pour remonter bugs et idées, avec votes, édition, suppression et navigation temps réel.',
    sections: [
      {
        heading: '💬 Module Feedback (nouveau)',
        items: [
          'Kanban 5 colonnes : Analyse → Backlog → Implémentation → Parking → Fait',
          'Création de tickets publique (sans compte) avec type Bug / Fonctionnalité',
          'Vote par ticket (toggle, compte mis à jour en temps réel pour tous)',
          'Édition inline : auteur ou admin peuvent modifier titre, description et type',
          'Suppression et déplacement inter-colonnes réservés aux admins',
          'Navigation bidirectionnelle (flèches ←→) sur chaque carte pour les admins',
          'Temps réel via Socket.io : création, mise à jour, déplacement, suppression et vote diffusés instantanément',
          'Mise en page plein écran (largeur et hauteur maximales)',
        ],
      },
    ],
  },
  {
    version: '0.24.0',
    date: '2026-06-28',
    title: 'PDF Manager — bibliothèque, dossiers, tags, exports',
    summary: 'Nouveau module PDF Manager : bibliothèque centralisée, dossiers, tags, éditeur de pages et exports variés. Corrections sur le module Capacité.',
    sections: [
      {
        heading: '📄 PDF Manager (nouveau module)',
        items: [
          'Upload de PDFs, renommage inline, duplication et fusion de documents',
          'Organisation en dossiers (arborescence) et tags par carte',
          'Déplacement de documents par drag-and-drop vers les dossiers',
          'Éditeur de pages : réordonnage DnD, rotation, extraction, split',
          'Barre de recherche par nom et tri (Nom / Date / Taille / Pages)',
          'Exports : PDF brut, texte extrait, images ZIP, DOCX/MD si pandoc présent',
          'Visualisation dans le navigateur avec authentification Bearer automatique',
        ],
      },
      {
        heading: '🔧 Module Capacité — corrections',
        items: [
          'Date « Au » de l\'absence initialisée sur la fin de l\'événement (et non son début)',
          'Erreurs API désormais visibles sous le formulaire (plus d\'échec silencieux)',
          'Suppression d\'un membre ou d\'une absence : confirmation Oui / Non requise',
          'Validation frontend : date fin < date début bloquée avant l\'appel API',
        ],
      },
    ],
  },
  {
    version: '0.23.0',
    date: '2026-06-27',
    title: 'Quiz amélioré — séries, timer adaptatif, options libres',
    summary: 'Module Quiz enrichi : meilleure série par participant, timer réel par question, jusqu\'à 8 options, mode sans limite de temps, et application en masse des réglages.',
    sections: [
      {
        heading: '🧠 Module Quiz',
        items: [
          '**Meilleure série (🔥)** : la série consécutive maximale de chaque participant est mémorisée et affichée dans le classement final et l\'historique des sessions.',
          'Série en cours visible dans le classement intermédiaire (entre chaque question).',
          '**Timer adaptatif** : la barre de progression utilise maintenant la durée réelle de la question (fin du bug 30 s codé en dur).',
          '**Mode sans limite de temps** (Illimité) : pas de compte à rebours, pas de révélation automatique — le host avance manuellement.',
          '**Options dynamiques** : de 2 à 8 options par question (A → H), avec boutons d\'ajout et de suppression inline.',
          '**Application en masse** : un panel dans l\'éditeur permet d\'appliquer la même durée ou le même nombre de points à toutes les questions d\'un coup.',
        ],
      },
      {
        heading: '📅 MeetOps — Calendrier',
        items: [
          'Vue détail d\'un événement : calendrier complet façon Outlook (semaine, semaine de travail, jour, agenda) en remplacement de la vue mois.',
          'Glisser-déposer et redimensionnement des réunions directement sur le calendrier.',
          'Création rapide par clic ou par tracé sur le calendrier (QuickCreate).',
          'Menu contextuel sur chaque réunion (renommer, changer le statut, supprimer).',
          'Réunions annulées affichées en rayé.',
        ],
      },
      {
        heading: '🏠 Hub & Aide',
        items: [
          'Correction des liens dans la section "Récents" : boards, daily et scrum pointer désormais vers la bonne page.',
          'Page Aide : nouvelle section **Raccourcis clavier** listant tous les raccourcis des Boards et du calendrier MeetOps.',
        ],
      },
    ],
  },
  {
    version: '0.22.0',
    date: '2026-06-25',
    title: 'Module Roadmap — planification visuelle façon Gantt',
    summary: 'Nouveau module de planification d\'équipe : Gantt interactif, jalons, filtres, glisser-déposer sur les barres et export PDF vectoriel.',
    sections: [
      {
        heading: '🗓️ Module Roadmap',
        items: [
          'Nouveau module **Roadmap** : planifiez vos projets avec une timeline Gantt interactive (5 échelles : semaine, mois, trimestre, semestre, an).',
          'Items configurables : domaine (Infra / Dev / Cyber), risque (Faible / Moyen / Élevé), priorité (Should / Must), valeur business, dépendances.',
          'Jalons (date unique) : affichés sous forme de diamant ⬦ au bon point de la timeline.',
          '**Drag & drop sur le Gantt** : déplacez une barre ou étirez-la par ses poignées pour ajuster les dates directement depuis la vue.',
          'Dépendances visuelles entre items (flèches bezier) avec toggle d\'affichage.',
          '**Filtres** combinables par domaine, risque et priorité Must — compteur items filtrés/total.',
          '**Export PDF vectoriel** : Gantt A4 paysage, paginé, dessiné depuis les données (indépendant du zoom/scroll).',
          'Export JSON pour sauvegarder ou partager un plan.',
          'Partage par rôle (Lecteur / Éditeur / Owner) sur le même patron que les autres modules.',
          'Gating via feature flag `module.roadmap` (activé par défaut).',
        ],
      },
    ],
  },
  {
    version: '0.21.0',
    date: '2026-06-25',
    title: 'Sessions plus longues et fiables',
    summary: 'Votre session dure désormais une demi-journée (4 h) et se renouvelle automatiquement tant que vous travaillez — fini les déconnexions inopinées et les pertes de page au rafraîchissement.',
    sections: [
      {
        heading: '🔐 Session',
        items: [
          'Durée de session portée à 4 heures (une demi-journée) : plus besoin de se reconnecter en pleine journée de travail.',
          'Renouvellement automatique et continu tant que vous êtes actif — y compris au retour de veille de l\'ordinateur ou en revenant sur l\'onglet.',
          'Fini les déconnexions « fantômes » : certaines actions semblaient fonctionner alors que la session était perdue, et tout disparaissait au rafraîchissement. Corrigé.',
          'Plus robuste face aux coupures réseau : une tentative de renouvellement qui échoue est désormais réessayée au lieu d\'abandonner la session.',
        ],
      },
      {
        heading: '⚡ Sous le capot',
        items: [
          'Tableau blanc : 2 requêtes base de données redondantes supprimées à l\'ouverture d\'un board et au partage par lien.',
        ],
      },
    ],
  },
  {
    version: '0.20.0',
    date: '2026-06-23',
    title: 'Quiz Kahoot, partage étendu, images & une surprise',
    summary: 'Nouveau module Quiz interactif style Kahoot, partage par rôle étendu à La Roue, Capacité et MeetOps, import d\'images par glisser-déposer, aperçu de liens dans les tickets — et une feature cachée à découvrir.',
    sections: [
      {
        heading: '🎯 Quiz interactif (style Kahoot)',
        items: [
          'Nouveau module Quiz : créez vos quiz (questions à choix multiples, timer, points), réordonnez les questions par glisser-déposer.',
          'Sessions live en temps réel : code d\'accès 6 caractères, participants anonymes, révélation des réponses et classement instantanés.',
          'Multiplicateur de série (streak) : les bonnes réponses consécutives multiplient les points — bonus de rapidité inclus.',
          'Podium final animé à la fin de chaque session.',
        ],
      },
      {
        heading: '🔗 Partage étendu',
        items: [
          'La Roue, Capacité d\'équipe et MeetOps sont désormais partageables par rôle (Lecteur / Éditeur), sur le même modèle que les boards et les salles Scrum/Daily.',
          'Les éditeurs d\'un board ont désormais accès à l\'import, l\'export, les paramètres et la gestion des partages (rôles Lecteur et Éditeur uniquement).',
        ],
      },
      {
        heading: '🖼️ Tableau blanc — Images',
        items: [
          'Importez une image locale via la barre d\'outils, collez-la (Ctrl+V) ou faites-la glisser directement depuis votre explorateur de fichiers.',
          'Outil de rognage : 8 poignées de redimensionnement, grille des tiers, recadrage pixel-perfect en un clic.',
          'Prise en charge des images jusqu\'à 50 Mo (PNG, JPG, GIF, WebP, BMP).',
        ],
      },
      {
        heading: '🔗 Tableau blanc — Aperçu de liens',
        items: [
          'Collez une URL dans un ticket texte : un aperçu enrichi (image, titre, domaine) apparaît automatiquement en bas de la carte.',
          'L\'URL brute est masquée en mode affichage — elle reste visible et éditable en mode édition.',
        ],
      },
      {
        heading: '✅ Tableau blanc — Sélection & corrections',
        items: [
          'Sélection multiple au lasso : seuls les objets entièrement dans le rectangle sont capturés — les grandes formes de zone ne sont plus sélectionnées par erreur.',
        ],
      },
      {
        heading: '🎨 Interface',
        items: [
          'Nouveau logo hexagone Pivot sur l\'écran de connexion, le favicon et la barre de navigation.',
          'Scrum Poker : le code de salle copie désormais directement le lien d\'invitation.',
        ],
      },
      {
        heading: '🎮 Feature mystère',
        items: [
          'Quelque chose de nouveau se cache dans Pivot… Un indice se trouve dans la section Aide. À vous de trouver.',
        ],
      },
    ],
  },
  {
    version: '0.19.0',
    date: '2026-06-20',
    title: 'Correctifs board, sessions & Scrum',
    summary: 'Nombreux correctifs sur le tableau blanc (hitbox des formes, étiquettes, zoom, timer, paramètres) et correction critique de la session : l\'animateur voit enfin les résultats d\'activité en temps réel.',
    sections: [
      {
        heading: '🎨 Tableau blanc',
        items: [
          'Les fonctionnalités désactivées dans les paramètres du board (vote, timer, dessin, cadres, champs) sont masquées dans l\'interface ; le plafond de participants est respecté à la connexion.',
          'La zone cliquable des formes, traits et dessins épouse leur géométrie exacte — plus de zone morte autour.',
          'Les étiquettes texte sont déplaçables sans gêne des poignées d\'ancrage ; elles s\'auto-redimensionnent au contenu après édition et ne passent plus à la ligne quel que soit le zoom.',
          'Les items créés (sticky, forme, étiquette…) ont une taille à l\'écran identique quel que soit le niveau de zoom au moment de la création.',
          'Le timer affiche un décompte exact même si l\'horloge du navigateur est décalée par rapport au serveur.',
          'Le nuage de mots regroupe les variantes proches (casse, accents, pluriel simple) en un seul mot pondéré.',
          'Corrections mineures : z-index des cartes confinés, barre de connexion fermée au changement d\'outil.',
        ],
      },
      {
        heading: '🎬 Sessions & activités',
        items: [
          'Correction critique : l\'animateur voit les résultats d\'une activité en temps réel après l\'avoir lancée (handler socket supprimé au chargement du board — bug résolu).',
        ],
      },
      {
        heading: '🎯 Scrum Poker',
        items: [
          'Le lien d\'invitation est affiché sous le code de salle avec un bouton « Copier », plutôt qu\'en texte clair difficilement sélectionnable.',
        ],
      },
    ],
  },
  {
    version: '0.18.0',
    date: '2026-06-18',
    title: 'Aperçu des liens & couverture de board',
    summary: 'Les cartes lien affichent un aperçu enrichi (image, titre, nom du site) et deviennent éditables, et vous pouvez définir l\'image de couverture d\'un board par import de fichier.',
    sections: [
      {
        heading: '🔗 Cartes lien',
        items: [
          'Coller une URL crée une carte qui se transforme automatiquement en aperçu : image Open Graph, titre et nom du site.',
          'L\'URL d\'une carte lien est désormais modifiable (bouton crayon au survol, ou double-clic).',
        ],
      },
      {
        heading: '🖼️ Couverture de board',
        items: [
          'Définissez l\'image de couverture d\'un board par import de fichier, au lieu de coller un lien.',
        ],
      },
    ],
  },
  {
    version: '0.17.0',
    date: '2026-06-18',
    title: 'Cahiers de tests, partage d\'équipes & ateliers enrichis',
    summary: 'Un nouveau module interactif de Cahiers de tests, le partage d\'équipes et de salles, le retrait de participants et l\'import Excel dans Scrum Poker, des statistiques de Daily, une vraie gestion des activités en session, et un Hub aux icônes plus pro.',
    sections: [
      {
        heading: '🧪 Nouveau module : Cahiers de tests',
        items: [
          'Créez des cahiers de tests structurés en sections et cas de test, directement dans l\'application.',
          'Chaque cas porte un statut (À faire, OK, KO, Bloqué, Ignoré) ; une barre de progression multi-couleurs résume l\'avancement du cahier.',
          'Déplier / replier chaque section ou tout le cahier d\'un clic, et faire évoluer le statut global (Brouillon, En revue, Approuvé, Archivé).',
        ],
      },
      {
        heading: '🤝 Partage & équipes',
        items: [
          'Partagez une équipe par e-mail en Lecteur (consultation) ou Éditeur (gestion du roster), comme pour les tableaux et sessions.',
          'Partagez une salle Scrum Poker à une équipe entière enregistrée dans « Mes équipes » en une seule action.',
        ],
      },
      {
        heading: '🎯 Scrum Poker',
        items: [
          'Le propriétaire peut retirer un participant ou vider entièrement la salle.',
          'Import de tickets en masse via un fichier Excel, avec un modèle téléchargeable pour démarrer.',
        ],
      },
      {
        heading: '📅 Daily',
        items: [
          'Nouveau panneau de statistiques : durée sur la période, intervenants les plus bavards, taux de participation.',
          'Le nom de la session est désormais pré-rempli au format « Daily - JJ/MM/AAAA ».',
        ],
      },
      {
        heading: '🎬 Sessions & activités',
        items: [
          'Véritable interface de gestion des activités en session : liste des participants mise à jour en temps réel et suivi des résultats.',
        ],
      },
      {
        heading: '✨ Interface',
        items: [
          'Le Hub remplace les emoji décoratifs par un jeu d\'icônes homogène et plus professionnel (le 👋 de bienvenue reste).',
        ],
      },
    ],
  },
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
