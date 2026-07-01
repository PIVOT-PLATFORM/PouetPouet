/**
 * Seed de démonstration — crée un jeu de comptes et de données réalistes pour
 * explorer les modules Formulaires, Parcours et Feedback à la main.
 *
 * ⚠️ DEV / DÉMO UNIQUEMENT. Le script tape l'API HTTP (donc passe par toute la
 * logique métier : partages, activation de première étape, notifications), il
 * ne touche pas Prisma directement. Les serveurs dev doivent tourner.
 *
 * Usage :
 *   cd apps/api && npm run seed:demo
 *   API_URL=http://localhost:4000 DEMO_PASSWORD=Mmdp-1234 npm run seed:demo
 *
 * Idempotent : si un compte existe déjà, on se connecte au lieu de le recréer.
 * Le profil admin nécessite que ADMIN_EMAILS contienne admin@pivot.test dans
 * l'environnement de l'API (sinon le compte est créé mais sans droits admin).
 */

const API = process.env.API_URL ?? 'http://localhost:4000'
const PWD = process.env.DEMO_PASSWORD ?? 'Mmdp-1234'
const ADMIN_EMAIL = 'admin@pivot.test'

type Json = Record<string, unknown>

async function call(method: string, path: string, token?: string, body?: unknown): Promise<{ status: number; data: any }> {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

async function registerOrLogin(name: string, email: string): Promise<{ token: string; id: string }> {
  const reg = await call('POST', '/api/auth/register', undefined, { name, email, password: PWD, bypass: true })
  if (reg.status === 200) {
    console.log(`  + ${name} <${email}>`)
    return { token: reg.data.token, id: reg.data.user.id }
  }
  const login = await call('POST', '/api/auth/login', undefined, { email, password: PWD })
  if (login.status === 200) {
    console.log(`  = ${name} <${email}> (déjà existant)`)
    return { token: login.data.token, id: login.data.user.id }
  }
  throw new Error(`register/login ${email} → ${reg.status} ${JSON.stringify(reg.data)}`)
}

async function main() {
  // fail-fast si l'API n'est pas là
  const health = await call('GET', '/health').catch(() => ({ status: 0, data: null }))
  if (health.status !== 200) {
    throw new Error(`API injoignable sur ${API} — lance les serveurs dev (npm run dev) d'abord.`)
  }

  console.log('== Utilisateurs ==')
  const admin = await registerOrLogin('Alex Admin', ADMIN_EMAIL)
  const mgr = await registerOrLogin('Marie Manager', 'manager@pivot.test')
  const appr = await registerOrLogin('Bruno Valideur', 'approver@pivot.test')
  const view = await registerOrLogin('Chloé Lectrice', 'viewer@pivot.test')

  // ── Formulaire (Marie) ──────────────────────────────────────────────
  console.log('== Formulaire (Marie) ==')
  const { data: form } = await call('POST', '/api/forms', mgr.token, {
    title: 'Satisfaction équipe — Q3',
    fields: [
      { id: 'nom', label: 'Votre prénom', type: 'short_text', required: true },
      { id: 'sat', label: 'Niveau de satisfaction', type: 'scale', required: true, scaleMin: 1, scaleMax: 5, scaleMinLabel: 'Faible', scaleMaxLabel: 'Excellent' },
      { id: 'com', label: 'Un commentaire ?', type: 'long_text', required: false },
    ],
  })
  await call('PATCH', `/api/forms/${form.id}`, mgr.token, { isPublished: true, notifyOnResponse: true })
  const { data: formDetail } = await call('GET', `/api/forms/${form.id}`, mgr.token)
  const token = formDetail.publicToken
  for (const [nom, sat, com] of [
    ['Julie', '5', 'Super trimestre, bonne ambiance !'],
    ['Karim', '4', 'Rythme soutenu mais gérable.'],
    ['Sofia', '2', 'Trop de réunions, manque de focus.'],
  ]) {
    await call('POST', `/api/forms/public/${token}/responses`, undefined, { data: { nom, sat, com } })
  }
  await call('POST', `/api/shares/form/${form.id}/invite`, mgr.token, { email: 'approver@pivot.test', role: 'EDITOR' })
  await call('POST', `/api/shares/form/${form.id}/invite`, mgr.token, { email: 'viewer@pivot.test', role: 'VIEWER' })
  console.log(`  formulaire publié (${form.id}), 3 réponses, partagé Bruno=EDITOR / Chloé=VIEWER`)

  // ── Parcours (Marie) ────────────────────────────────────────────────
  console.log('== Parcours (Marie) ==')
  const { data: tmpl } = await call('POST', '/api/parcours/templates', mgr.token, {
    name: 'Validation demande de congés',
    description: 'Circuit simple : validation manager puis confirmation.',
    category: 'rh',
    steps: [
      { type: 'validation', assignmentMode: 'user', title: 'Valider la demande', assignedTo: appr.id, slaDays: 3 },
      { type: 'info', title: 'Congés confirmés' },
    ],
    triggerType: 'manual',
  })
  await call('POST', `/api/shares/parcourTemplate/${tmpl.id}/invite`, mgr.token, { email: 'approver@pivot.test', role: 'EDITOR' })
  const { data: inst } = await call('POST', '/api/parcours/instances', mgr.token, { templateId: tmpl.id, title: 'Congés été — Marie', priority: 'high' })
  await call('POST', `/api/shares/parcourInstance/${inst.id}/invite`, mgr.token, { email: 'approver@pivot.test', role: 'EDITOR' })
  await call('POST', `/api/shares/parcourInstance/${inst.id}/invite`, mgr.token, { email: 'viewer@pivot.test', role: 'VIEWER' })
  console.log(`  template (${tmpl.id}) + instance « Congés été — Marie » (étape 1 assignée à Bruno), partagée Bruno=EDITOR / Chloé=VIEWER`)

  // ── Feedback (multi-auteurs, admin range les colonnes) ──────────────
  console.log('== Feedback ==')
  const tickets: string[] = []
  for (const [tok, title, body, type, authorName] of [
    [mgr.token, 'Export PDF des réponses de formulaire', 'Pouvoir télécharger un PDF récap par réponse.', 'FEATURE', 'Marie Manager'],
    [appr.token, 'Le picker de variables se coupe dans le panneau', 'Dans FlowBuilder, le menu déroulant est clippé.', 'BUG', 'Bruno Valideur'],
    [view.token, 'Mode sombre sur le board Feedback', 'Le kanban reste clair même en dark mode.', 'BUG', 'Chloé Lectrice'],
    [mgr.token, 'Rappels SLA configurables', 'Choisir la fréquence des rappels par parcours.', 'FEATURE', 'Marie Manager'],
  ] as const) {
    const { data: t } = await call('POST', '/api/feedback', tok, { title, body, type, authorName })
    tickets.push(t.id)
  }
  for (const tid of tickets.slice(0, 3)) {
    await call('POST', `/api/feedback/${tid}/vote`, mgr.token)
    await call('POST', `/api/feedback/${tid}/vote`, appr.token)
  }
  await call('POST', `/api/feedback/${tickets[0]}/vote`, view.token)
  // L'admin déplace les cartes (nécessite ADMIN_EMAILS=admin@pivot.test côté API)
  const moves: Array<[number, string]> = [[0, 'IMPLEMENTING'], [1, 'BACKLOG'], [3, 'DONE']]
  let adminOk = true
  for (const [i, column] of moves) {
    const r = await call('PATCH', `/api/feedback/${tickets[i]}/column`, admin.token, { column })
    if (r.status === 403) adminOk = false
  }
  console.log(`  ${tickets.length} tickets + votes` + (adminOk ? ', colonnes réparties par l\'admin' : ' (⚠️ admin non reconnu : positionne ADMIN_EMAILS=admin@pivot.test côté API pour le rangement + droits admin)'))

  console.log(`\n✅ Seed terminé. Mot de passe commun : ${PWD}`)
  console.log('   admin@pivot.test · manager@pivot.test · approver@pivot.test · viewer@pivot.test')
}

main().catch((err) => {
  console.error('❌ Seed échoué :', err.message)
  process.exit(1)
})
