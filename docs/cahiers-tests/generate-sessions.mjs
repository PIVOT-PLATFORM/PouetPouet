// Generates an interactive PDF test notebook for Sessions live.
// Run: node docs/cahiers-tests/generate-sessions.mjs

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { writeFileSync } from 'fs'

const PW = 595.28, PH = 841.89, M = 36
const CW = PW - 2 * M
const C_NUM = M, C_ACT = C_NUM + 24, C_EXP = C_ACT + 120
const C_OK = C_EXP + 148, C_KO = C_OK + 26, C_CMT = C_KO + 26
const W_CMT = CW - (24 + 120 + 148 + 26 + 26)

const cl = {
  indigo: rgb(0.31, 0.27, 0.90), indigoBg: rgb(0.94, 0.93, 0.99),
  sectionBg: rgb(0.96, 0.95, 1.00), altRow: rgb(0.986, 0.985, 0.997),
  border: rgb(0.78, 0.78, 0.84), text: rgb(0.10, 0.10, 0.15),
  gray: rgb(0.45, 0.45, 0.52), white: rgb(1, 1, 1),
  green: rgb(0.20, 0.60, 0.20), red: rgb(0.78, 0.16, 0.16),
}

const SECTIONS = [
  {
    title: '1. Création et démarrage de session (hôte)',
    tests: [
      { num: '1.1', action: 'Depuis un board, cliquer sur "Créer une session"', expected: 'Session créée. Code à 6 caractères affiché. Lien de partage disponible.' },
      { num: '1.2', action: 'Observer le badge de session dans la barre de navigation du board', expected: 'Badge de session actif visible. Nombre de participants affiché.' },
      { num: '1.3', action: 'Rafraîchir la page du board en cours de session (F5)', expected: 'Reconnexion automatique à la session. Aucune action requise.' },
    ],
  },
  {
    title: '2. Rejoindre une session (participant)',
    tests: [
      { num: '2.1', action: 'Naviguer vers /join avec le code de session et un nom d\'invité', expected: 'Participant rejoint la session. Page /session/[code] chargée.' },
      { num: '2.2', action: 'Ouvrir le lien de session partagé directement', expected: 'Page de join affichée. Saisir un nom pour rejoindre.' },
      { num: '2.3', action: 'Rejoindre depuis un compte authentifié (membre du board)', expected: 'Participant rejoint directement sans saisie de nom. Badge session visible sur le board.' },
      { num: '2.4', action: 'Tenter de rejoindre avec un code invalide', expected: 'Erreur "Session introuvable" ou "Code invalide" affiché.' },
      { num: '2.5', action: 'Rafraîchir la page participant (F5)', expected: 'Reconnexion automatique à la session. Aucune donnée perdue.' },
    ],
  },
  {
    title: '3. Gestion des participants (hôte)',
    tests: [
      { num: '3.1', action: 'Observer la liste des participants dans le panneau hôte', expected: 'Tous les participants connectés sont listés avec leur nom.' },
      { num: '3.2', action: 'Observer les badges de participants sur le board', expected: 'Badges visibles sur le board pour chaque participant connecté.' },
    ],
  },
  {
    title: '4. Activités — Quiz',
    tests: [
      { num: '4.1', action: 'Lancer une activité Quiz depuis le panneau hôte', expected: 'Question et choix affichés côté participant. Chrono si configuré.' },
      { num: '4.2', action: 'Un participant répond au quiz', expected: 'Réponse enregistrée. Statut "répondu" visible côté hôte.' },
      { num: '4.3', action: 'Clôturer le quiz', expected: 'Résultats affichés côté hôte et participants. Bonne réponse mise en évidence.' },
    ],
  },
  {
    title: '5. Activités — Sondage (Poll)',
    tests: [
      { num: '5.1', action: 'Lancer un sondage depuis le panneau hôte', expected: 'Question et options affichées côté participant.' },
      { num: '5.2', action: 'Un participant vote', expected: 'Vote enregistré. Résultats en temps réel ou à la clôture selon configuration.' },
      { num: '5.3', action: 'Clôturer le sondage', expected: 'Résultats finaux affichés. Pourcentages ou nombre de voix visibles.' },
    ],
  },
  {
    title: '6. Activités — Nuage de mots (WordCloud)',
    tests: [
      { num: '6.1', action: 'Lancer un WordCloud', expected: 'Champ de saisie libre affiché côté participant.' },
      { num: '6.2', action: 'Plusieurs participants soumettent des mots', expected: 'Mots apparaissent en temps réel dans le nuage côté hôte.' },
      { num: '6.3', action: 'Clôturer le WordCloud', expected: 'Nuage de mots final figé et visible par tous.' },
    ],
  },
  {
    title: '7. Activités — Brainstorming',
    tests: [
      { num: '7.1', action: 'Lancer une activité Brainstorming', expected: 'Les participants peuvent soumettre des idées sous forme de cartes.' },
      { num: '7.2', action: 'Un participant soumet une idée', expected: 'La carte apparaît sur le board en temps réel.' },
      { num: '7.3', action: 'Clôturer le Brainstorming', expected: 'Les cartes soumises restent sur le board.' },
    ],
  },
  {
    title: '8. Activités — Questions & Réponses (Q&A)',
    tests: [
      { num: '8.1', action: 'Lancer une activité Q&A', expected: 'Les participants peuvent poser des questions.' },
      { num: '8.2', action: 'Un participant pose une question', expected: 'Question visible côté hôte. L\'hôte peut y répondre.' },
      { num: '8.3', action: 'Clôturer la Q&A', expected: 'Questions et réponses sauvegardées. Visibles après clôture.' },
    ],
  },
  {
    title: '9. Clôture de session',
    tests: [
      { num: '9.1', action: 'L\'hôte clôture la session depuis le panneau', expected: 'Session fermée. Les participants voient un message de fin. Redirection ou message d\'au revoir.' },
      { num: '9.2', action: 'Observer l\'état du board après clôture', expected: 'Le badge session disparaît du board. Le board reste accessible normalement.' },
      { num: '9.3', action: 'Tenter de rejoindre une session clôturée', expected: 'Message "Session terminée" ou "Introuvable" affiché.' },
    ],
  },
  {
    title: '10. Résilience',
    tests: [
      { num: '10.1', action: 'Couper la connexion réseau côté hôte puis la rétablir', expected: 'Reconnexion automatique. Session toujours active. Participants encore connectés.' },
      { num: '10.2', action: 'Couper la connexion réseau côté participant puis la rétablir', expected: 'Reconnexion automatique. Participant toujours dans la session.' },
      { num: '10.3', action: 'Lancer une activité pendant qu\'un participant est déconnecté', expected: 'Le participant voit l\'activité à la reconnexion.' },
    ],
  },
  {
    title: '11. Rôles & permissions de session',
    tests: [
      { num: '11.1', action: 'En tant qu\'Éditeur du board, démarrer puis animer une session', expected: 'Action autorisée : un éditeur peut démarrer, animer et fermer une session.' },
      { num: '11.2', action: 'En tant que Lecteur, tenter de lancer une activité', expected: 'Action refusée ; les contrôles d\'animation ne sont pas accessibles.' },
      { num: '11.3', action: 'Vérifier les actions hôte (création, fermeture, lancement d\'activité)', expected: 'Chaque action hôte est contrôlée côté HTTP et socket (propriété / rôle requis).' },
    ],
  },
  {
    title: '12. Résultats persistants & timer',
    tests: [
      { num: '12.1', action: 'Clôturer un sondage / quiz / brainstorm', expected: 'Le rapport de résultats reste affiché pour l\'animateur ET les participants.' },
      { num: '12.2', action: 'Fermer l\'écran de fin de timer côté hôte', expected: 'Le timer des autres participants n\'est pas coupé.' },
      { num: '12.3', action: 'Clôturer un vote de board pendant la session', expected: 'Les résultats s\'affichent chez tous les participants ; les formes ne sont pas votables.' },
    ],
  },
]

