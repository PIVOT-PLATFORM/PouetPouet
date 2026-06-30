// Jeu de données de démonstration pour le module Commande publique.
//
// Contrats, demandes d'achat et commandes ne sont plus seedés ici : ils vivent dans
// les pods mock externes (apps/pgi-mock, apps/ldap-mock pour l'organigramme), générés
// automatiquement à leur démarrage. Ce script se limite à ce que l'app gère
// réellement : utilisateurs fictifs, seuils d'approbation (OrgUnitConfig), profils
// achat, délégations, référentiels de gouvernance, 50+ Activités, et l'"engagement"
// de quelques demandes d'achat réelles du PGI dans un circuit de validation pour
// rejouer des scénarios de démo (validée → commande, escalade, rejetée, non engagée).
//
// Prérequis : les pods doivent tourner avant ce script —
//   docker compose up -d postgres redis pgi-mock ldap-mock
//
// Usage : npx tsx --env-file=.env scripts/seed-procurement.ts <email-du-chef-de-projet>
// (ou : npm run db:seed:procurement -- <email>)
import bcrypt from 'bcryptjs'
import { prisma } from '../src/lib/prisma.js'
import { buildApprobationChain } from '../src/modules/procurement/validation.js'
import { ensureOrgUnitConfig } from '../src/modules/procurement/org-unit-config.js'
import { ldapClient } from '../src/lib/ldap-client.js'
import { pgiClient } from '../src/lib/pgi-client.js'
import type { PgiDemandeAchat } from '../src/lib/pgi-client.js'

const DEMO_PASSWORD = 'Demo-PGI-2026!'

