import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../test/build-app.js'
import { notificationRoutes } from './notifications.js'
import { PATCH_NOTES } from '../lib/patch-notes.js'
import { prisma } from '../lib/prisma.js'

// #219 : la pastille « nouvelle version » compare les VERSIONS, pas les dates —
// deux releases le même jour doivent chacune rallumer l'indicateur.
const SUFFIX = '@notif-patch-notes.int.test'

describe('notifications — patch notes seen version (integration)', () => {
  let app: FastifyInstance
  let user: { user: { id: string }; token: string }

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: notificationRoutes, prefix: '/api/notifications' }])
    user = await createTestUser(app, `user${SUFFIX}`)
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  function getNotifications() {
    return app.inject({ method: 'GET', url: '/api/notifications', headers: { authorization: `Bearer ${user.token}` } })
  }

  it('flags unseen patch notes for a fresh user', async () => {
    const res = await getNotifications()
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.hasUnreadPatchNotes).toBe(true)
    expect(body.patchNotesSeenVersion).toBeNull()
  })

  it('clears the flag and stores the latest version on acknowledgement', async () => {
    const seen = await app.inject({ method: 'POST', url: '/api/notifications/patch-notes/seen', headers: { authorization: `Bearer ${user.token}` }, payload: {} })
    expect(seen.statusCode).toBe(200)

    const res = await getNotifications()
    const body = res.json()
    expect(body.hasUnreadPatchNotes).toBe(false)
    expect(body.patchNotesSeenVersion).toBe(PATCH_NOTES[0].version)
  })

  it('re-lights the badge for a same-day release with a different version', async () => {
    // Simule un utilisateur ayant vu la release précédente AUJOURD'HUI : version
    // vue ≠ dernière version, mais timestamp vu > minuit (le cas qui cassait).
    await prisma.user.update({
      where: { id: user.user.id },
      data: { patchNotesSeenAt: new Date(), patchNotesSeenVersion: '0.0.1' },
    })

    const res = await getNotifications()
    const body = res.json()
    expect(body.hasUnreadPatchNotes).toBe(true)
    expect(body.patchNotesSeenVersion).toBe('0.0.1')
  })
})
