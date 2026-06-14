// Generates an interactive PDF test notebook for Daily Standup.
// Run: node docs/cahiers-tests/generate-daily.mjs

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { writeFileSync } from 'fs'

const PW = 595.28, PH = 841.89, M = 36
const CW = PW - 2 * M

const C_NUM = M
const C_ACT = C_NUM + 24
const C_EXP = C_ACT + 120
const C_OK  = C_EXP + 148
const C_KO  = C_OK  + 26
const C_CMT = C_KO  + 26
const W_CMT = CW - (24 + 120 + 148 + 26 + 26)

const cl = {
  indigo:    rgb(0.31, 0.27, 0.90),
  indigoBg:  rgb(0.94, 0.93, 0.99),
  sectionBg: rgb(0.96, 0.95, 1.00),
  altRow:    rgb(0.986, 0.985, 0.997),
  border:    rgb(0.78, 0.78, 0.84),
  text:      rgb(0.10, 0.10, 0.15),
  gray:      rgb(0.45, 0.45, 0.52),
  white:     rgb(1, 1, 1),
  green:     rgb(0.20, 0.60, 0.20),
  red:       rgb(0.78, 0.16, 0.16),
}

const SECTIONS = [
  {
    title: '1. Chargement de la page',
    tests: [
      { num: '1.1', action: 'Naviguer vers /daily', expected: 'La page se charge. Titre "Daily Standup" visible. La liste des équipes s\'affiche.' },
      { num: '1.2', action: 'Accéder à /daily sans aucune équipe créée', expected: 'Message invitant à créer une équipe affiché. Bouton "Créer une équipe" visible.' },
    ],
  },
  {
    title: '2. Gestion des équipes',
    tests: [
      { num: '2.1', action: 'Cliquer sur "Créer une équipe" et saisir un nom', expected: 'Équipe créée et visible dans la liste. Aucune erreur.' },
      { num: '2.2', action: 'Créer une équipe avec un nom déjà utilisé', expected: 'Erreur affichée ou équipe créée avec un nom identique (comportement attendu selon design).' },
      { num: '2.3', action: 'Renommer une équipe existante', expected: 'Nouveau nom visible dans la liste sans rechargement de page.' },
      { num: '2.4', action: 'Supprimer une équipe', expected: 'Confirmation demandée (ou suppression directe). L\'équipe disparaît de la liste.' },
      { num: '2.5', action: 'Créer 5 équipes successivement', expected: 'Les 5 équipes s\'affichent dans la liste, dans l\'ordre de création.' },
    ],
  },
  {
    title: '3. Gestion des membres',
    tests: [
      { num: '3.1', action: 'Ouvrir une équipe et cliquer sur "Ajouter un membre"', expected: 'Champ de saisie du nom visible.' },
      { num: '3.2', action: 'Ajouter un membre avec prénom et nom', expected: 'Membre ajouté et visible dans la liste des membres de l\'équipe.' },
      { num: '3.3', action: 'Ajouter un membre avec un nom vide', expected: 'Erreur de validation. Aucun membre ajouté.' },
      { num: '3.4', action: 'Supprimer un membre de l\'équipe', expected: 'Membre retiré de la liste. Les sessions passées ne sont pas affectées.' },
      { num: '3.5', action: 'Réordonner les membres (drag & drop ou flèches)', expected: 'L\'ordre des membres est mis à jour et persisté après F5.' },
    ],
  },
  {
    title: '4. Lancement d\'une session daily',
    tests: [
      { num: '4.1', action: 'Cliquer sur "Démarrer le daily" pour une équipe avec membres', expected: 'La session démarre. Le premier membre s\'affiche. Le timer est visible.' },
      { num: '4.2', action: 'Tenter de démarrer un daily sur une équipe sans membres', expected: 'Bouton désactivé ou message d\'erreur. Aucune session créée.' },
      { num: '4.3', action: 'Observer l\'affichage au démarrage', expected: 'Nom du membre actuel, compteur de temps, boutons "Suivant" et "Passer" visibles.' },
    ],
  },
  {
    title: '5. Déroulement de la session',
    tests: [
      { num: '5.1', action: 'Cliquer sur "Suivant" après quelques secondes', expected: 'Le timer s\'arrête pour le membre actuel. Le temps est enregistré. Le membre suivant s\'affiche et son timer démarre.' },
      { num: '5.2', action: 'Cliquer sur "Passer" (skip) pour un membre', expected: 'Le membre est marqué comme passé. Le suivant s\'affiche.' },
      { num: '5.3', action: 'Laisser le timer dépasser la durée allouée', expected: 'Le timer passe en rouge ou affiche un dépassement. Le compteur continue.' },
      { num: '5.4', action: 'Parcourir tous les membres de l\'équipe', expected: 'Tous les membres sont affichés successivement. Aucun saut ou doublon.' },
      { num: '5.5', action: 'Rafraîchir la page (F5) en cours de session', expected: 'La session reprend sur le membre en cours ou depuis le début (selon design). Aucune perte de données.' },
    ],
  },
  {
    title: '6. Fin de session',
    tests: [
      { num: '6.1', action: 'Terminer le daily (après le dernier membre)', expected: 'Écran récapitulatif affiché : temps par membre, temps total.' },
      { num: '6.2', action: 'Cliquer sur "Terminer" manuellement avant la fin', expected: 'Session clôturée. Récapitulatif affiché.' },
      { num: '6.3', action: 'Vérifier l\'historique après une session terminée', expected: 'La session apparaît dans l\'historique de l\'équipe avec la date et les temps.' },
    ],
  },
  {
    title: '7. Équipe partagée & notification de fin',
    tests: [
      { num: '7.1', action: 'Vérifier qu\'une équipe créée dans Daily est visible dans Capacité / Scrum', expected: 'Les équipes sont un objet partagé (pivot Équipe) entre les modules.' },
      { num: '7.2', action: 'Terminer un daily manuellement', expected: 'Notification de fin incluant le nombre de participants et la durée de la session.' },
      { num: '7.3', action: 'Laisser le dernier participant quitter pour déclencher la fin automatique', expected: 'La fin automatique inclut aussi le nombre de participants et la durée.' },
      { num: '7.4', action: 'En tant que non-propriétaire, tenter de piloter la session', expected: 'Seul le propriétaire pilote la session (Suivant / Passer / Terminer).' },
    ],
  },
  {
    title: '8. Thème sombre',
    tests: [
      { num: '8.1', action: 'Basculer en thème sombre (Profil -> Thème) et recharger /daily', expected: 'Tous les éléments respectent le thème sombre. Aucun texte illisible.' },
    ],
  },
]

