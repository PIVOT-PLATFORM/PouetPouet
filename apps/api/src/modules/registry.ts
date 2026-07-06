import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { Server, Socket } from 'socket.io'
import type { ModuleManifest } from '@pouetpouet/shared'
import { POUETPOUET_MODULE, SCRUM_MODULE, DAILY_MODULE, WHEEL_MODULE, CAPACITY_MODULE, MEETOPS_MODULE, TESTBOOKS_MODULE, QUIZ_MODULE, ROADMAP_MODULE, PORTFOLIO_MODULE, PARCOURS_MODULE, FORMS_MODULE, PDF_MODULE, FEEDBACK_MODULE, SIGNDOC_MODULE, PROCUREMENT_MODULE, INNOVATION_MODULE, TODO_MODULE, PI_MODULE } from '@pouetpouet/shared'

import { boardRoutes } from './pouetpouet/boards.routes.js'
import { templateRoutes } from './pouetpouet/templates.routes.js'
import { boardSocketHandlers } from './pouetpouet/board.sockets.js'
import { voteSocketHandlers } from './pouetpouet/vote.sockets.js'
import { scrumRoutes } from './scrum/scrum.routes.js'
import { scrumSocketHandlers } from './scrum/scrum.sockets.js'
import { dailyRoutes } from './daily/daily.routes.js'
import { dailySocketHandlers } from './daily/daily.sockets.js'
import { wheelRoutes } from './wheel/wheel.routes.js'
import { capacityRoutes } from './capacity/capacity.routes.js'
import { meetopsRoutes } from './meetops/meetops.routes.js'
import { testbooksRoutes } from './testbooks/testbooks.routes.js'
import { quizRoutes } from './quiz/quiz.routes.js'
import { quizSocketHandlers } from './quiz/quiz.sockets.js'
import { roadmapRoutes } from './roadmap/roadmap.routes.js'
import { portfolioRoutes } from './portfolio/portfolio.routes.js'
import { parcoursRoutes } from './parcours/parcours.routes.js'
import { formsRoutes } from './forms/forms.routes.js'
import { pdfRoutes } from './pdf/pdf.routes.js'
import { procurementRoutes } from './procurement/procurement.routes.js'
import { activiteRoutes } from './procurement/activite.routes.js'
import { governanceConfigRoutes } from './procurement/governance-config.routes.js'
import { feedbackRoutes } from './feedback/feedback.routes.js'
import { feedbackSocketHandlers } from './feedback/feedback.sockets.js'
import { signdocRoutes } from './signdoc/signdoc.routes.js'
import { signdocPublicRoutes } from './signdoc/signdoc.public.routes.js'
import { innovationRoutes } from './innovation/innovation.routes.js'
import { challengeRoutes } from './innovation/challenge.routes.js'
import { innovationOrgRoutes } from './innovation/org.routes.js'
import { innovationStatsRoutes } from './innovation/stats.routes.js'
import { scoringRoutes } from './innovation/scoring.routes.js'
import { innovationCommentsRoutes } from './innovation/innovation-comments.routes.js'
import { innovationAttachmentsRoutes } from './innovation/innovation-attachments.routes.js'
import { innovationLinksRoutes } from './innovation/innovation-links.routes.js'
import { todoRoutes } from './todo/todo.routes.js'
import { todoDashboardRoutes } from './todo/todo-dashboard.routes.js'
import { piRoutes } from './pi/pi.routes.js'
import { piBoardRoutes } from './pi/pi-board.routes.js'

// FORGE F0 — registre des modules côté API.
// Le socle (index.ts) monte routes et handlers socket en itérant ce registre :
// activer/désactiver un module = l'ajouter/retirer ici. Les routes du socle
// (auth, notifications, sessions live) restent montées explicitement.
// Chaque module vit dans son dossier modules/<id>/ et ne doit importer que
// depuis son dossier, ../../lib (socle) et @pouetpouet/shared. L'extraction
// en packages npm (packages/module-*) viendra quand cette frontière tiendra.

export interface ApiModule {
  manifest: ModuleManifest
  routes: { plugin: FastifyPluginAsync; prefix: string }[]
  socketHandlers: ((io: Server, socket: Socket) => void)[]
}

