import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from './prisma.js'
import { resolveRole, sharedResourceIds, deleteResourceShares } from './module-share.js'

// Rôle hérité d'une équipe via TeamModuleShare — plafonné par TeamMember.teamRole.
const SUFFIX = '@moduleshare.int.test'

describe('resolveRole — héritage via équipe (TeamModuleShare)', () => {
  let ownerId: string
  let memberId: string
  let teamId: string
  let resourceId: string

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } })
    const owner = await prisma.user.create({ data: { email: `owner${SUFFIX}`, name: 'Owner', password: 'x', emailVerified: true } })
    const member = await prisma.user.create({ data: { email: `member${SUFFIX}`, name: 'Member', password: 'x', emailVerified: true } })
    ownerId = owner.id
    memberId = member.id
    const team = await prisma.team.create({ data: { name: 'Équipe héritage', ownerId } })
    teamId = team.id
    // Ressource fictive : on réutilise la table Team elle-même comme "ressource"
    // cible pour éviter de dépendre d'un autre module (le module de test peut être
    // n'importe quelle chaîne, resolveRole ne valide pas son existence).
    resourceId = (await prisma.team.create({ data: { name: 'Ressource cible', ownerId } })).id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } })
  })

  it('renvoie null sans lien de compte ni partage', async () => {
    const role = await resolveRole('test-module', resourceId, memberId, ownerId)
    expect(role).toBeNull()
  })

  it('renvoie null si le membre est lié mais sans grade (teamRole=null), même avec un partage équipe', async () => {
    await prisma.teamMember.create({ data: { teamId, name: 'Membre', email: `member${SUFFIX}`, userId: memberId } })
    await prisma.teamModuleShare.create({ data: { module: 'test-module', resourceId, teamId, role: 'EDITOR' } })
    const role = await resolveRole('test-module', resourceId, memberId, ownerId)
    expect(role).toBeNull()
  })

  it('plafonne le rôle hérité au grade du membre (teamRole=VIEWER < partage EDITOR)', async () => {
    await prisma.teamMember.updateMany({ where: { teamId, userId: memberId }, data: { teamRole: 'VIEWER' } })
    const role = await resolveRole('test-module', resourceId, memberId, ownerId)
    expect(role).toBe('VIEWER')
  })

  it('donne le rôle du partage si le grade du membre est au moins aussi élevé', async () => {
    await prisma.teamMember.updateMany({ where: { teamId, userId: memberId }, data: { teamRole: 'OWNER' } })
    const role = await resolveRole('test-module', resourceId, memberId, ownerId)
    expect(role).toBe('EDITOR') // partage limité à EDITOR, le grade OWNER du membre ne dépasse pas ce plafond côté partage
  })

  it('un nouveau membre lié après coup hérite immédiatement, sans réinvitation', async () => {
    const newMember = await prisma.user.create({ data: { email: `newmember${SUFFIX}`, name: 'New', password: 'x', emailVerified: true } })
    await prisma.teamMember.create({ data: { teamId, name: 'Nouveau', email: newMember.email, userId: newMember.id, teamRole: 'EDITOR' } })
    const role = await resolveRole('test-module', resourceId, newMember.id, ownerId)
    expect(role).toBe('EDITOR')
  })

  it('combine le meilleur entre partage individuel et rôle hérité de l\'équipe', async () => {
    // Le membre n'a que VIEWER via l'équipe (grade plafonné), mais un partage
    // individuel direct en EDITOR doit primer.
    await prisma.teamMember.updateMany({ where: { teamId, userId: memberId }, data: { teamRole: 'VIEWER' } })
    await prisma.moduleShare.create({ data: { module: 'test-module', resourceId, userId: memberId, role: 'EDITOR' } })
    const role = await resolveRole('test-module', resourceId, memberId, ownerId)
    expect(role).toBe('EDITOR')
  })
})

// Régression : une ressource partagée uniquement via TeamModuleShare (aucun
// ModuleShare individuel) doit apparaître dans les listes (GET /api/daily/sessions,
// /api/scrum, ...), pas seulement en accès direct par id via resolveRole.
describe('sharedResourceIds — inclut les ressources partagées dynamiquement par équipe', () => {
  const LIST_SUFFIX = '@moduleshare.list.int.test'
  let ownerId: string
  let memberId: string
  let teamId: string
  let onlyTeamSharedId: string
  let onlyIndividualSharedId: string
  let bothId: string

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: LIST_SUFFIX } } })
    const owner = await prisma.user.create({ data: { email: `owner${LIST_SUFFIX}`, name: 'Owner', password: 'x', emailVerified: true } })
    const member = await prisma.user.create({ data: { email: `member${LIST_SUFFIX}`, name: 'Member', password: 'x', emailVerified: true } })
    ownerId = owner.id
    memberId = member.id
    const team = await prisma.team.create({ data: { name: 'Équipe liste', ownerId } })
    teamId = team.id
    await prisma.teamMember.create({ data: { teamId, name: 'Membre', email: member.email, userId: memberId, teamRole: 'EDITOR' } })

    onlyTeamSharedId = (await prisma.team.create({ data: { name: 'Ressource équipe seule', ownerId } })).id
    onlyIndividualSharedId = (await prisma.team.create({ data: { name: 'Ressource individuelle seule', ownerId } })).id
    bothId = (await prisma.team.create({ data: { name: 'Ressource des deux', ownerId } })).id

    await prisma.teamModuleShare.create({ data: { module: 'list-test-module', resourceId: onlyTeamSharedId, teamId, role: 'VIEWER' } })
    await prisma.moduleShare.create({ data: { module: 'list-test-module', resourceId: onlyIndividualSharedId, userId: memberId, role: 'EDITOR' } })
    await prisma.teamModuleShare.create({ data: { module: 'list-test-module', resourceId: bothId, teamId, role: 'VIEWER' } })
    await prisma.moduleShare.create({ data: { module: 'list-test-module', resourceId: bothId, userId: memberId, role: 'EDITOR' } })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: LIST_SUFFIX } } })
  })

  it('inclut la ressource partagée uniquement via TeamModuleShare (le bug rapporté)', async () => {
    const list = await sharedResourceIds('list-test-module', memberId)
    expect(list.find((r) => r.id === onlyTeamSharedId)).toMatchObject({ role: 'VIEWER' })
  })

  it('inclut toujours la ressource partagée uniquement en individuel', async () => {
    const list = await sharedResourceIds('list-test-module', memberId)
    expect(list.find((r) => r.id === onlyIndividualSharedId)).toMatchObject({ role: 'EDITOR' })
  })

  it('combine les deux sources sans doublon, en gardant le meilleur rôle', async () => {
    const list = await sharedResourceIds('list-test-module', memberId)
    const matches = list.filter((r) => r.id === bothId)
    expect(matches).toHaveLength(1)
    expect(matches[0].role).toBe('EDITOR')
  })

  it('deleteResourceShares purge aussi les partages dynamiques par équipe', async () => {
    await deleteResourceShares('list-test-module', bothId)
    expect(await prisma.moduleShare.count({ where: { module: 'list-test-module', resourceId: bothId } })).toBe(0)
    expect(await prisma.teamModuleShare.count({ where: { module: 'list-test-module', resourceId: bothId } })).toBe(0)
  })
})