const TOTAL = SECTIONS.reduce((s, sec) => s + sec.tests.length, 0)

async function generate() {
  const doc = await PDFDocument.create()
  const fR  = await doc.embedFont(StandardFonts.Helvetica)
  const fB  = await doc.embedFont(StandardFonts.HelveticaBold)
  const form = doc.getForm()
  const FS = 8.0, LH = FS * 1.3, PAD = 4

  function sanitize(s) {
    return String(s)
      .replace(/→/g, '->').replace(/←/g, '<-').replace(/↔/g, '<->')
      .replace(/[–—]/g, '-').replace(/['']/g, "'").replace(/[""]/g, '"')
      .replace(/…/g, '...').replace(/[•∙·]/g, '-')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
  }

  let page, currentY
  const fromBottom = (yTop) => PH - yTop
  const rectBottom = (yTop, h) => PH - yTop - h

  function newPage() { page = doc.addPage([PW, PH]); currentY = M }
  function ensureSpace(needed) { if (currentY + needed > PH - M) { newPage(); drawTableHeader() } }

  function drawRect(x, yTop, w, h, fill, stroke) {
    const opts = { x, y: rectBottom(yTop, h), width: w, height: h }
    if (fill)   page.drawRectangle({ ...opts, color: fill })
    if (stroke) page.drawRectangle({ ...opts, borderColor: stroke, borderWidth: 0.5 })
  }
  function drawVLine(x, yTop, h) {
    page.drawLine({ start: { x, y: fromBottom(yTop) }, end: { x, y: fromBottom(yTop + h) }, thickness: 0.4, color: cl.border })
  }
  function drawText(str, x, yBaseline, font, size, color = cl.text) {
    page.drawText(sanitize(str), { x, y: fromBottom(yBaseline), font, size, color })
  }
  function wrapText(str, font, size, maxW) {
    const words = sanitize(str).split(' '), lines = []
    let line = ''
    for (const word of words) {
      const c = line ? line + ' ' + word : word
      if (font.widthOfTextAtSize(c, size) <= maxW) line = c
      else { if (line) lines.push(line); line = word }
    }
    if (line) lines.push(line)
    return lines
  }
  function drawCellText(str, x, cellTopY, colW, font = fR, size = FS) {
    wrapText(str, font, size, colW - 2 * PAD).forEach((l, i) => drawText(l, x + PAD, cellTopY + PAD + size + i * LH, font, size))
  }
  function rowHeight(test) {
    return Math.max(28, Math.max(wrapText(test.action, fR, FS, 120 - 2 * PAD).length, wrapText(test.expected, fR, FS, 148 - 2 * PAD).length) * LH + 2 * PAD + 2)
  }
  function drawTableHeader() {
    const H = 16
    drawRect(M, currentY, CW, H, cl.indigoBg, cl.border)
    ;[C_ACT, C_EXP, C_OK, C_KO, C_CMT].forEach(x => drawVLine(x, currentY, H))
    drawText('N°', C_NUM + PAD, currentY + PAD + FS, fB, FS, cl.indigo)
    drawText('Action', C_ACT + PAD, currentY + PAD + FS, fB, FS, cl.indigo)
    drawText('Résultat attendu', C_EXP + PAD, currentY + PAD + FS, fB, FS, cl.indigo)
    drawText('OK', C_OK + 6, currentY + PAD + FS, fB, FS, cl.indigo)
    drawText('KO', C_KO + 6, currentY + PAD + FS, fB, FS, cl.indigo)
    drawText('Commentaire', C_CMT + PAD, currentY + PAD + FS, fB, FS, cl.indigo)
    currentY += H
  }
  function addCheckbox(name, x, centerY, borderColor) {
    const SIZE = 11, cb = form.createCheckBox(name)
    cb.addToPage(page, { x, y: rectBottom(centerY - SIZE / 2, SIZE), width: SIZE, height: SIZE, borderColor, borderWidth: 0.8, backgroundColor: cl.white })
  }
  function addTextField(name, x, yTop, w, h, multiline = false) {
    const tf = form.createTextField(name)
    tf.addToPage(page, { x, y: rectBottom(yTop + h - PAD, h - 2 * PAD), width: w - 2 * PAD, height: h - 2 * PAD, borderColor: rgb(0.88, 0.88, 0.93), borderWidth: 0.4, backgroundColor: cl.white })
    tf.setFontSize(FS - 0.5)
    if (multiline) tf.enableMultiline()
  }

  newPage()
  drawRect(M, currentY, CW, 42, cl.indigo, null)
  drawText('CAHIER DE TESTS — SESSIONS LIVE', M + 12, currentY + 12 + 14, fB, 15, cl.white)
  drawText(`PouetPouet v0.10.0  ·  ${TOTAL} tests à exécuter`, M + 12, currentY + 30 + FS, fR, 8, rgb(0.82, 0.80, 1.0))
  currentY += 42 + 8

  const META_H = 21, META_COL = CW / 2
  drawRect(M, currentY, CW, META_H * 2 + 8, cl.sectionBg, cl.border)
  ;[['Date du test', 'meta_date'], ['Testeur', 'meta_testeur'], ['Environnement', 'meta_env'], ['Navigateur', 'meta_nav']].forEach(([label, name], i) => {
    const col = i % 2, row = Math.floor(i / 2)
    const xBase = M + 6 + col * META_COL, yBlock = currentY + 4 + row * META_H
    const labelW = fR.widthOfTextAtSize(label + ' : ', FS)
    drawText(label + ' :', xBase, yBlock + PAD + FS, fR, FS, cl.gray)
    const tf = form.createTextField(name)
    tf.addToPage(page, { x: xBase + labelW + 2, y: rectBottom(yBlock + META_H - 3, META_H - 6), width: META_COL - labelW - 20, height: META_H - 6, borderColor: cl.border, borderWidth: 0.5, backgroundColor: cl.white })
    tf.setFontSize(FS)
  })
  currentY += META_H * 2 + 8 + 6

  drawRect(M, currentY, CW, 14, rgb(0.97, 0.97, 0.99), cl.border)
  drawText('[ ] OK = Comportement conforme au resultat attendu          [ ] KO = Comportement non conforme -> remplir la colonne Commentaire', M + PAD, currentY + PAD + 7, fR, 7, cl.gray)
  currentY += 14 + 6
  drawTableHeader()

  let fieldId = 0
  for (const section of SECTIONS) {
    ensureSpace(14 + 28)
    drawRect(M, currentY, CW, 14, cl.sectionBg, cl.border)
    ;[C_ACT, C_EXP, C_OK, C_KO, C_CMT].forEach(x => drawVLine(x, currentY, 14))
    drawText(section.title, M + PAD, currentY + PAD + FS, fB, FS - 0.5, cl.indigo)
    currentY += 14
    section.tests.forEach((test, ti) => {
      const rh = rowHeight(test)
      ensureSpace(rh)
      drawRect(M, currentY, CW, rh, ti % 2 === 0 ? cl.white : cl.altRow, cl.border)
      ;[C_ACT, C_EXP, C_OK, C_KO, C_CMT].forEach(x => drawVLine(x, currentY, rh))
      drawText(test.num, C_NUM + PAD, currentY + PAD + FS, fB, FS - 0.5, cl.gray)
      drawCellText(test.action, C_ACT, currentY, 120)
      drawCellText(test.expected, C_EXP, currentY, 148)
      ++fieldId
      addCheckbox(`ok_${fieldId}`, C_OK + (26 - 11) / 2, currentY + rh / 2, cl.green)
      addCheckbox(`ko_${fieldId}`, C_KO + (26 - 11) / 2, currentY + rh / 2, cl.red)
      addTextField(`cmt_${fieldId}`, C_CMT, currentY, W_CMT, rh, rh > 32)
      currentY += rh
    })
  }

  ensureSpace(130)
  currentY += 10
  drawRect(M, currentY, CW, 15, cl.indigoBg, cl.border)
  drawText('BILAN', M + PAD, currentY + PAD + FS, fB, FS, cl.indigo)
  currentY += 15

  const BRH = 22, BCW = CW / 3
  drawRect(M, currentY, CW, BRH, cl.white, cl.border)
  ;[['Tests OK', 'bilan_ok'], ['Tests KO', 'bilan_ko'], ['Non exécutés', 'bilan_na']].forEach(([label, name], i) => {
    const xBase = M + i * BCW
    if (i > 0) drawVLine(xBase, currentY, BRH)
    const lw = fR.widthOfTextAtSize(label + ' : ', FS)
    drawText(label + ' :', xBase + PAD, currentY + PAD + FS + 1, fR, FS, cl.gray)
    const tf = form.createTextField(name)
    tf.addToPage(page, { x: xBase + PAD + lw + 2, y: rectBottom(currentY + BRH - 3, BRH - 6), width: 40, height: BRH - 6, borderColor: cl.border, borderWidth: 0.5, backgroundColor: cl.white })
    tf.setFontSize(FS)
    tf.setText(`/ ${TOTAL}`)
  })
  currentY += BRH

  drawRect(M, currentY, CW, 13, cl.sectionBg, cl.border)
  drawText('Observations générales :', M + PAD, currentY + PAD + FS - 1, fB, FS - 0.5, cl.gray)
  currentY += 13
  drawRect(M, currentY, CW, 60, cl.white, cl.border)
  addTextField('observations', M, currentY, CW, 60, true)
  currentY += 60

  drawRect(M, currentY, CW, 22, cl.white, cl.border)
  const sigLw = fR.widthOfTextAtSize('Signature : ', FS)
  drawText('Signature :', M + PAD, currentY + PAD + FS + 2, fR, FS, cl.gray)
  const tfSig = form.createTextField('signature')
  tfSig.addToPage(page, { x: M + PAD + sigLw + 2, y: rectBottom(currentY + 22 - 3, 16), width: 190, height: 16, borderColor: cl.border, borderWidth: 0.5, backgroundColor: cl.white })
  tfSig.setFontSize(FS)

  const bytes = await doc.save()
  const outPath = 'docs/cahiers-tests/CT-v0.10.0-sessions.pdf'
  writeFileSync(outPath, bytes)
  console.log(`✓  ${outPath}  (${TOTAL} tests · ${doc.getPageCount()} page${doc.getPageCount() > 1 ? 's' : ''})`)
}

generate().catch(console.error)
