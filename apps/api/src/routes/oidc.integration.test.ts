import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { findOrCreateUser } from './oidc.js'
import { prisma } from '../lib/prisma.js'

const SUFFIX = '@oidc.int.test'
const PROVIDER = 'http://idp.test/realms/forge'

describe('findOrCreateUser (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } })
  })

  it('creates a verified user with a linked federated account', async () => {
    const user = await findOrCreateUser(PROVIDER, 'sub-new', `new${SUFFIX}`, 'New User')
    expect(user.emailVerified).toBe(true)
    expect(user.email).toBe(`new${SUFFIX}`)
    const account = await prisma.oAuthAccount.findUnique({
      where: { provider_subject: { provider: PROVIDER, subject: 'sub-new' } },
    })
    expect(account?.userId).toBe(user.id)
  })

  it('returns the same user on subsequent logins', async () => {
    const first = await findOrCreateUser(PROVIDER, 'sub-repeat', `repeat${SUFFIX}`, 'Repeat')
    const second = await findOrCreateUser(PROVIDER, 'sub-repeat', `repeat${SUFFIX}`, 'Repeat')
    expect(second.id).toBe(first.id)
    expect(await prisma.user.count({ where: { email: `repeat${SUFFIX}` } })).toBe(1)
  })

  it('links the federated identity to an existing local account by email', async () => {
    const local = await prisma.user.create({
      data: { email: `local${SUFFIX}`, name: 'Local', password: 'hash', emailVerified: true },
    })
    const viaSSO = await findOrCreateUser(PROVIDER, 'sub-local', `local${SUFFIX}`, 'Local Via SSO')
    expect(viaSSO.id).toBe(local.id)
    const account = await prisma.oAuthAccount.findUnique({
      where: { provider_subject: { provider: PROVIDER, subject: 'sub-local' } },
    })
    expect(account?.userId).toBe(local.id)
  })

  it('creates distinct users for distinct subjects without email', async () => {
    const a = await findOrCreateUser(PROVIDER, 'sub-noemail-a', null, 'Anon A')
    const b = await findOrCreateUser(PROVIDER, 'sub-noemail-b', null, 'Anon B')
    expect(a.id).not.toBe(b.id)
    // Cleanup: ces emails synthétiques ne portent pas le suffixe du test
    await prisma.user.deleteMany({ where: { id: { in: [a.id, b.id] } } })
  })
})
