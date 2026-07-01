'use client'

import React from 'react'
import Link from 'next/link'
import { APP_VERSION } from '@/lib/version'

const MODULES = [
  {
    icon: '🗂️',
    title: 'Boards collaboratifs',
    href: '/dashboard',
    desc: 'Tableaux blancs temps réel pour vos ateliers, rétrospectives et brainstormings.',
    features: [
      'Cartes texte, image, formes, dessins libres et libellés',
      'Liaisons entre cartes (droites, courbes ou orthogonales)',
      'Cadres actifs pour déplacer un groupe d\'objets d\'un bloc',
      'Couches (fond · principal · avant-plan) pour organiser la profondeur',
      'Groupes avec couleur de contour partagée entre participants',
      'Import depuis Klaxoon (.klx), PDF ou image ; export PDF, PNG, Excel',
      'Copier-coller d\'éléments entre boards',
      'Annuler / Rétablir (Ctrl+Z / Ctrl+Y)',
    ],
  },
  {
    icon: '📡',
    title: 'Sessions live',
    href: '/dashboard',
    desc: 'Animez des ateliers interactifs avec vos équipes en temps réel depuis un board.',
    features: [
      'Créer une session depuis n\'importe quel board, partager le code ou le lien',
      'Activités : Sondage, Nuage de mots, Brainstorming, Q&A',
      'Les membres authentifiés du board participent directement, sans lien distinct',
      'Reconnexion automatique après une coupure réseau ou un rafraîchissement de page',
    ],
  },
  {
    icon: '🧠',
    title: 'Quiz interactif',
    href: '/quiz',
    desc: 'Créez des quiz en direct avec classement, séries et timer par question.',
    features: [
      'Éditeur de questions : texte, 2 à 8 options (A → H), bonne réponse à désigner',
      'Durée configurable par question (10 s à 2 min) ou mode sans limite de temps',
      'Points configurables (500 / 1 000 / 2 000) et application en masse sur toutes les questions',
      'Participants anonymes : rejoindre via code ou lien, sans compte',
      'Classement en direct après chaque question avec série en cours (🔥)',
      'Meilleure série mémorisée et affichée dans le classement final et l\'historique',
      'Historique des sessions passées avec podium et meilleures séries',
    ],
  },
  {
    icon: '🃏',
    title: 'Scrum Poker',
    href: '/scrum',
    desc: 'Estimez vos tickets d\'équipe de façon anonyme, puis révélez les votes simultanément.',
    features: [
      'Échelle Fibonacci (1, 2, 3, 5, 8, 13…) ou Temps (0,5h, 1h, 2h…)',
      'Vote masqué jusqu\'à la révélation groupée',
      'Plusieurs rooms indépendantes avec leurs propres tickets',
      'Reconnexion automatique en cours de session',
    ],
  },
  {
    icon: '⏱️',
    title: 'Daily Standup',
    href: '/daily',
    desc: 'Animez vos réunions de suivi quotidien avec un timer par participant.',
    features: [
      'Équipes persistées, membres réordonnables',
      'Timer individuel avec dépassement visible',
      'Historique des sessions par équipe',
      'Mode "Passer" pour sauter un participant absent',
    ],
  },
  {
    icon: '🎡',
    title: 'La Roue',
    href: '/wheel',
    desc: 'Tirage aléatoire pondéré pour désigner des volontaires ou former des groupes.',
    features: [
      'Mode Équilibré : réduit la probabilité des personnes récemment tirées',
      'Mode Aléatoire pur : probabilité identique pour tous',
      'Exclusion temporaire de membres, réinitialisation en un clic',
      'Historique des tirages et regroupement par événement',
    ],
  },
  {
    icon: '📊',
    title: 'Capacité',
    href: '/capacity',
    desc: 'Planifiez la charge de votre équipe sur plusieurs sprints ou périodes.',
    features: [
      'Gestion des membres d\'équipe avec taux d\'occupation (FTE)',
      'Planification par sprint : capacité disponible vs charge estimée',
      'Visualisation synthétique de la charge par membre et par sprint',
      'Partage par rôle (Lecteur / Éditeur) sur le même patron que les boards',
    ],
  },
  {
    icon: '🗓️',
    title: 'Roadmap',
    href: '/roadmap',
    desc: 'Planifiez vos projets avec un Gantt interactif et des jalons visuels.',
    features: [
      'Timeline Gantt interactive (5 échelles : semaine, mois, trimestre, semestre, an)',
      'Items configurables : domaine, risque, priorité, valeur business, dépendances',
      'Jalons affichés en diamant ⬦ sur la timeline',
      'Drag & drop sur les barres pour déplacer ou redimensionner les items',
      'Dépendances visuelles entre items (flèches bézier)',
      'Export PDF vectoriel A4 paysage et export JSON',
      'Partage par rôle (Lecteur / Éditeur / Owner)',
    ],
  },
  {
    icon: '📅',
    title: 'MeetOps',
    href: '/meetops',
    desc: 'Gérez vos événements récurrents et animez vos réunions d\'équipe.',
    features: [
      'Événements récurrents avec liste de réunions planifiées',
      'Calendrier complet façon Outlook : vues Mois, Semaine, Semaine de travail, Jour, Agenda',
      'Glisser-déposer et redimensionnement des réunions sur le calendrier',
      'Création rapide par clic ou tracé sur le calendrier',
      'Menu contextuel : renommer, changer le statut (annulée…), supprimer',
      'Partage par rôle (Lecteur / Éditeur / Owner)',
    ],
  },
  {
    icon: '📄',
    title: 'PDF Manager',
    href: '/pdf',
    desc: 'Bibliothèque centralisée de PDFs avec organisation en dossiers, tags et exports variés.',
    features: [
      'Upload, renommage, duplication et fusion de documents PDF',
      'Organisation en dossiers (arborescence) et tags par carte',
      'Éditeur de pages : réordonnage drag-and-drop, rotation, extraction, split',
      'Barre de recherche par nom et tri (Nom / Date / Taille / Pages)',
      'Exports : PDF brut, texte extrait, images ZIP, DOCX/Markdown si pandoc présent',
      'Partage par rôle (Lecteur / Éditeur / Owner)',
    ],
  },
  {
    icon: '✍️',
    title: 'SignDoc',
    href: '/signdoc',
    desc: 'Espace de signature de documents : workflow de signataires, échéances et preuve inviolable.',
    features: [
      'Création d’une demande depuis un PDF importé ou la bibliothèque PDF Manager',
      'Signataires multiples, ordre séquentiel ou parallèle, échéance globale et par étape',
      'Designer de champs glisser-déposer (Signature / Paraphe / Date / Texte) par signataire',
      'Document figé à la création + chaîne d’événements inviolable (anti-altération)',
      'Partage du pilotage par rôle (Lecteur / Éditeur / Owner)',
    ],
  },
  {
    icon: '👤',
    title: 'Compte & Profil',
    href: '/profile',
    desc: 'Gérez votre identité et vos préférences sur la plateforme.',
    features: [
      'Inscription avec vérification de l\'adresse email',
      'Réinitialisation du mot de passe par email',
      'Personnalisation : nom, bio, avatar',
      'Thème clair ou sombre, synchronisé sur toute l\'interface',
      'Notifications d\'activité (partage, changement de rôle) et notes de version',
      'Suppression définitive du compte depuis le profil',
    ],
  },
]

