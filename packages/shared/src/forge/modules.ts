import type { ModuleManifest } from './manifest.js'

// Registre déclaratif des modules FORGE.
// L'état actuel du code fait foi : les pivots (Team, User) sont encore dupliqués
// ou portés par un module — leur extraction vers le socle est l'objet de F3.

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
  // Team est destiné à devenir un pivot du socle (F3) : aujourd'hui Daily le possède.
  ownedEntities: ['DailySession', 'DailyParticipant', 'DailyTeam'],
  referencedPivots: ['User'],
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
  ownedEntities: [],
  referencedPivots: ['Team'],
  emits: ['wheel.spin.done'],
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
  ownedEntities: ['CapacityTeam', 'CapacityTeamMember', 'CapacityEvent', 'CapacityEventMember', 'CapacityAbsence'],
  // F3 : Team deviendra le pivot partagé avec Daily ; la vélocité réelle
  // pourra être alimentée par scrum.ticket.estimated
  referencedPivots: ['User', 'Team'],
  emits: [],
  listensTo: ['scrum.ticket.estimated'],
}

/** Modules actifs, dans l'ordre d'affichage de la navigation. */
export const FORGE_MODULES: ModuleManifest[] = [
  POUETPOUET_MODULE,
  DAILY_MODULE,
  SCRUM_MODULE,
  WHEEL_MODULE,
  CAPACITY_MODULE,
]
