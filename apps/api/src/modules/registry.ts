import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { Server, Socket } from 'socket.io'
import type { ModuleManifest } from '@pouetpouet/shared'
import { POUETPOUET_MODULE, SCRUM_MODULE, DAILY_MODULE, WHEEL_MODULE, CAPACITY_MODULE, MEETOPS_MODULE, TESTBOOKS_MODULE, QUIZ_MODULE, ROADMAP_MODULE } from '@pouetpouet/shared'

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
]

export function registerModuleRoutes(app: FastifyInstance) {
  for (const mod of API_MODULES) {
    for (const { plugin, prefix } of mod.routes) {
      app.register(plugin, { prefix })
    }
  }
}