export const API_MODULES: ApiModule[] = [
  {
    manifest: POUETPOUET_MODULE,
    routes: [
      { plugin: boardRoutes, prefix: '/api/boards' },
      { plugin: templateRoutes, prefix: '/api/templates' },
    ],
    socketHandlers: [boardSocketHandlers, voteSocketHandlers],
  },
  {
    manifest: SCRUM_MODULE,
    routes: [{ plugin: scrumRoutes, prefix: '/api/scrum' }],
    socketHandlers: [scrumSocketHandlers],
  },
  {
    manifest: DAILY_MODULE,
    routes: [{ plugin: dailyRoutes, prefix: '/api/daily' }],
    socketHandlers: [dailySocketHandlers],
  },
  {
    manifest: WHEEL_MODULE,
    routes: [{ plugin: wheelRoutes, prefix: '/api/wheel' }],
    socketHandlers: [],
  },
  {
    manifest: CAPACITY_MODULE,
    routes: [{ plugin: capacityRoutes, prefix: '/api/capacity' }],
    socketHandlers: [],
  },
  {
    manifest: MEETOPS_MODULE,
    routes: [{ plugin: meetopsRoutes, prefix: '/api/meetops' }],
    socketHandlers: [],
  },
  {
    manifest: TESTBOOKS_MODULE,
    routes: [{ plugin: testbooksRoutes, prefix: '/api/testbooks' }],
    socketHandlers: [],
  },
  {
    manifest: QUIZ_MODULE,
    routes: [{ plugin: quizRoutes, prefix: '/api/quiz' }],
    socketHandlers: [quizSocketHandlers],
  },
  {
    manifest: ROADMAP_MODULE,
    routes: [{ plugin: roadmapRoutes, prefix: '/api/roadmap' }],
    socketHandlers: [],
  },
  {
    manifest: PORTFOLIO_MODULE,
    routes: [{ plugin: portfolioRoutes, prefix: '/api/portfolio' }],
    socketHandlers: [],
  },
  {
    manifest: PARCOURS_MODULE,
    routes: [{ plugin: parcoursRoutes, prefix: '/api/parcours' }],
    socketHandlers: [],
  },
  {
    manifest: FORMS_MODULE,
    routes: [{ plugin: formsRoutes, prefix: '/api/forms' }],
    socketHandlers: [],
  },
  {
    manifest: PDF_MODULE,
    routes: [{ plugin: pdfRoutes, prefix: '/api/pdf' }],
    socketHandlers: [],
  },
  {
    manifest: FEEDBACK_MODULE,
    routes: [{ plugin: feedbackRoutes, prefix: '/api/feedback' }],
    socketHandlers: [feedbackSocketHandlers],
  },
  {
    manifest: SIGNDOC_MODULE,
    routes: [
      { plugin: signdocRoutes, prefix: '/api/signdoc' },
      // Routes publiques de signature (non authentifiées, jeton à usage unique).
      { plugin: signdocPublicRoutes, prefix: '/api/sign' },
    ],
    socketHandlers: [],
  },
  {
    manifest: PROCUREMENT_MODULE,
    routes: [
      { plugin: procurementRoutes, prefix: '/api/procurement' },
      { plugin: activiteRoutes, prefix: '/api/procurement' },
      { plugin: governanceConfigRoutes, prefix: '/api/procurement' },
    ],
    socketHandlers: [],
  },
  {
    manifest: INNOVATION_MODULE,
    routes: [
      { plugin: innovationRoutes, prefix: '/api/innovation' },
      { plugin: challengeRoutes, prefix: '/api/innovation' },
      { plugin: innovationOrgRoutes, prefix: '/api/innovation' },
      { plugin: innovationStatsRoutes, prefix: '/api/innovation' },
      { plugin: scoringRoutes, prefix: '/api/innovation' },
      { plugin: innovationCommentsRoutes, prefix: '/api/innovation' },
      { plugin: innovationAttachmentsRoutes, prefix: '/api/innovation' },
      { plugin: innovationLinksRoutes, prefix: '/api/innovation' },
    ],
    socketHandlers: [],
  },
  {
    manifest: TODO_MODULE,
    routes: [
      { plugin: todoRoutes, prefix: '/api/todo' },
      { plugin: todoDashboardRoutes, prefix: '/api/todo' },
    ],
    socketHandlers: [],
  },
  {
    manifest: PI_MODULE,
    routes: [
      { plugin: piRoutes, prefix: '/api/pi' },
      { plugin: piBoardRoutes, prefix: '/api/pi' },
    ],
    socketHandlers: [],
  },
]

export function registerModuleRoutes(app: FastifyInstance) {
  for (const mod of API_MODULES) {
    for (const { plugin, prefix } of mod.routes) {
      app.register(plugin, { prefix })
    }
  }
}
