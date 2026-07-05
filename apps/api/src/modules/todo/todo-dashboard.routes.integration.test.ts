import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { todoRoutes } from './todo.routes.js'
import { todoDashboardRoutes } from './todo-dashboard.routes.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@todo-dashboard.int.test'

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

const PLUGINS = [
  { plugin: todoRoutes, prefix: '/api/todo' },
  { plugin: todoDashboardRoutes, prefix: '/api/todo' },
]

describe('TodoDashboard — CRUD, rattachement, accès transitif', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let director: { user: { id: string }; token: string } // VIEWER sur le dashboard
  let stranger: { user: { id: string }; token: string }
  let dashboardId: string
  let listId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp(PLUGINS)
    owner = await createTestUser(app, `owner${SUFFIX}`)
    director = await createTestUser(app, `director${SUFFIX}`)
    stranger = await createTestUser(app, `stranger${SUFFIX}`)

    const dashboard = await prisma.todoDashboard.create({ data: { name: 'Sprint 12', ownerId: owner.user.id } })
    dashboardId = dashboard.id
    await prisma.moduleShare.create({ data: { module: 'tododashboard', resourceId: dashboardId, userId: director.user.id, role: 'VIEWER' } })

    const list = await prisma.todoList.create({ data: { name: 'Backend', ownerId: owner.user.id, dashboardId } })
    listId = list.id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('hides the dashboard from a stranger', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/todo/dashboards/${dashboardId}`, headers: auth(stranger.token) })
    expect(res.statusCode).toBe(403)
  })

  it('dashboard detail lists its attached lists', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/todo/dashboards/${dashboardId}`, headers: auth(owner.token) })
    expect(res.statusCode).toBe(200)
    expect(res.json().lists.map((l: { id: string }) => l.id)).toContain(listId)
  })

  it('a dashboard VIEWER gets transitive read access to the attached list without a direct share', async () => {
    const direct = await prisma.moduleShare.findUnique({
      where: { module_resourceId_userId: { module: 'todolist', resourceId: listId, userId: director.user.id } },
    })
    expect(direct).toBeNull()

    const res = await app.inject({ method: 'GET', url: `/api/todo/lists/${listId}`, headers: auth(director.token) })
    expect(res.statusCode).toBe(200)
    expect(res.json().role).toBe('VIEWER')
  })

  it('transitive VIEWER cannot edit the list (dashboard role is read-only)', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/todo/lists/${listId}/items`, headers: auth(director.token), payload: { title: 'Non' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('a stranger still has no access to the list despite the dashboard link', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/todo/lists/${listId}`, headers: auth(stranger.token) })
    expect(res.statusCode).toBe(403)
  })

  it('rejects attaching a list the caller cannot edit', async () => {
    const foreignOwner = await createTestUser(app, `foreign${SUFFIX}`)
    const foreignList = await prisma.todoList.create({ data: { name: 'Pas à toi', ownerId: foreignOwner.user.id } })
    const res = await app.inject({
      method: 'POST', url: `/api/todo/dashboards/${dashboardId}/lists`, headers: auth(owner.token), payload: { listId: foreignList.id },
    })
    expect(res.statusCode).toBe(403)
  })

  it('rejects attaching a list to a dashboard the caller cannot edit', async () => {
    const ownList = await prisma.todoList.create({ data: { name: 'À moi', ownerId: director.user.id } })
    const res = await app.inject({
      method: 'POST', url: `/api/todo/dashboards/${dashboardId}/lists`, headers: auth(director.token), payload: { listId: ownList.id },
    })
    expect(res.statusCode).toBe(403)
  })

  it('owner can attach and detach a list; detaching preserves the list', async () => {
    const list = await prisma.todoList.create({ data: { name: 'Détachable', ownerId: owner.user.id } })
    const attach = await app.inject({
      method: 'POST', url: `/api/todo/dashboards/${dashboardId}/lists`, headers: auth(owner.token), payload: { listId: list.id },
    })
    expect(attach.statusCode).toBe(204)
    expect((await prisma.todoList.findUnique({ where: { id: list.id } }))?.dashboardId).toBe(dashboardId)

    const detach = await app.inject({ method: 'DELETE', url: `/api/todo/dashboards/${dashboardId}/lists/${list.id}`, headers: auth(owner.token) })
    expect(detach.statusCode).toBe(204)
    const after = await prisma.todoList.findUnique({ where: { id: list.id } })
    expect(after).not.toBeNull()
    expect(after?.dashboardId).toBeNull()
  })

  it('deleting the dashboard detaches its lists instead of deleting them', async () => {
    const db = await prisma.todoDashboard.create({ data: { name: 'Éphémère', ownerId: owner.user.id } })
    const list = await prisma.todoList.create({ data: { name: 'Survit', ownerId: owner.user.id, dashboardId: db.id } })

    const del = await app.inject({ method: 'DELETE', url: `/api/todo/dashboards/${db.id}`, headers: auth(owner.token) })
    expect(del.statusCode).toBe(204)

    const survived = await prisma.todoList.findUnique({ where: { id: list.id } })
    expect(survived).not.toBeNull()
    expect(survived?.dashboardId).toBeNull()
  })

  it('only the owner can delete the dashboard (404 for a non-owner, anti-énumération)', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/todo/dashboards/${dashboardId}`, headers: auth(director.token) })
    expect(res.statusCode).toBe(404)
  })
})

describe('TodoDashboard — rapports / statistiques', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let stranger: { user: { id: string }; token: string }
  let dashboardId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp(PLUGINS)
    owner = await createTestUser(app, `owner-stats${SUFFIX}`)
    stranger = await createTestUser(app, `stranger-stats${SUFFIX}`)

    const dashboard = await prisma.todoDashboard.create({ data: { name: 'Bilan', ownerId: owner.user.id } })
    dashboardId = dashboard.id

    // Liste A : 2 tâches, 1 faite.
    const listA = await prisma.todoList.create({ data: { name: 'Liste A', ownerId: owner.user.id, dashboardId } })
    await prisma.todoItem.create({ data: { listId: listA.id, title: 'A1', done: true, priority: 'HIGH' } })
    await prisma.todoItem.create({ data: { listId: listA.id, title: 'A2', done: false, priority: 'LOW' } })

    // Liste B : 1 tâche en retard.
    const listB = await prisma.todoList.create({ data: { name: 'Liste B', ownerId: owner.user.id, dashboardId } })
    await prisma.todoItem.create({ data: { listId: listB.id, title: 'B1', done: false, priority: 'MEDIUM', dueDate: '2020-01-01' } })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('GET /dashboards/:id/stats — un étranger n\'a pas accès → 403', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/todo/dashboards/${dashboardId}/stats`, headers: auth(stranger.token) })
    expect(res.statusCode).toBe(403)
  })

  it('GET /dashboards/:id/stats — totaux et complétion globale corrects', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/todo/dashboards/${dashboardId}/stats`, headers: auth(owner.token) })
    expect(res.statusCode).toBe(200)
    const stats = res.json()
    expect(stats.totalItems).toBe(3)
    expect(stats.totalDone).toBe(1)
    expect(stats.completionPercent).toBe(33)
    expect(stats.totalOverdue).toBe(1)
  })

  it('GET /dashboards/:id/stats — complétion par liste', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/todo/dashboards/${dashboardId}/stats`, headers: auth(owner.token) })
    const byList = res.json().byList
    const listA = byList.find((l: { name: string }) => l.name === 'Liste A')
    expect(listA.itemCount).toBe(2)
    expect(listA.doneCount).toBe(1)
    expect(listA.completionPercent).toBe(50)
  })

  it('GET /dashboards/:id/stats — répartition par priorité (tâches non faites uniquement)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/todo/dashboards/${dashboardId}/stats`, headers: auth(owner.token) })
    const byPriority = res.json().byPriority
    expect(byPriority.HIGH).toBe(0) // A1 est faite, exclue
    expect(byPriority.LOW).toBe(1)
    expect(byPriority.MEDIUM).toBe(1)
  })

  it('GET /dashboards/:id/stats — récemment terminé inclut la tâche faite', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/todo/dashboards/${dashboardId}/stats`, headers: auth(owner.token) })
    expect(res.json().recentlyCompleted.some((i: { title: string }) => i.title === 'A1')).toBe(true)
  })
})
