import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { notify } from '../../lib/notify.js'
import { canManageChallenge, isJuror } from './challenge-access.js'
import { computeRanking } from './ranking.js'

const criterionSchema = z.object({
  label: z.string().min(1).max(120),
  poids: z.number().int().min(1).max(5).default(1),
})
const criterionEditSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  poids: z.number().int().min(1).max(5).optional(),
  ordre: z.number().int().optional(),
})
const jurorSchema = z.object({ email: z.string().email() })
const scoresSchema = z.object({
  scores: z.array(z.object({
    criterionId: z.string().min(1),
    note: z.number().int().min(0).max(10),
    commentaire: z.string().max(1000).optional(),
  })).min(1),
})

// Un référentiel de notation stable pendant l'évaluation : plus de création/édition/
// suppression de critères une fois le challenge en EVALUATION ou CLOSED.
function assertCriteriaEditable(status: string): string | null {
  if (status === 'EVALUATION' || status === 'CLOSED') {
    return 'Les critères sont verrouillés une fois le challenge en évaluation.'
  }
  return null
}

export const scoringRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  // ── Critères ──────────────────────────────────────────────────────────────────

  app.get('/challenges/:id/criteria', async (request, reply) => {
    const { id: challengeId } = request.params as { id: string }
    const challenge = await prisma.innovationChallenge.findUnique({ where: { id: challengeId } })
    if (!challenge) return reply.status(404).send({ error: 'Challenge introuvable.' })
    return prisma.challengeCriterion.findMany({ where: { challengeId }, orderBy: { ordre: 'asc' } })
  })

  app.post('/challenges/:id/criteria', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id: challengeId } = request.params as { id: string }
    const challenge = await prisma.innovationChallenge.findUnique({ where: { id: challengeId } })
    if (!challenge) return reply.status(404).send({ error: 'Challenge introuvable.' })
    if (!(await canManageChallenge(challenge, userId, email))) return reply.status(403).send({ error: 'Vous ne pouvez pas gérer les critères de ce challenge.' })
    const lockError = assertCriteriaEditable(challenge.status)
    if (lockError) return reply.status(400).send({ error: lockError })

    const body = criterionSchema.parse(request.body)
    const count = await prisma.challengeCriterion.count({ where: { challengeId } })
    const criterion = await prisma.challengeCriterion.create({ data: { challengeId, label: body.label, poids: body.poids, ordre: count } })
    return reply.status(201).send(criterion)
  })

  app.patch('/challenges/:id/criteria/:criterionId', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id: challengeId, criterionId } = request.params as { id: string; criterionId: string }
    const challenge = await prisma.innovationChallenge.findUnique({ where: { id: challengeId } })
    if (!challenge) return reply.status(404).send({ error: 'Challenge introuvable.' })
    if (!(await canManageChallenge(challenge, userId, email))) return reply.status(403).send({ error: 'Vous ne pouvez pas gérer les critères de ce challenge.' })
    const lockError = assertCriteriaEditable(challenge.status)
    if (lockError) return reply.status(400).send({ error: lockError })

    const existing = await prisma.challengeCriterion.findUnique({ where: { id: criterionId } })
    if (!existing || existing.challengeId !== challengeId) return reply.status(404).send({ error: 'Critère introuvable.' })

    const data = criterionEditSchema.parse(request.body)
    return prisma.challengeCriterion.update({ where: { id: criterionId }, data })
  })

  app.delete('/challenges/:id/criteria/:criterionId', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id: challengeId, criterionId } = request.params as { id: string; criterionId: string }
    const challenge = await prisma.innovationChallenge.findUnique({ where: { id: challengeId } })
    if (!challenge) return reply.status(404).send({ error: 'Challenge introuvable.' })
    if (!(await canManageChallenge(challenge, userId, email))) return reply.status(403).send({ error: 'Vous ne pouvez pas gérer les critères de ce challenge.' })
    const lockError = assertCriteriaEditable(challenge.status)
    if (lockError) return reply.status(400).send({ error: lockError })

    const existing = await prisma.challengeCriterion.findUnique({ where: { id: criterionId } })
    if (!existing || existing.challengeId !== challengeId) return reply.status(404).send({ error: 'Critère introuvable.' })

    await prisma.challengeCriterion.delete({ where: { id: criterionId } })
    return reply.status(204).send()
  })

  // ── Jurés ─────────────────────────────────────────────────────────────────────

  app.get('/challenges/:id/jurors', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id: challengeId } = request.params as { id: string }
    const challenge = await prisma.innovationChallenge.findUnique({ where: { id: challengeId } })
    if (!challenge) return reply.status(404).send({ error: 'Challenge introuvable.' })
    if (!(await canManageChallenge(challenge, userId, email))) return reply.status(403).send({ error: 'Réservé aux administrateurs du challenge.' })
    return prisma.challengeJuror.findMany({ where: { challengeId }, include: { user: { select: { id: true, name: true, email: true } } } })
  })

  app.post('/challenges/:id/jurors', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id: challengeId } = request.params as { id: string }
    const challenge = await prisma.innovationChallenge.findUnique({ where: { id: challengeId } })
    if (!challenge) return reply.status(404).send({ error: 'Challenge introuvable.' })
    if (!(await canManageChallenge(challenge, userId, email))) return reply.status(403).send({ error: 'Réservé aux administrateurs du challenge.' })

    const { email: jurorEmail } = jurorSchema.parse(request.body)
    const jurorUser = await prisma.user.findUnique({ where: { email: jurorEmail.toLowerCase() }, select: { id: true, name: true, email: true } })
    if (!jurorUser) return reply.status(404).send({ error: 'Aucun compte avec cet email.' })

    const juror = await prisma.challengeJuror.upsert({
      where: { challengeId_userId: { challengeId, userId: jurorUser.id } },
      create: { challengeId, userId: jurorUser.id },
      update: {},
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    if (jurorUser.id !== userId) {
      await notify({
        userId: jurorUser.id,
        type: 'INNOVATION_JUROR_INVITED',
        title: 'Invité comme juré',
        body: `Vous êtes désormais juré du challenge « ${challenge.nom} ».`,
        link: `/innovation/challenges/${challengeId}`,
      })
    }
    return reply.status(201).send(juror)
  })

  app.delete('/challenges/:id/jurors/:jurorUserId', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id: challengeId, jurorUserId } = request.params as { id: string; jurorUserId: string }
    const challenge = await prisma.innovationChallenge.findUnique({ where: { id: challengeId } })
    if (!challenge) return reply.status(404).send({ error: 'Challenge introuvable.' })
    if (!(await canManageChallenge(challenge, userId, email))) return reply.status(403).send({ error: 'Réservé aux administrateurs du challenge.' })

    await prisma.challengeJuror.deleteMany({ where: { challengeId, userId: jurorUserId } })
    return reply.status(204).send()
  })

  // ── Notation ──────────────────────────────────────────────────────────────────

  // POST /challenges/:id/entries/:ficheId/scores — un juré note une fiche inscrite,
  // critère par critère (batch), uniquement pendant l'évaluation.
  app.post('/challenges/:id/entries/:ficheId/scores', async (request, reply) => {
    const { id: jurorId } = request.user as { id: string }
    const { id: challengeId, ficheId } = request.params as { id: string; ficheId: string }

    const challenge = await prisma.innovationChallenge.findUnique({ where: { id: challengeId } })
    if (!challenge) return reply.status(404).send({ error: 'Challenge introuvable.' })
    if (!(await isJuror(challengeId, jurorId))) return reply.status(403).send({ error: 'Réservé aux jurés de ce challenge.' })
    if (challenge.status !== 'EVALUATION') return reply.status(400).send({ error: 'La notation n\'est ouverte que pendant l\'évaluation.' })

    const entry = await prisma.challengeEntry.findUnique({ where: { challengeId_ficheId: { challengeId, ficheId } } })
    if (!entry) return reply.status(404).send({ error: 'Cette fiche n\'est pas inscrite à ce challenge.' })

    const { scores } = scoresSchema.parse(request.body)
    const criterionIds = scores.map((s) => s.criterionId)
    const validCriteria = await prisma.challengeCriterion.findMany({ where: { id: { in: criterionIds }, challengeId } })
    if (validCriteria.length !== new Set(criterionIds).size) {
      return reply.status(400).send({ error: 'Un ou plusieurs critères sont invalides pour ce challenge.' })
    }

    await prisma.$transaction(
      scores.map((s) =>
        prisma.challengeScore.upsert({
          where: { entryId_criterionId_jurorId: { entryId: entry.id, criterionId: s.criterionId, jurorId } },
          create: { entryId: entry.id, criterionId: s.criterionId, jurorId, note: s.note, commentaire: s.commentaire },
          update: { note: s.note, commentaire: s.commentaire },
        }),
      ),
    )

    const saved = await prisma.challengeScore.findMany({ where: { entryId: entry.id, jurorId } })
    return reply.status(200).send(saved)
  })

  // GET /challenges/:id/entries/:ficheId/scores — mes notes existantes sur cette fiche (pré-remplissage du formulaire).
  app.get('/challenges/:id/entries/:ficheId/scores', async (request, reply) => {
    const { id: jurorId } = request.user as { id: string }
    const { id: challengeId, ficheId } = request.params as { id: string; ficheId: string }
    const entry = await prisma.challengeEntry.findUnique({ where: { challengeId_ficheId: { challengeId, ficheId } } })
    if (!entry) return reply.status(404).send({ error: 'Inscription introuvable.' })
    return prisma.challengeScore.findMany({ where: { entryId: entry.id, jurorId } })
  })

  // ── Classement ────────────────────────────────────────────────────────────────

  // Admins pendant EVALUATION (pour piloter la désignation des lauréats), tout le
  // monde une fois CLOSED (transparence des résultats).
  app.get('/challenges/:id/ranking', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id: challengeId } = request.params as { id: string }
    const challenge = await prisma.innovationChallenge.findUnique({ where: { id: challengeId } })
    if (!challenge) return reply.status(404).send({ error: 'Challenge introuvable.' })
    if (challenge.status !== 'CLOSED' && !(await canManageChallenge(challenge, userId, email))) {
      return reply.status(403).send({ error: 'Le classement n\'est visible qu\'après clôture (ou pour les administrateurs du challenge).' })
    }

    const [entries, criteria, scores] = await Promise.all([
      prisma.challengeEntry.findMany({
        where: { challengeId },
        include: { fiche: { select: { id: true, title: true, authorId: true, author: { select: { id: true, name: true } } } } },
      }),
      prisma.challengeCriterion.findMany({ where: { challengeId } }),
      prisma.challengeScore.findMany({ where: { entry: { challengeId } } }),
    ])

    const ranking = computeRanking(entries, criteria, scores)
    const ficheById = new Map(entries.map((e) => [e.id, e.fiche]))
    return ranking.map((r) => ({ ...r, fiche: ficheById.get(r.entryId) }))
  })

  // GET /challenges/:id/ranking.csv — export du classement (PR F, lot pré-release).
  // Même garde de visibilité que GET /ranking : admin pendant EVALUATION, tous une fois CLOSED.
  app.get('/challenges/:id/ranking.csv', async (request, reply) => {
    const { id: userId, email } = request.user as { id: string; email: string }
    const { id: challengeId } = request.params as { id: string }
    const challenge = await prisma.innovationChallenge.findUnique({ where: { id: challengeId } })
    if (!challenge) return reply.status(404).send({ error: 'Challenge introuvable.' })
    if (challenge.status !== 'CLOSED' && !(await canManageChallenge(challenge, userId, email))) {
      return reply.status(403).send({ error: 'Le classement n\'est visible qu\'après clôture (ou pour les administrateurs du challenge).' })
    }

    const [entries, criteria, scores] = await Promise.all([
      prisma.challengeEntry.findMany({
        where: { challengeId },
        include: { fiche: { select: { id: true, title: true, authorId: true, author: { select: { id: true, name: true } } } } },
      }),
      prisma.challengeCriterion.findMany({ where: { challengeId } }),
      prisma.challengeScore.findMany({ where: { entry: { challengeId } } }),
    ])
    const ranking = computeRanking(entries, criteria, scores)
    const ficheById = new Map(entries.map((e) => [e.id, e.fiche]))

    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
    const header = ['Rang', 'Fiche', 'Auteur', 'Score pondéré', ...criteria.map((c) => `${c.label} (poids ${c.poids})`)]
    const rows = ranking.map((r, i) => {
      const fiche = ficheById.get(r.entryId)
      const perCriterion = criteria.map((c) => {
        const avg = r.criteriaAverages.find((ca) => ca.criterionId === c.id)?.average
        return avg == null ? '' : avg.toFixed(1)
      })
      return [
        String(i + 1),
        fiche?.title ?? '',
        fiche?.author.name ?? '',
        r.weightedAverage == null ? '' : r.weightedAverage.toFixed(2),
        ...perCriterion,
      ].map(esc).join(',')
    })
    const csv = [header.map(esc).join(','), ...rows].join('\r\n')

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="classement-${challengeId}.csv"`)
    return reply.send('﻿' + csv)
  })
}
