import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { todoRoutes } from './todo.routes.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@todo.int.test'

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

describe('Todo — listes, permissions, partage', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let editor: { user: { id: string } ; token: string }
  let viewer: { user: { id: string }; token: string }
  let stranger: { user: { id: string }; token: string }
  let listId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: todoRoutes, prefix: '/api/todo' }])
    owner = await createTestUser(app, `owner${SUFFIX}`)
    editor = await createTestUser(app, `editor${SUFFIX}`)
    viewer = await createTestUser(app, `viewer${SUFFIX}`)
    stranger = await createTestUser(app, `stranger${SUFFIX}`)

    const created = await app.inject({ method: 'POST', url: '/api/todo/lists', headers: auth(owner.token), payload: { name: 'Courses' } })
    listId = created.json().id
    await prisma.moduleShare.create({ data: { module: 'todolist', resourceId: listId, userId: editor.user.id, role: 'EDITOR' } })
    await prisma.moduleShare.create({ data: { module: 'todolist', resourceId: listId, userId: viewer.user.id, role: 'VIEWER' } })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('POST /lists → 201, role OWNER, isFavorite false', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/todo/lists', headers: auth(owner.token), payload: { name: 'Autre liste' } })
    expect(res.statusCode).toBe(201)
    expect(res.json().role).toBe('OWNER')
    expect(res.json().isFavorite).toBe(false)
  })

  it('GET /lists/:id — un étranger n\'a pas accès → 403', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/todo/lists/${listId}`, headers: auth(stranger.token) })
    expect(res.statusCode).toBe(403)
  })

  it('GET /lists/:id — le VIEWER partagé voit la liste', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/todo/lists/${listId}`, headers: auth(viewer.token) })
    expect(res.statusCode).toBe(200)
    expect(res.json().role).toBe('VIEWER')
  })

  it('GET /lists — n\'inclut pas les listes d\'un étranger', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/todo/lists', headers: auth(stranger.token) })
    expect(res.json().some((l: { id: string }) => l.id === listId)).toBe(false)
  })

  it('GET /lists — inclut les listes partagées (editor et viewer)', async () => {
    const asEditor = await app.inject({ method: 'GET', url: '/api/todo/lists', headers: auth(editor.token) })
    const asViewer = await app.inject({ method: 'GET', url: '/api/todo/lists', headers: auth(viewer.token) })
    expect(asEditor.json().some((l: { id: string }) => l.id === listId)).toBe(true)
    expect(asViewer.json().some((l: { id: string }) => l.id === listId)).toBe(true)
  })

  it('PATCH /lists/:id — le VIEWER ne peut pas éditer → 403', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/todo/lists/${listId}`, headers: auth(viewer.token), payload: { name: 'pirate' } })
    expect(res.statusCode).toBe(403)
  })

  it('PATCH /lists/:id — l\'EDITOR peut éditer', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/todo/lists/${listId}`, headers: auth(editor.token), payload: { name: 'Courses (édité)' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Courses (édité)')
  })

  it('DELETE /lists/:id — seul le propriétaire peut supprimer', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/todo/lists/${listId}`, headers: auth(editor.token) })
    expect(res.statusCode).toBe(404)
  })

  // ── Items ──────────────────────────────────────────────────────────────────

  it('POST /lists/:id/items — le VIEWER ne peut pas ajouter → 403', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/todo/lists/${listId}/items`, headers: auth(viewer.token), payload: { title: 'Pain' } })
    expect(res.statusCode).toBe(403)
  })

  it('POST /lists/:id/items — l\'EDITOR ajoute des tâches', async () => {
    const a = await app.inject({ method: 'POST', url: `/api/todo/lists/${listId}/items`, headers: auth(editor.token), payload: { title: 'Basse priorité', priority: 'LOW' } })
    const b = await app.inject({ method: 'POST', url: `/api/todo/lists/${listId}/items`, headers: auth(editor.token), payload: { title: 'Haute priorité', priority: 'HIGH' } })
    expect(a.statusCode).toBe(201)
    expect(b.statusCode).toBe(201)
  })

  it('GET /lists/:id — les items sont triés par priorité décroissante (non faits en premier)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/todo/lists/${listId}`, headers: auth(owner.token) })
    const titles = res.json().items.map((i: { title: string }) => i.title)
    expect(titles.indexOf('Haute priorité')).toBeLessThan(titles.indexOf('Basse priorité'))
  })

  it('PATCH /items/:id — coche une tâche comme faite, elle passe en fin de tri', async () => {
    const list = await app.inject({ method: 'GET', url: `/api/todo/lists/${listId}`, headers: auth(owner.token) })
    const highPrio = list.json().items.find((i: { title: string }) => i.title === 'Haute priorité')
    const res = await app.inject({ method: 'PATCH', url: `/api/todo/lists/${listId}/items/${highPrio.id}`, headers: auth(owner.token), payload: { status: 'DONE' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('DONE')

    const after = await app.inject({ method: 'GET', url: `/api/todo/lists/${listId}`, headers: auth(owner.token) })
    const titles = after.json().items.map((i: { title: string }) => i.title)
    expect(titles[titles.length - 1]).toBe('Haute priorité')
  })

  it('PATCH /items/:id — annule une tâche, elle passe en toute fin de tri (après les faites)', async () => {
    const created = await app.inject({ method: 'POST', url: `/api/todo/lists/${listId}/items`, headers: auth(editor.token), payload: { title: 'À annuler' } })
    const itemId = created.json().id
    const res = await app.inject({ method: 'PATCH', url: `/api/todo/lists/${listId}/items/${itemId}`, headers: auth(owner.token), payload: { status: 'CANCELLED' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('CANCELLED')

    const after = await app.inject({ method: 'GET', url: `/api/todo/lists/${listId}`, headers: auth(owner.token) })
    const titles = after.json().items.map((i: { title: string }) => i.title)
    expect(titles[titles.length - 1]).toBe('À annuler')
  })

  it('GET /lists — les tâches annulées ne comptent ni dans itemCount ni dans doneCount', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/todo/lists', headers: auth(owner.token) })
    const list = res.json().find((l: { id: string }) => l.id === listId)
    // 3 items créés (Basse priorité, Haute priorité, À annuler), 1 fait (Haute priorité), 1 annulé (À annuler).
    expect(list.itemCount).toBe(2)
    expect(list.doneCount).toBe(1)
  })

  it('DELETE /items/:id — le VIEWER ne peut pas supprimer une tâche → 403', async () => {
    const list = await app.inject({ method: 'GET', url: `/api/todo/lists/${listId}`, headers: auth(owner.token) })
    const item = list.json().items[0]
    const res = await app.inject({ method: 'DELETE', url: `/api/todo/lists/${listId}/items/${item.id}`, headers: auth(viewer.token) })
    expect(res.statusCode).toBe(403)
  })

  // ── Favoris ────────────────────────────────────────────────────────────────

  it('POST /lists/:id/favorite — toggle', async () => {
    const on = await app.inject({ method: 'POST', url: `/api/todo/lists/${listId}/favorite`, headers: auth(viewer.token) })
    expect(on.json()).toEqual({ isFavorite: true })
    const off = await app.inject({ method: 'POST', url: `/api/todo/lists/${listId}/favorite`, headers: auth(viewer.token) })
    expect(off.json()).toEqual({ isFavorite: false })
  })

  it('POST /lists/:id/favorite — un étranger sans accès → 404', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/todo/lists/${listId}/favorite`, headers: auth(stranger.token) })
    expect(res.statusCode).toBe(404)
  })

  it('GET /lists?favorite=true — ne renvoie que les favoris de l\'appelant', async () => {
    await app.inject({ method: 'POST', url: `/api/todo/lists/${listId}/favorite`, headers: auth(viewer.token) })
    const asViewer = await app.inject({ method: 'GET', url: '/api/todo/lists?favorite=true', headers: auth(viewer.token) })
    const asEditor = await app.inject({ method: 'GET', url: '/api/todo/lists?favorite=true', headers: auth(editor.token) })
    expect(asViewer.json().some((l: { id: string }) => l.id === listId)).toBe(true)
    expect(asEditor.json().some((l: { id: string }) => l.id === listId)).toBe(false)
  })

  it('GET /lists?mine=true — ne renvoie que les listes possédées par l\'appelant', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/todo/lists?mine=true', headers: auth(editor.token) })
    expect(res.json().some((l: { id: string }) => l.id === listId)).toBe(false)
  })
})
