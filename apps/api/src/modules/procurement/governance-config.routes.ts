import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { isAdminEmail } from '../../lib/feature-flags.js'
import { hasRole } from './validation.js'
import { ALL_VALUES, resolveGovernanceConfig, resolveGovernanceEtat } from './governance-config.js'
import type { Champ, GovernanceValue } from './governance-config.js'
import { ensureOrgUnitConfig } from './org-unit-config.js'

const CHAMPS: Champ[] = ['TYPE_LIGNE_BUDGET', 'JALON_TYPE', 'TYPE_ACTIVITE']

function isChamp(value: unknown): value is Champ {
  return typeof value === 'string' && (CHAMPS as string[]).includes(value)
}

// Edition réservée aux administrateurs ou au valideur ayant autorité sur cet OrgUnit
// précis (même règle exacte-unité que le reste du module — cf. canDecideHierarchie).
// Les valeurs ainsi définies, elles, s'appliquent à tout le sous-arbre par héritage
// (cf. findNearestConfig) : configurer en haut n'autorise pas à éditer en bas, mais
// la config posée en haut s'y applique tant qu'aucun niveau inférieur ne surcharge.
async function canConfigure(userId: string, email: string | undefined, orgUnitId: string): Promise<boolean> {
  if (isAdminEmail(email)) return true
  return hasRole(userId, 'VALIDEUR', orgUnitId)
}

export const governanceConfigRoutes: FastifyPluginAsync = async (app) => {
  // Liste résolue (avec héritage) — utilisée par les formulaires (selects, génération
  // des jalons obligatoires à la création d'une activité).
  app.get('/governance-config', { preHandler: [app.authenticate] }, async (request, reply) => {
    const query = request.query as { orgUnitId?: string; champ?: string }
    if (!isChamp(query.champ)) return reply.status(400).send({ error: 'Champ invalide' })
    const values = await resolveGovernanceConfig(query.orgUnitId || null, query.champ)
    return values
  })

  // Vue complète pour la page d'administration : toutes les valeurs possibles de
  // l'enum, avec leur statut et leur provenance (défini ici / hérité / défaut).
  app.get('/governance-config/etat', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const query = request.query as { orgUnitId?: string }
    if (!query.orgUnitId) return reply.status(400).send({ error: 'orgUnitId requis' })
    if (!(await canConfigure(userId, email, query.orgUnitId))) {
      return reply.status(403).send({ error: "Vous n'êtes pas autorisé à consulter la configuration de ce périmètre" })
    }
    const result: Record<Champ, Awaited<ReturnType<typeof resolveGovernanceEtat>>> = {} as never
    for (const champ of CHAMPS) {
      result[champ] = await resolveGovernanceEtat(query.orgUnitId, champ)
    }
    return result
  })

  // Définit le jeu complet de valeurs pour un (orgUnit, champ) donné — remplace toute
  // configuration locale existante pour ce couple (upsert ligne par ligne + suppression
  // de celles qui ne sont plus envoyées, pour permettre de revenir à l'héritage).
  app.put('/governance-config', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const body = request.body as { orgUnitId?: string; champ?: string; valeurs?: GovernanceValue[] }
    if (!body.orgUnitId) return reply.status(400).send({ error: 'orgUnitId requis' })
    if (!isChamp(body.champ)) return reply.status(400).send({ error: 'Champ invalide' })
    const orgUnitId = body.orgUnitId
    const champ = body.champ
    if (!(await canConfigure(userId, email, orgUnitId))) {
      return reply.status(403).send({ error: "Vous n'êtes pas autorisé à configurer ce périmètre" })
    }
    const allowed = new Set(ALL_VALUES[champ])
    const valeurs = (body.valeurs ?? []).filter((v) => allowed.has(v.valeur))

    if (valeurs.length > 0) await ensureOrgUnitConfig(orgUnitId, userId)
    await prisma.$transaction([
      prisma.governanceConfig.deleteMany({ where: { orgUnitId, champ } }),
      ...(valeurs.length > 0
        ? [prisma.governanceConfig.createMany({
            data: valeurs.map((v, i) => ({
              ownerId: userId,
              orgUnitId,
              champ,
              valeur: v.valeur,
              actif: v.actif,
              obligatoire: !!v.obligatoire,
              ordre: i,
            })),
          })]
        : []),
    ])

    return resolveGovernanceEtat(orgUnitId, champ)
  })

  // Revient à l'héritage (supprime toute configuration locale pour ce couple).
  app.delete('/governance-config', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const query = request.query as { orgUnitId?: string; champ?: string }
    if (!query.orgUnitId) return reply.status(400).send({ error: 'orgUnitId requis' })
    if (!isChamp(query.champ)) return reply.status(400).send({ error: 'Champ invalide' })
    if (!(await canConfigure(userId, email, query.orgUnitId))) {
      return reply.status(403).send({ error: "Vous n'êtes pas autorisé à configurer ce périmètre" })
    }
    await prisma.governanceConfig.deleteMany({ where: { orgUnitId: query.orgUnitId, champ: query.champ } })
    return reply.status(204).send()
  })
}