const SHORTCUTS: { module: string; icon: string; groups: { label: string; items: { keys: string[]; desc: string }[] }[] }[] = [
  {
    module: 'Boards', icon: '🗂️',
    groups: [
      {
        label: 'Historique',
        items: [
          { keys: ['Ctrl', 'Z'],          desc: 'Annuler la dernière action' },
          { keys: ['Ctrl', 'Y'],          desc: 'Rétablir' },
          { keys: ['Ctrl', 'Shift', 'Z'], desc: 'Rétablir (variante Mac)' },
        ],
      },
      {
        label: 'Sélection & édition',
        items: [
          { keys: ['Ctrl', 'A'],         desc: 'Sélectionner tous les éléments' },
          { keys: ['Ctrl', 'C'],         desc: 'Copier la sélection' },
          { keys: ['Ctrl', 'V'],         desc: 'Coller (même entre boards)' },
          { keys: ['Ctrl', 'D'],         desc: 'Dupliquer la sélection en place' },
          { keys: ['Suppr', 'Backspace'], desc: 'Supprimer les éléments sélectionnés' },
        ],
      },
      {
        label: 'Déplacement',
        items: [
          { keys: ['←', '↑', '→', '↓'],          desc: 'Déplacer la sélection de 1 px' },
          { keys: ['Shift', '←', '↑', '→', '↓'], desc: 'Déplacer la sélection de 20 px' },
        ],
      },
      {
        label: 'Navigation & outils',
        items: [
          { keys: ['Molette'],           desc: 'Zoomer / dézoomer (centré sur le curseur)' },
          { keys: ['Ctrl', 'Molette'],   desc: 'Zoom précis (ou pincement trackpad)' },
          { keys: ['Clic molette'],      desc: 'Déplacer le board (clic + glisser)' },
          { keys: ['Espace'],            desc: 'Déplacer le board temporairement (maintenu)' },
          { keys: ['V'],                 desc: 'Passer en mode Sélection' },
          { keys: ['Échap'],            desc: 'Désélectionner / fermer les panneaux actifs' },
        ],
      },
    ],
  },
  {
    module: 'MeetOps — Calendrier', icon: '📅',
    groups: [
      {
        label: 'Vues',
        items: [
          { keys: ['1'], desc: 'Vue Mois' },
          { keys: ['2'], desc: 'Vue Semaine' },
          { keys: ['3'], desc: 'Vue Semaine de travail' },
          { keys: ['4'], desc: 'Vue Jour' },
          { keys: ['5'], desc: 'Vue Agenda' },
        ],
      },
      {
        label: 'Navigation',
        items: [
          { keys: ['←'],     desc: 'Période précédente (semaine / mois / jour selon la vue)' },
          { keys: ['→'],     desc: 'Période suivante' },
          { keys: ['T'],     desc: "Revenir à aujourd'hui" },
          { keys: ['Échap'], desc: 'Fermer le popup ou la création rapide' },
        ],
      },
    ],
  },
]

