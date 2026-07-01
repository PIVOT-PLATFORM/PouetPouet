import type { ModuleManifest } from './manifest.js'

// Registre déclaratif des modules FORGE.
// F3.1 accompli : Team est un pivot du socle partagé par Daily, La Roue et Capacité.

export const POUETPOUET_MODULE: ModuleManifest = {
  id: 'pouetpouet',
  name: 'PouetPouet',
  description: 'Tableau blanc collaboratif temps réel',
  icon: '🧀',
  color: '#6366f1',
  nav: [{ label: 'Mes boards', href: '/dashboard', match: 'exact' }],
  apiPrefix: '/api/boards',
  ownedEntities: ['Board', 'Card', 'Frame', 'CardConnection', 'BoardField', 'BoardVoteSession', 'BoardTemplate'],
  referencedPivots: ['User'],
  emits: ['pouetpouet.board.imported'],
  listensTo: [],
}

export const SCRUM_MODULE: ModuleManifest = {
  id: 'scrum',
  name: 'Scrum Poker',
  description: "Estimation d'équipe en temps réel",
  icon: '🃏',
  color: '#f59e0b',
  nav: [{ label: 'Scrum Poker', href: '/scrum', match: '/scrum' }],
  apiPrefix: '/api/scrum',
  ownedEntities: ['ScrumRoom', 'ScrumTicket', 'ScrumVote'],
  referencedPivots: ['User'],
  emits: ['scrum.ticket.estimated'],
  // F3 : la vélocité estimée alimentera le module Capacité
  listensTo: [],
}

export const DAILY_MODULE: ModuleManifest = {
  id: 'daily',
  name: 'Daily',
  description: 'Stand-up minuté, tour de parole équitable',
  icon: '☀️',
  color: '#0ea5e9',
  nav: [
    { label: 'Mes dailys', href: '/daily', match: '/daily' },
    { label: 'Mes équipes', href: '/equipes', match: '/equipes' },
  ],
  apiPrefix: '/api/daily',
  ownedEntities: ['DailySession', 'DailyParticipant'],
  referencedPivots: ['User', 'Team'],
  emits: ['daily.session.ended'],
  listensTo: [],
}

export const WHEEL_MODULE: ModuleManifest = {
  id: 'wheel',
  name: 'La Roue',
  description: 'Tirage au sort animé',
  icon: '🎡',
  color: '#ec4899',
  nav: [{ label: 'La roue', href: '/wheel', match: '/wheel' }],
  apiPrefix: '/api/wheel',
  ownedEntities: ['WheelEvent', 'WheelDraw'],
  referencedPivots: ['Team'],
  emits: ['wheel.draw.completed'],
  listensTo: [],
}

export const CAPACITY_MODULE: ModuleManifest = {
  id: 'capacity',
  name: 'Capacité',
  description: "Planification de capacité d'équipe (PI / sprint / release)",
  icon: '📊',
  color: '#10b981',
  nav: [{ label: 'Capacité', href: '/capacity', match: '/capacity' }],
  apiPrefix: '/api/capacity',
  ownedEntities: ['CapacityEvent', 'CapacityEventMember', 'CapacityAbsence'],
  referencedPivots: ['User', 'Team'],
  emits: [],
  listensTo: ['scrum.ticket.estimated'],
}

export const MEETOPS_MODULE: ModuleManifest = {
  id: 'meetops',
  name: 'MeetOps',
  description: 'Gestion industrielle de réunions (événements, invitations Outlook/Teams, listes de diffusion)',
  icon: '🗓️',
  color: '#475569',
  nav: [{ label: 'MeetOps', href: '/meetops', match: '/meetops' }],
  apiPrefix: '/api/meetops',
  ownedEntities: ['MeetEvent', 'Meeting', 'MeetingParticipant', 'MeetDistList', 'MeetDistMember', 'MeetTemplate', 'MeetHistory'],
  referencedPivots: ['User'],
  // L'envoi/annulation des invitations alimentera Notifications et Audit (v2)
  emits: [],
  listensTo: [],
}

export const TESTBOOKS_MODULE: ModuleManifest = {
  id: 'testbooks',
  name: 'Cahiers de tests',
  description: 'Création et gestion de cahiers de tests structurés',
  icon: '🧪',
  color: '#8b5cf6',
  nav: [{ label: 'Cahiers de tests', href: '/cahiers-tests', match: '/cahiers-tests' }],
  apiPrefix: '/api/testbooks',
  ownedEntities: ['TestBook', 'TestSection', 'TestCase'],
  referencedPivots: ['User'],
  emits: [],
  listensTo: [],
}

export const QUIZ_MODULE: ModuleManifest = {
  id: 'quiz',
  name: 'Quiz interactif',
  description: 'Quiz interactif : questions en temps réel avec classement',
  icon: '🎯',
  color: '#e11d48',
  nav: [{ label: 'Quiz interactif', href: '/quiz', match: '/quiz' }],
  apiPrefix: '/api/quiz',
  ownedEntities: ['Quiz', 'QuizQuestion', 'QuizSession', 'QuizParticipant', 'QuizAnswer'],
  referencedPivots: ['User'],
  emits: [],
  listensTo: [],
}

export const ROADMAP_MODULE: ModuleManifest = {
  id: 'roadmap',
  name: 'Roadmap',
  description: 'Planification visuelle façon Gantt : jalons, dépendances, risques et priorités',
  icon: '🗺️',
  color: '#4f6ef7',
  nav: [{ label: 'Roadmap', href: '/roadmap', match: '/roadmap' }],
  apiPrefix: '/api/roadmap',
  ownedEntities: ['Roadmap', 'RoadmapItem'],
  referencedPivots: ['User'],
  emits: [],
  listensTo: [],
}

export const PDF_MODULE: ModuleManifest = {
  id: 'pdf',
  name: 'PDF Manager',
  description: 'Gestionnaire de PDF : fusion, découpage, extraction, rotation et conversion de pages',
  icon: '📄',
  color: '#dc2626',
  nav: [{ label: 'PDF Manager', href: '/pdf', match: '/pdf' }],
  apiPrefix: '/api/pdf',
  ownedEntities: ['PdfDocument'],
  referencedPivots: ['User'],
  emits: [],
  listensTo: [],
}

export const FEEDBACK_MODULE: ModuleManifest = {
  id: 'feedback',
  name: 'Feedback',
  description: 'Retours utilisateurs : bugs et demandes en kanban collaboratif (Analyse → Backlog → Implémentation → Parking → Fait)',
  icon: '💬',
  color: '#7c3aed',
  nav: [{ label: 'Feedback', href: '/feedback', match: '/feedback' }],
  apiPrefix: '/api/feedback',
  ownedEntities: ['FeedbackTicket', 'FeedbackVote'],
  referencedPivots: ['User'],
  emits: [],
  listensTo: [],
}

/** Modules actifs, dans l'ordre d'affichage de la navigation. */
export const PIVOT_MODULES: ModuleManifest[] = [
  POUETPOUET_MODULE,
  DAILY_MODULE,
  SCRUM_MODULE,
  WHEEL_MODULE,
  CAPACITY_MODULE,
  MEETOPS_MODULE,
  TESTBOOKS_MODULE,
  QUIZ_MODULE,
  ROADMAP_MODULE,
  PDF_MODULE,
  FEEDBACK_MODULE,
]
