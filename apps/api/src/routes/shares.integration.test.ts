import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../test/build-app.js'
import { shareRoutes } from './shares.js'
import { teamRoutes } from './teams.js'
import { prisma } from '../lib/prisma.js'

const SUFFIX = '@shares.int.test'

describe('/api/shares invite-team (integration)', () => {
  let app: FastifyInstance
  let ownerTok: string, memberTok: string, strangerTok: string
  let ownerId: string, memberId: string
  let teamId: string
  let scrumId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([
      { plugin: shareRoutes, prefix: '/api/shares' },
      { plugin: teamRoutes, prefix: '/api/teams' },
    ])

    const owner = await createTestUser(app, `owner${SUFFIX}`)
    const member = await createTestUser(app, `member${SUFFIX}`)
    const stranger = await createTestUser(app, `stranger${SUFFIX}`)
    ownerTok = owner.token; ownerId = owner.user.id
    memberTok = member.token; memberId = member.user.id
    strangerTok = stranger.token

    // Create team (owner owns it, member has EDITOR access)
    const teamRes = await app.inject({
      method: 'POST', url: '/api/teams',
      headers: { authorization: `Bearer ${ownerTok}` },
      payload: { name: 'Équipe test', members: ['Alice'] },
    })
    teamId = teamRes.json().id
    await prisma.moduleShare.create({ data: { module: 'team', resourceId: teamId, userId: memberId, role: 'EDITOR' } })

    // Create a Scrum room directly in DB (no need to mount scrum routes)
    const scrum = await prisma.scrumRoom.create({
      data: { name: 'Salle de test', code: `TEST-${Date.now()}`, ownerId },
    })
    scrumId = scrum.id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('invites all team members to a Scrum room', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/shares/scrum/${scrumId}/invite-team`,
      headers: { authorization: `Bearer ${ownerTok}` },
      payload: { teamId, role: 'VIEWER' },
    })
    expect(res.statusCode).toBe(201)
    const shares = res.json() as { user: { id: string }; role: string }[]
    // member was shared on the team → should be invited to the Scrum room
    expect(shares.some((s) => s.user.id === memberId && s.role === 'VIEWER')).toBe(true)
    // owner is excluded (already owns the resource)
    expect(shares.some((s) => s.user.id === ownerId)).toBe(false)
  })

  it('does not re-invite if already shared, but updates role', async () => {
    // Member already has VIEWER from previous test; invite again as EDITOR
    const res = await app.inject({
      method: 'POST',
      url: `/api/shares/scrum/${scrumId}/invite-team`,
      headers: { authorization: `Bearer ${ownerTok}` },
      payload: { teamId, role: 'EDITOR' },
    })
    expect(res.statusCode).toBe(201)
    const shares = res.json() as { user: { id: string }; role: string }[]
    expect(shares.find((s) => s.user.id === memberId)?.role).toBe('EDITOR')
    // Verify only one ModuleShare row per user/resource
    const count = await prisma.moduleShare.count({ where: { module: 'scrum', resourceId: scrumId, userId: memberId } })
    expect(count).toBe(1)
  })

  it('rejects invite-team from a non-owner', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/shares/scrum/${scrumId}/invite-team`,
      headers: { authorization: `Bearer ${strangerTok}` },
      payload: { teamId, role: 'VIEWER' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 404 for an unknown teamId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/shares/scrum/${scrumId}/invite-team`,
      headers: { authorization: `Bearer ${ownerTok}` },
      payload: { teamId: '00000000-0000-0000-0000-000000000000', role: 'VIEWER' },
    })
    expect(res.statusCode).toBe(404)
  })
})