// Matrice des rôles sur un board (source de vérité : MATRICE-ROLES.md / gardes serveur)
type RoleAccess = 'yes' | 'no' | 'vote' // 'vote' = ✅ si désigné votant
const ROLE_MATRIX: { group: string; rows: { action: string; owner: RoleAccess; editor: RoleAccess; viewer: RoleAccess }[] }[] = [
  {
    group: 'Consultation',
    rows: [
      { action: 'Voir le board, les curseurs, les résultats de votes', owner: 'yes', editor: 'yes', viewer: 'yes' },
      { action: 'Exporter le board, le mettre en favori', owner: 'yes', editor: 'yes', viewer: 'yes' },
    ],
  },
  {
    group: 'Contenu',
    rows: [
      { action: 'Créer, modifier, déplacer, supprimer des cartes', owner: 'yes', editor: 'yes', viewer: 'no' },
      { action: 'Dessins, formes, connexions, cadres (max 2), champs', owner: 'yes', editor: 'yes', viewer: 'no' },
      { action: 'Importer un board Klaxoon', owner: 'yes', editor: 'yes', viewer: 'no' },
      { action: 'Réinitialiser le board (annulable Ctrl+Z)', owner: 'yes', editor: 'no', viewer: 'no' },
    ],
  },
  {
    group: 'Animation',
    rows: [
      { action: 'Lancer, clôturer, prolonger un vote', owner: 'yes', editor: 'yes', viewer: 'no' },
      { action: 'Voter', owner: 'vote', editor: 'vote', viewer: 'vote' },
      { action: 'Démarrer / arrêter le timer', owner: 'yes', editor: 'yes', viewer: 'no' },
      { action: 'Démarrer, animer et fermer une session live', owner: 'yes', editor: 'yes', viewer: 'no' },
    ],
  },
  {
    group: 'Administration',
    rows: [
      { action: 'Renommer le board, changer les paramètres', owner: 'yes', editor: 'no', viewer: 'no' },
      { action: 'Gérer le lien de partage (rôle max : Éditeur)', owner: 'yes', editor: 'no', viewer: 'no' },
      { action: 'Inviter des membres, changer les rôles, nommer des co-propriétaires', owner: 'yes', editor: 'no', viewer: 'no' },
      { action: 'Supprimer le board', owner: 'yes', editor: 'no', viewer: 'no' },
    ],
  },
]

