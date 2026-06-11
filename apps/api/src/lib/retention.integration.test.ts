import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from './prisma.js'
import { runRetention, RETENTION_DAYS } from './retention.js'

const SUFFIX = '@retention.int.test'
const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY_MS)
}

describe('runRetention (integration)', () => {
  let userId: string
  let boardId: string

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } })
    const user = await prisma.user.create({
      data: { email: `owner${SUFFIX}`, name: 'Retention', password: 'x', emailVerified: true },
    })
    userId = user.id
    const board = await prisma.board.create({ data: { name: 'Retention board', ownerId: userId } })
    boardId = board.id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } })
  })

  it('purges old closed sessions but keeps recent and open ones', async () => {
    const oldClosed = await prisma.session.create({
      data: { boardId, code: `RT${Date.now() % 100000}A`, status: 'CLOSED', closedAt: daysAgo(RETENTION_DAYS.closedSessions + 5) },
    })
    const recentClosed = await prisma.session.create({
      data: { boardId, code: `RT${Date.now() % 100000}B`, status: 'CLOSED', closedAt: daysAgo(1) },
    })
    const open = await prisma.session.create({
      data: { boardId, code: `RT${Date.now() % 100000}C` },
    })

    const result = await runRetention()
    expect(result.closedSessions).toBeGreaterThanOrEqual(1)

    const remaining = await prisma.session.findMany({ where: { boardId }, select: { id: true } })
    const ids = remaining.map((s) => s.id)
    expect(ids).not.toContain(oldClosed.id)
    expect(ids).toContain(recentClosed.id)
    expect(ids).toContain(open.id)
  })

  it('purges old read notifications but keeps unread ones', async () => {
    const oldRead = await prisma.notification.create({
      data: { userId, type: 'TEST', title: 'old read', readAt: daysAgo(100), createdAt: daysAgo(RETENTION_DAYS.readNotifications + 10) },
    })
    const oldUnread = await prisma.notification.create({
      data: { userId, type: 'TEST', title: 'old unread', createdAt: daysAgo(RETENTION_DAYS.readNotifications + 10) },
    })

    await runRetention()

    const remaining = await prisma.notification.findMany({ where: { userId }, select: { id: true } })
    const ids = remaining.map((n) => n.id)
    expect(ids).not.toContain(oldRead.id)
    expect(ids).toContain(oldUnread.id)
  })

  it('purges old audit logs and clears expired tokens', async () => {
    const oldLog = await prisma.auditLog.create({
      data: { userId, action: 'auth.login', createdAt: daysAgo(RETENTION_DAYS.auditLogs + 10) },
    })
    await prisma.user.update({
      where: { id: userId },
      data: { verifyToken: 'expired-token-retention', verifyTokenExpires: daysAgo(2) },
    })

    const result = await runRetention()
    expect(result.expiredTokens).toBeGreaterThanOrEqual(1)

    expect(await prisma.auditLog.findUnique({ where: { id: oldLog.id } })).toBeNull()
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { verifyToken: true, verifyTokenExpires: true } })
    expect(user?.verifyToken).toBeNull()
    expect(user?.verifyTokenExpires).toBeNull()
  })
})