const TOTAL = SECTIONS.reduce((s, sec) => s + sec.tests.length, 0)

async function generate() {
  const doc  = await PDFDocument.create()
  const fR   = await doc.embedFont(StandardFonts.Helvetica)
  const fB   = await doc.embedFont(StandardFonts.HelveticaBold)
  const form = doc.getForm()

  const FS  = 8.0
  const LH  = FS * 1.3
  const PAD = 4

  function sanitize(s) {
    return String(s)
      .replace(/→/g, '->').replace(/←/g, '<-').replace(/↔/g, '<->')
      .replace(/[–—]/g, '-')
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/…/g, '...')
      .replace(/[•∙·]/g, '-')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
  }

  let page, currentY

  const fromBottom = (yTop)    => PH - yTop
  const rectBottom = (yTop, h) => PH - yTop - h

  function newPage() {
    page = doc.addPage([PW, PH])
    currentY = M
  }

  function ensureSpace(needed) {
    if (currentY + needed > PH - M) { newPage(); drawTableHeader() }
  }

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
    const words = sanitize(str).split(' ')
    const lines = []
    let line = ''
    for (const word of words) {
      const candidate = line ? line + ' ' + word : word
      if (font.widthOfTextAtSize(candidate, size) <= maxW) { line = candidate }
      else { if (line) lines.push(line); line = word }
    }
    if (line) lines.push(line)
    return lines
  }

  function drawCellText(str, x, cellTopY, colW, font = fR, size = FS) {
    const lines = wrapText(str, font, size, colW - 2 * PAD)
    lines.forEach((l, i) => drawText(l, x + PAD, cellTopY + PAD + size + i * LH, font, size))
  }

  function rowHeight(test) {
    const aLines = wrapText(test.action,   fR, FS, 120 - 2 * PAD).length
    const eLines = wrapText(test.expected, fR, FS, 148 - 2 * PAD).length
    return Math.max(28, Math.max(aLines, eLines) * LH + 2 * PAD + 2)
  }

  function drawTableHeader() {
    const H = 16
    drawRect(M, currentY, CW, H, cl.indigoBg, cl.border)
    ;[C_ACT, C_EXP, C_OK, C_KO, C_CMT].forEach(x => drawVLine(x, currentY, H))
    drawText('N°',               C_NUM + PAD, currentY + PAD + FS, fB, FS, cl.indigo)
    drawText('Action',           C_ACT + PAD, currentY + PAD + FS, fB, FS, cl.indigo)
    drawText('Résultat attendu', C_EXP + PAD, currentY + PAD + FS, fB, FS, cl.indigo)
    drawText('OK',               C_OK  + 6,   currentY + PAD + FS, fB, FS, cl.indigo)
    drawText('KO',               C_KO  + 6,   currentY + PAD + FS, fB, FS, cl.indigo)
    drawText('Commentaire',      C_CMT + PAD, currentY + PAD + FS, fB, FS, cl.indigo)
    currentY += H
  }

  function addCheckbox(name, x, centerY, borderColor) {
    const SIZE = 11
    const cb = form.createCheckBox(name)
    cb.addToPage(page, { x, y: rectBottom(centerY - SIZE / 2, SIZE), width: SIZE, height: SIZE, borderColor, borderWidth: 0.8, backgroundColor: cl.white })
    return cb
  }

  function addTextField(name, x, yTop, w, h, multiline = false) {
    const tf = form.createTextField(name)
    tf.addToPage(page, { x, y: rectBottom(yTop + h - PAD, h - 2 * PAD), width: w - 2 * PAD, height: h - 2 * PAD, borderColor: rgb(0.88, 0.88, 0.93), borderWidth: 0.4, backgroundColor: cl.white })
    tf.setFontSize(FS - 0.5)
    if (multiline) tf.enableMultiline()
    return tf
  }

  newPage()

  drawRect(M, currentY, CW, 42, cl.indigo, null)
  drawText('CAHIER DE TESTS — DAILY STANDUP', M + 12, currentY + 12 + 14, fB, 15, cl.white)
  drawText(`PouetPouet v0.10.0  ·  ${TOTAL} tests à exécuter`, M + 12, currentY + 30 + FS, fR, 8, rgb(0.82, 0.80, 1.0))
  currentY += 42 + 8

  const META_H = 21, META_COL = CW / 2
  const metaFields = [['Date du test', 'meta_date'], ['Testeur', 'meta_testeur'], ['Environnement', 'meta_env'], ['Navigateur', 'meta_nav']]
  drawRect(M, currentY, CW, META_H * 2 + 8, cl.sectionBg, cl.border)
  metaFields.forEach(([label, name], i) => {
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
      drawCellText(test.action,   C_ACT, currentY, 120)
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

  const BILAN_ROW_H = 22, BILAN_COL_W = CW / 3
  drawRect(M, currentY, CW, BILAN_ROW_H, cl.white, cl.border)
  ;[['Tests OK', 'bilan_ok'], ['Tests KO', 'bilan_ko'], ['Non exécutés', 'bilan_na']].forEach(([label, name], i) => {
    const xBase = M + i * BILAN_COL_W
    if (i > 0) drawVLine(xBase, currentY, BILAN_ROW_H)
    const lw = fR.widthOfTextAtSize(label + ' : ', FS)
    drawText(label + ' :', xBase + PAD, currentY + PAD + FS + 1, fR, FS, cl.gray)
    const tf = form.createTextField(name)
    tf.addToPage(page, { x: xBase + PAD + lw + 2, y: rectBottom(currentY + BILAN_ROW_H - 3, BILAN_ROW_H - 6), width: 40, height: BILAN_ROW_H - 6, borderColor: cl.border, borderWidth: 0.5, backgroundColor: cl.white })
    tf.setFontSize(FS)
    tf.setText(`/ ${TOTAL}`)
  })
  currentY += BILAN_ROW_H

  drawRect(M, currentY, CW, 13, cl.sectionBg, cl.border)
  drawText('Observations générales :', M + PAD, currentY + PAD + FS - 1, fB, FS - 0.5, cl.gray)
  currentY += 13
  const OBS_H = 60
  drawRect(M, currentY, CW, OBS_H, cl.white, cl.border)
  addTextField('observations', M, currentY, CW, OBS_H, true)
  currentY += OBS_H

  drawRect(M, currentY, CW, 22, cl.white, cl.border)
  const sigLw = fR.widthOfTextAtSize('Signature : ', FS)
  drawText('Signature :', M + PAD, currentY + PAD + FS + 2, fR, FS, cl.gray)
  const tfSig = form.createTextField('signature')
  tfSig.addToPage(page, { x: M + PAD + sigLw + 2, y: rectBottom(currentY + 22 - 3, 16), width: 190, height: 16, borderColor: cl.border, borderWidth: 0.5, backgroundColor: cl.white })
  tfSig.setFontSize(FS)

  const bytes = await doc.save()
  const outPath = 'docs/cahiers-tests/CT-v0.10.0-daily.pdf'
  writeFileSync(outPath, bytes)
  console.log(`✓  ${outPath}  (${TOTAL} tests · ${doc.getPageCount()} page${doc.getPageCount() > 1 ? 's' : ''})`)
}

generate().catch(console.error)