function AccessCell({ value }: { value: RoleAccess }) {
  if (value === 'yes') return <span className="text-emerald-500" aria-label="Autorisé">✓</span>
  if (value === 'vote') return <span className="text-amber-700 dark:text-amber-400 text-[10px] font-medium whitespace-nowrap" aria-label="Si désigné votant">si votant</span>
  return <span className="text-gray-300 dark:text-gray-600" aria-label="Non autorisé">—</span>
}

// Section dépliable : <details> natif (clavier + lecteurs d'écran gratuits).
function CollapsibleSection({ title, subtitle, defaultOpen = false, children }: {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex items-center gap-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden rounded-lg -mx-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  )
}

const TEST_BOOKS = [
  { module: 'Dashboard / Hub', file: 'CT-v0.15.1-dashboard.pdf', tests: 32, pages: 2 },
  { module: 'Boards éditeur',  file: 'CT-v0.19.0-boards.pdf',    tests: 91, pages: 6 },
  { module: 'Sessions live',   file: 'CT-v0.19.0-sessions.pdf',  tests: 43, pages: 3 },
  { module: 'Scrum Poker',     file: 'CT-v0.15.1-scrum.pdf',     tests: 36, pages: 3 },
  { module: 'Daily Standup',   file: 'CT-v0.15.1-daily.pdf',     tests: 28, pages: 2 },
  { module: 'La Roue',         file: 'CT-v0.15.1-roue.pdf',      tests: 39, pages: 3 },
  { module: 'Capacité',        file: 'CT-v0.15.1-capacite.pdf',  tests: 27, pages: 2 },
  { module: 'MeetOps',         file: 'CT-v0.15.1-meetops.pdf',   tests: 47, pages: 3 },
  { module: 'Compte / Profil', file: 'CT-v0.15.1-compte.pdf',    tests: 44, pages: 3 },
]