// ── Utilitaires de génération aléatoire ────────────────────────────────────────
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}
function randomDateBetween(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

async function findOrCreateUser(email: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return existing
  const password = await bcrypt.hash(DEMO_PASSWORD, 12)
  return prisma.user.create({ data: { email, name, password, emailVerified: true } })
}

function daTotal(da: PgiDemandeAchat): number {
  return da.lots.reduce((s, l) => s + l.montant, 0)
}

async function main() {
  const targetEmail = process.argv[2]
  if (!targetEmail) {
    console.error('Usage: seed-procurement.ts <email-du-chef-de-projet>')
    process.exit(2)
  }

  const target = await prisma.user.findUnique({ where: { email: targetEmail } })
  if (!target) {
    console.error(`Utilisateur introuvable : ${targetEmail} (créez d'abord ce compte via /register)`)
    process.exit(1)
  }

  const already = await prisma.profilAchat.findFirst({ where: { userId: target.id, role: 'CHEF_DE_PROJET' } })
  if (already) {
    console.log(`Des données existent déjà pour ${targetEmail} — rien à faire (idempotence).`)
    await prisma.$disconnect()
    return
  }

  console.log('── Rustine PGI : génération du jeu de données de démonstration ──')

  // ── Organigramme (lu depuis le pod ldap-mock) ──
  const orgUnits = await ldapClient.listOrgUnits()
  const comex = orgUnits.find((u) => u.niveau === 'COMEX')
  const direction = orgUnits.find((u) => u.niveau === 'DIRECTION')
  const division = orgUnits.find((u) => u.niveau === 'DIVISION')
  const departement = orgUnits.find((u) => u.niveau === 'DEPARTEMENT')
  const equipes = orgUnits.filter((u) => u.niveau === 'EQUIPE')
  const [equipeBackend, equipeFrontend] = equipes
  if (!comex || !direction || !division || !departement || !equipeBackend || !equipeFrontend) {
    console.error("Organigramme incomplet côté ldap-mock — le pod tourne-t-il bien (docker compose up -d ldap-mock) ?")
    process.exit(1)
  }
  console.log(`Organigramme lu depuis ldap-mock : ${orgUnits.length} périmètres.`)

  // ── Utilisateurs fictifs (managers, finance, contract manager) ──
  const managerDirection = await findOrCreateUser('manager.direction@demo-pgi.local', 'Camille Directeur')
  const managerDivision = await findOrCreateUser('manager.division@demo-pgi.local', 'Sacha Division')
  const managerDepartement = await findOrCreateUser('manager.departement@demo-pgi.local', 'Dominique Département')
  const managerEquipe = await findOrCreateUser('manager.equipe@demo-pgi.local', 'Robin Manager')
  const financier = await findOrCreateUser('finance@demo-pgi.local', 'Finance Contrôle')
  await findOrCreateUser('contract.manager@demo-pgi.local', 'Achats ContractManager')
  console.log(`Comptes de démo créés/réutilisés (mot de passe : ${DEMO_PASSWORD})`)

  // ── Seuils d'approbation (OrgUnitConfig — la seule donnée propre à l'app pour
  // une unité organisationnelle, la structure elle-même vient du LDAP externe) ──
  async function setSeuil(orgUnitId: string, seuil: number | null) {
    await ensureOrgUnitConfig(orgUnitId, target.id)
    await prisma.orgUnitConfig.update({ where: { id: orgUnitId }, data: { seuilApprobation: seuil } })
  }
  await setSeuil(comex.id, null)
  await setSeuil(direction.id, 200_000)
  await setSeuil(division.id, 100_000)
  await setSeuil(departement.id, 50_000)
  await setSeuil(equipeBackend.id, 15_000)
  await setSeuil(equipeFrontend.id, 15_000)
  console.log('Seuils d\'approbation configurés : Direction 200k€, Division 100k€, Département 50k€, Équipes 15k€, COMEX illimité.')

  // ── Profils achat ──
  await prisma.profilAchat.create({ data: { userId: target.id, role: 'CHEF_DE_PROJET', orgUnitId: equipeBackend.id } })
  await prisma.profilAchat.create({ data: { userId: managerDirection.id, role: 'VALIDEUR', orgUnitId: direction.id } })
  await prisma.profilAchat.create({ data: { userId: managerDivision.id, role: 'VALIDEUR', orgUnitId: division.id } })
  await prisma.profilAchat.create({ data: { userId: managerDepartement.id, role: 'VALIDEUR', orgUnitId: departement.id } })
  await prisma.profilAchat.create({ data: { userId: managerEquipe.id, role: 'VALIDEUR', orgUnitId: equipeBackend.id } })
  await prisma.profilAchat.create({ data: { userId: managerEquipe.id, role: 'VALIDEUR', orgUnitId: equipeFrontend.id } })
  await prisma.profilAchat.create({ data: { userId: financier.id, role: 'FINANCE' } })
  console.log('Profils achat assignés (chef de projet, valideurs, finance).')

  // ── Délégation de démonstration ──
  const today = new Date()
  const inTwoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
  await prisma.delegationValidation.create({
    data: {
      delegantId: managerEquipe.id,
      delegueId: target.id,
      orgUnitId: equipeBackend.id,
      pouvoir: 'PARTIEL',
      pourcentage: 0.5,
      dateDebut: today,
      dateFin: inTwoWeeks,
    },
  })
  console.log('Délégation de démonstration : Robin Manager → vous, pouvoir partiel (50%) sur Équipe Backend, 14 jours.')

  // ── Contrats lus depuis le pod pgi-mock (pour rattacher des lignes budgétaires) ──
  const contratsPage = await pgiClient.listContrats({ pageSize: 100 })
  const allContratIds = contratsPage.items.map((c) => c.id)
  console.log(`${contratsPage.total} contrats disponibles côté pgi-mock (référencés depuis le budget des activités).`)

  // ── Produit + Activité de démo (gouvernance complète) ──
  const produit = await prisma.produit.create({ data: { ownerId: target.id, nom: 'SI Ressources Humaines' } })

  const activite = await prisma.activite.create({
    data: {
      ownerId: target.id,
      nom: 'Refonte SI RH',
      type: 'REFONTE',
      statut: 'ACTIF',
      meteo: 'ORANGE',
      description: "Modernisation du système d'information RH (paie, congés, recrutement).",
      enjeux: true,
      pmt: 'PMT-2026-DSI-04',
      planProduction: true,
      schemaDirecteur: true,
      hopexLien: 'https://hopex.exemple.local/architecture/si-rh',
      piloteId: target.id,
      produitId: produit.id,
      departementId: departement.id,
      pole: 'Pôle Applications RH',
      domaineMetier: 'Ressources Humaines',
      sousDomaineMetier: 'Paie & Administration du personnel',
      capaciteMetier: 'Gérer le personnel',
      sousCapaciteMetier: 'Gérer la paie',
      prioriteMetier: 'P1',
      gains: {
        create: [
          { montant: 80_000, typologie: 'Productivité', commentaire: 'Automatisation de la saisie des congés.', order: 0 },
          { montant: 25_000, typologie: 'Qualité', commentaire: 'Réduction des erreurs de paie.', order: 1 },
        ],
      },
      faitsMarquants: {
        create: [
          { date: new Date('2026-03-01'), texte: 'Cadrage initial validé en comité de direction.' },
          { date: new Date('2026-05-15'), texte: 'Choix de la solution éditeur finalisé.' },
        ],
      },
      jalons: {
        create: [
          { type: 'A_ARRIVEE', order: 0, datePrevue: new Date('2026-02-01'), dateReelle: new Date('2026-02-01'), decision: 'GO', obligatoire: true },
          { type: 'B_ETUDE', order: 1, datePrevue: new Date('2026-04-01'), dateReelle: new Date('2026-04-10'), decision: 'GO', obligatoire: true },
          { type: 'C_REALISATION', order: 2, datePrevue: new Date('2026-09-01'), obligatoire: true },
          { type: 'D_DECLARATION_GAINS', order: 3, obligatoire: true },
          { type: 'E_DECOMMISSIONNEMENT', order: 4, obligatoire: true },
          { type: 'REVUE_PROJET', order: 5, datePrevue: new Date('2026-06-01'), decision: 'Avancement conforme, vigilance sur le planning éditeur.', obligatoire: true },
          { type: 'J7_MEP', order: 6, obligatoire: true },
          { type: 'J3_RECETTE', order: 7, obligatoire: true },
        ],
      },
      risques: {
        create: [
          {
            titre: 'Retard de livraison éditeur', categorie: 'Fournisseur', probabilite: 3, impact: 4,
            planMitigation: 'Pénalités contractuelles + plan de secours interne.', responsable: 'Robin Manager',
            jiraLien: 'https://jira.exemple.local/browse/SIRH-101',
          },
          {
            titre: 'Reprise de données paie incomplète', categorie: 'Technique', probabilite: 2, impact: 5,
            planMitigation: 'Double run sur 2 cycles de paie avant bascule.', responsable: 'Chef de Projet Démo',
            statut: 'EN_COURS', jiraLien: 'https://jira.exemple.local/browse/SIRH-102',
          },
        ],
      },
      budgetLignes: {
        create: [
          { annee: 2026, type: 'OPEX', montantMo: 40_000, montantHmo: 15_000, utilisateurMetier: 'DRH', priorite: 'P1', objetGestion: 'OG-SIRH-2026', jalonPhase: 'B_ETUDE', contratId: allContratIds[0] ?? null },
          { annee: 2026, type: 'CAPEX', montantMo: 60_000, montantHmo: 90_000, utilisateurMetier: 'DRH', priorite: 'P1', objetGestion: 'OG-SIRH-2026', jalonPhase: 'C_REALISATION', contratId: allContratIds[0] ?? null },
          { annee: 2027, type: 'CAPEX', montantMo: 20_000, montantHmo: 35_000, utilisateurMetier: 'DRH', priorite: 'P2', objetGestion: 'OG-SIRH-2027', jalonPhase: 'C_REALISATION' },
          { annee: 2027, type: 'APCO', montantMo: 10_000, montantHmo: null, utilisateurMetier: 'DRH', priorite: 'P2', objetGestion: 'OG-SIRH-2027' },
        ],
      },
    },
  })
  console.log(`Produit créé : ${produit.nom} — Activité créée : ${activite.nom} (8 jalons PMPG, 2 gains, 2 risques, 4 lignes budgétaires)`)

  // ── 2 produits supplémentaires + 50 activités aléatoires couvrant tous les types ──
  const produit2 = await prisma.produit.create({ data: { ownerId: target.id, nom: 'Plateforme Clients Digital' } })
  const produit3 = await prisma.produit.create({ data: { ownerId: target.id, nom: 'SI Achats & Finance' } })
  const allProduits = [produit, produit2, produit3]

  const ALL_TYPES_ACTIVITE = ['REFONTE', 'RUN', 'NOUVEAU', 'EVOLUTION', 'MAINTENANCE', 'DECOMMISSIONNEMENT', 'AUTRE'] as const
  const ACTIVITE_STATUTS = ['ACTIF', 'ACTIF', 'ACTIF', 'SUSPENDU', 'CLOTURE'] as const
  const METEOS = ['VERT', 'ORANGE', 'ROUGE', 'GRIS'] as const
  const TYPES_LIGNE_BUDGET = ['OPEX', 'CAPEX', 'APCO'] as const
  const RISQUE_CATEGORIES = ['Technique', 'Fournisseur', 'Organisationnel', 'Financier', 'Réglementaire', 'Sécurité']
  const RISQUE_TITRES = ['Retard planning', 'Dépassement budgétaire', 'Indisponibilité ressource clé', 'Dette technique', 'Non-conformité RGPD', 'Rupture fournisseur', 'Résistance au changement']
  const ACTIVITE_NOMS = ['Refonte portail', 'Migration cloud', 'Décommissionnement legacy', 'Run applicatif', 'Évolution réglementaire', 'Nouveau produit digital', 'Maintenance corrective', 'Modernisation API', 'Mise en conformité', 'Optimisation process']
  const POLES = ['Pôle Applications RH', 'Pôle Digital Client', 'Pôle Data', 'Pôle Infrastructure', 'Pôle Sécurité', null]
  const DOMAINES_METIER = ['Ressources Humaines', 'Relation Client', 'Finance', 'Logistique', 'Production', null]
  const activiteOwners = [target, managerDirection, managerDepartement, managerEquipe]
  const JALONS_FIXES = ['A_ARRIVEE', 'B_ETUDE', 'C_REALISATION', 'D_DECLARATION_GAINS', 'E_DECOMMISSIONNEMENT', 'REVUE_PROJET', 'J7_MEP', 'J3_RECETTE'] as const
  const departementsDisponibles = [departement, ...orgUnits.filter((u) => u.niveau === 'DEPARTEMENT' && u.id !== departement.id)]

  const allActiviteIds: string[] = [activite.id]
  const BULK_ACTIVITES = 50
  for (let i = 0; i < BULK_ACTIVITES; i++) {
    const type = i < ALL_TYPES_ACTIVITE.length ? ALL_TYPES_ACTIVITE[i] : pick(ALL_TYPES_ACTIVITE)
    const gainsCount = randomInt(0, 3)
    const risquesCount = randomInt(0, 3)
    const budgetCount = randomInt(0, 4)
    const faitsCount = randomInt(0, 2)
    const produitChoice = Math.random() < 0.75 ? pick(allProduits) : null
    const a = await prisma.activite.create({
      data: {
        ownerId: pick(activiteOwners).id,
        nom: `${pick(ACTIVITE_NOMS)} ${i + 1}`,
        type,
        statut: pick(ACTIVITE_STATUTS),
        meteo: pick(METEOS),
        enjeux: Math.random() < 0.3,
        description: Math.random() < 0.6 ? `Activité de test générée automatiquement (#${i + 1}).` : null,
        pmt: Math.random() < 0.4 ? `PMT-2026-${randomInt(1, 50)}` : null,
        planProduction: Math.random() < 0.3,
        schemaDirecteur: Math.random() < 0.3,
        hopexLien: Math.random() < 0.2 ? `https://hopex.exemple.local/architecture/${i + 1}` : null,
        piloteId: Math.random() < 0.5 ? pick(activiteOwners).id : null,
        produitId: produitChoice?.id ?? null,
        departementId: Math.random() < 0.5 ? pick(departementsDisponibles).id : null,
        pole: pick(POLES),
        domaineMetier: pick(DOMAINES_METIER),
        sousDomaineMetier: Math.random() < 0.3 ? `Sous-domaine ${randomInt(1, 9)}` : null,
        capaciteMetier: Math.random() < 0.3 ? `Capacité ${randomInt(1, 9)}` : null,
        sousCapaciteMetier: Math.random() < 0.2 ? `Sous-capacité ${randomInt(1, 9)}` : null,
        prioriteMetier: Math.random() < 0.6 ? pick(['P1', 'P2', 'P3']) : null,
        jalons: {
          create: JALONS_FIXES.map((jt, ji) => ({
            type: jt,
            order: ji,
            obligatoire: true,
            datePrevue: Math.random() < 0.5 ? randomDateBetween(new Date('2025-06-01'), new Date('2027-12-31')) : null,
            dateReelle: Math.random() < 0.25 ? randomDateBetween(new Date('2025-06-01'), new Date('2026-12-31')) : null,
            decision: Math.random() < 0.2 ? pick(['GO', 'GO sous réserve', 'NO GO temporaire']) : null,
          })),
        },
        gains: gainsCount === 0 ? undefined : {
          create: Array.from({ length: gainsCount }, (_, gi) => ({
            montant: randomInt(5, 150) * 1000,
            typologie: pick(['Productivité', 'Qualité', 'Coûts évités', "Chiffre d'affaires"]),
            commentaire: Math.random() < 0.5 ? 'Estimation à affiner en phase étude.' : null,
            order: gi,
          })),
        },
        risques: risquesCount === 0 ? undefined : {
          create: Array.from({ length: risquesCount }, () => ({
            titre: pick(RISQUE_TITRES),
            categorie: pick(RISQUE_CATEGORIES),
            probabilite: randomInt(1, 5),
            impact: randomInt(1, 5),
            planMitigation: Math.random() < 0.5 ? 'Plan de mitigation à formaliser.' : null,
            responsable: Math.random() < 0.5 ? pick(activiteOwners).name : null,
            jiraLien: Math.random() < 0.4 ? `https://jira.exemple.local/browse/TST-${randomInt(100, 999)}` : null,
            statut: pick(['OUVERT', 'EN_COURS', 'CLOS']),
          })),
        },
        budgetLignes: budgetCount === 0 ? undefined : {
          create: Array.from({ length: budgetCount }, () => ({
            annee: pick([2025, 2026, 2027, 2028]),
            type: pick(TYPES_LIGNE_BUDGET),
            montantMo: Math.random() < 0.7 ? randomInt(5, 100) * 1000 : null,
            montantHmo: Math.random() < 0.5 ? randomInt(5, 80) * 1000 : null,
            utilisateurMetier: Math.random() < 0.4 ? pick(['DRH', 'DSI', 'DAF', 'Métier']) : null,
            priorite: Math.random() < 0.4 ? pick(['P1', 'P2', 'P3']) : null,
            contratId: Math.random() < 0.3 && allContratIds.length > 0 ? pick(allContratIds) : null,
          })),
        },
        faitsMarquants: faitsCount === 0 ? undefined : {
          create: Array.from({ length: faitsCount }, () => ({
            date: randomDateBetween(new Date('2025-01-01'), new Date('2026-06-01')),
            texte: pick(['Cadrage validé.', 'Revue de jalon réalisée.', 'Risque escaladé en COMEX.', 'Recette partielle effectuée.']),
          })),
        },
      },
    })
    allActiviteIds.push(a.id)
  }
  console.log(`${BULK_ACTIVITES} activités aléatoires créées (tous les types représentés) — 3 produits au total.`)

  // ── Engagement de demandes d'achat réelles du PGI dans un circuit de validation ──
  // Les DA naissent côté PGI (pgi-mock) ; l'app les découvre et leur attache une
  // enveloppe workflow. On rejoue ici les scénarios de démo habituels en cherchant,
  // parmi les DA générées aléatoirement par le pod, des montants qui correspondent
  // naturellement à chaque palier d'escalade.
  const daPage = await pgiClient.listDemandesAchat({ pageSize: 300 })
  const allDAs = daPage.items
  const used = new Set<string>()
  function findDaByTotal(min: number, max: number): PgiDemandeAchat | undefined {
    return allDAs.find((d) => !used.has(d.id) && daTotal(d) >= min && daTotal(d) < max)
  }

  const managerByOrgUnit: Record<string, string> = {
    [equipeBackend.id]: managerEquipe.id,
    [equipeFrontend.id]: managerEquipe.id,
    [departement.id]: managerDepartement.id,
    [division.id]: managerDivision.id,
    [direction.id]: managerDirection.id,
    [comex.id]: target.id,
  }

  async function engager(da: PgiDemandeAchat, orgUnitId: string, opts: { fullyApprove?: boolean; reject?: boolean; activiteId?: string | null } = {}) {
    used.add(da.id)
    await ensureOrgUnitConfig(orgUnitId, target.id)
    const montant = daTotal(da)
    const chain = await buildApprobationChain(orgUnitId, montant)
    const workflow = await prisma.demandeAchatWorkflow.create({
      data: { demandeAchatExternalId: da.id, ownerId: target.id, orgUnitId, activiteId: opts.activiteId ?? null },
    })
    await prisma.commandeApprobation.createMany({
      data: chain.map((step, order) => ({ demandeAchatWorkflowId: workflow.id, order, type: step.type, orgUnitId: step.orgUnitId })),
    })

    if (opts.reject) {
      const first = await prisma.commandeApprobation.findFirst({ where: { demandeAchatWorkflowId: workflow.id }, orderBy: { order: 'asc' } })
      if (first) {
        await prisma.commandeApprobation.update({
          where: { id: first.id },
          data: { statut: 'REJETEE', validateurId: managerEquipe.id, decidedAt: new Date(), commentaire: 'Budget équipe déjà engagé ce trimestre.' },
        })
        await prisma.demandeAchatWorkflow.update({ where: { id: workflow.id }, data: { validationStatut: 'REJETEE' } })
      }
    } else if (opts.fullyApprove) {
      const steps = await prisma.commandeApprobation.findMany({ where: { demandeAchatWorkflowId: workflow.id }, orderBy: { order: 'asc' } })
      for (const step of steps) {
        const validateurId = step.type === 'FINANCE' ? financier.id : managerByOrgUnit[step.orgUnitId!] ?? target.id
        await prisma.commandeApprobation.update({ where: { id: step.id }, data: { statut: 'APPROUVEE', validateurId, decidedAt: new Date() } })
      }
      await prisma.demandeAchatWorkflow.update({ where: { id: workflow.id }, data: { validationStatut: 'VALIDEE' } })
      await pgiClient.createCommande({ demandeAchatId: da.id })
    }
    return workflow
  }

  let scenarios = 0
  const daValidee = findDaByTotal(0, 15_000)
  if (daValidee) { await engager(daValidee, equipeBackend.id, { fullyApprove: true, activiteId: activite.id }); scenarios++ }
  const daDivision = findDaByTotal(15_000, 100_000)
  if (daDivision) { await engager(daDivision, equipeBackend.id); scenarios++ }
  const daComex = findDaByTotal(200_000, Infinity)
  if (daComex) { await engager(daComex, equipeBackend.id); scenarios++ }
  const daRejetee = findDaByTotal(0, 15_000)
  if (daRejetee) { await engager(daRejetee, equipeBackend.id, { reject: true }); scenarios++ }
  // Le reste des DA générées par le pod restent volontairement "non engagées".

  console.log(`${scenarios} demandes d'achat engagées dans un circuit de validation (scénarios de démo) sur ${allDAs.length} disponibles côté PGI.`)
  console.log('── Terminé. Contrats/demandes d\'achat/commandes vivent désormais dans les pods mock externes. ──')
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