export default function AidePage() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Aide & Documentation</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Retrouvez ici le guide des fonctionnalités et les cahiers de tests téléchargeables.
        </p>
      </div>

      {/* Modules overview */}
      <CollapsibleSection title="Fonctionnalités">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((m) => (
            <div
              key={m.title}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{m.icon}</span>
                <span className="font-semibold text-gray-900 dark:text-white text-sm">{m.title}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{m.desc}</p>
              <ul className="space-y-1">
                {m.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <span className="mt-0.5 shrink-0 text-primary-400">·</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Raccourcis clavier */}
      <CollapsibleSection title="Raccourcis clavier" subtitle="Disponibles sur les écrans concernés — hors champs de saisie.">
        <div className="flex flex-col gap-6">
          {SHORTCUTS.map((mod) => (
            <div key={mod.module}>
              <div className="flex items-center gap-2 mb-3">
                <span>{mod.icon}</span>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{mod.module}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mod.groups.map((group) => (
                  <div key={group.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{group.label}</span>
                    </div>
                    <table className="w-full text-xs">
                      <tbody>
                        {group.items.map((item) => (
                          <tr key={item.desc} className="border-t border-gray-50 dark:border-gray-800/60 first:border-0">
                            <td className="px-4 py-2 w-44 shrink-0">
                              <div className="flex flex-wrap gap-1">
                                {item.keys.map((k, i) => (
                                  <span key={i} className="inline-flex items-center gap-0.5">
                                    <kbd className="inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 shadow-[0_1px_0_0_rgba(0,0,0,0.15)]">
                                      {k}
                                    </kbd>
                                    {i < item.keys.length - 1 && <span className="text-gray-400 text-[10px]">+</span>}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{item.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Matrice des rôles */}
      <CollapsibleSection
        title="Rôles & permissions sur un board"
        subtitle="Propriétaire (et co-propriétaires), Éditeur, Lecteur — le lien de partage donne au maximum le rôle Éditeur."
      >
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left font-semibold text-gray-700 dark:text-gray-300 px-4 py-2.5">Action</th>
                <th className="text-center font-semibold text-gray-700 dark:text-gray-300 px-3 py-2.5 w-28">Propriétaire</th>
                <th className="text-center font-semibold text-gray-700 dark:text-gray-300 px-3 py-2.5 w-24">Éditeur</th>
                <th className="text-center font-semibold text-gray-700 dark:text-gray-300 px-3 py-2.5 w-24">Lecteur</th>
              </tr>
            </thead>
            <tbody>
              {ROLE_MATRIX.map((section) => (
                <React.Fragment key={section.group}>
                  <tr className="bg-gray-50/60 dark:bg-gray-800/30">
                    <td colSpan={4} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {section.group}
                    </td>
                  </tr>
                  {section.rows.map((row) => (
                    <tr key={row.action} className="border-t border-gray-100 dark:border-gray-800/60">
                      <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{row.action}</td>
                      <td className="text-center px-3 py-2"><AccessCell value={row.owner} /></td>
                      <td className="text-center px-3 py-2"><AccessCell value={row.editor} /></td>
                      <td className="text-center px-3 py-2"><AccessCell value={row.viewer} /></td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      {/* Guide complet download */}
      <CollapsibleSection title="Guide complet">
        <div className="bg-primary-50 dark:bg-primary-950/40 border border-primary-100 dark:border-primary-900 rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold text-primary-900 dark:text-primary-300 text-sm">Guide des fonctionnalités — v{APP_VERSION}</p>
            <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">
              Description détaillée de toutes les fonctionnalités de la plateforme.
            </p>
          </div>
          <a
            href="/aide/FEATURES.pdf"
            download
            className="shrink-0 inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <DownloadIcon />
            Télécharger le PDF
          </a>
        </div>
      </CollapsibleSection>

      {/* Test books */}
      <CollapsibleSection
        title="Cahiers de tests"
        subtitle="PDFs interactifs — cochez OK/KO et saisissez vos commentaires directement dans le fichier."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {TEST_BOOKS.map((t) => (
            <div
              key={t.file}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3"
            >
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm">{t.module}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                  {t.tests} tests · {t.pages} page{t.pages > 1 ? 's' : ''}
                </p>
              </div>
              <a
                href={`/aide/${t.file}`}
                download
                className="inline-flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:text-primary-600 dark:hover:border-primary-600 dark:hover:text-primary-400 text-gray-600 dark:text-gray-400 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors mt-auto"
              >
                <DownloadIcon />
                Télécharger
              </a>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Easter egg — lien discret vers les mini-jeux */}
      <div className="flex justify-end pt-2">
        <Link
          href="/games"
          title="..."
          className="text-gray-200 dark:text-gray-800 hover:text-gray-400 dark:hover:text-gray-600 transition-colors text-base select-none"
          tabIndex={-1}
        >
          🎮
        </Link>
      </div>

    </div>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}
