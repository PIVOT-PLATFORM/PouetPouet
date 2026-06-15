// Generates an interactive PDF test notebook for the Capacité module.
// Run: node docs/cahiers-tests/generate-capacite.mjs

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
    title: '1. Chargement et navigation',
    tests: [
      { num: '1.1', action: 'Naviguer vers /capacity', expected: 'La page "Capacité" se charge. Listes "Événements" et "Équipes" visibles.' },
      { num: '1.2', action: 'Accéder sans aucun événement', expected: 'Message "Aucun événement" affiché. Bouton de création visible.' },
      { num: '1.3', action: 'Rechercher un événement via la barre de recherche', expected: 'Seuls les événements correspondants s\'affichent.' },
    ],
  },
  {
    title: '2. Gestion des équipes',
    tests: [
      { num: '2.1', action: 'Créer une équipe (nom, couleur, description)', expected: 'Équipe créée et visible dans la liste "Équipes".' },
      { num: '2.2', action: 'Ajouter des membres à l\'équipe (nom + rôle)', expected: 'Les membres apparaissent dans l\'équipe.' },
      { num: '2.3', action: 'Modifier une équipe (bouton "Modifier")', expected: 'Les changements (nom, couleur, membres) sont enregistrés.' },
      { num: '2.4', action: 'Vérifier qu\'une équipe est partagée avec Daily / Scrum', expected: 'La même équipe (pivot Équipe) est disponible dans les autres modules.' },
    ],
  },
  {
    title: '3. Création d\'un événement',
    tests: [
      { num: '3.1', action: 'Créer un événement (nom, type PI/Sprint/Release…)', expected: 'Événement créé et visible dans la liste.' },
      { num: '3.2', action: 'Renseigner début, jours travaillés et heures/jour', expected: 'Les paramètres sont enregistrés et utilisés dans le calcul.' },
      { num: '3.3', action: 'Associer une équipe à l\'événement', expected: 'Les membres de l\'équipe apparaissent dans la disponibilité.' },
      { num: '3.4', action: 'Rattacher l\'événement à un PI Planning (optionnel)', expected: 'Le rattachement est enregistré ; les événements rattachés sont listés.' },
    ],
  },
  {
    title: '4. Membres & disponibilité',
    tests: [
      { num: '4.1', action: 'Ajouter un membre via "Ajouter un membre…"', expected: 'Le membre apparaît dans le tableau de disponibilité.' },
      { num: '4.2', action: 'Définir un focus factor individuel', expected: 'Le focus individuel remplace le défaut de l\'événement pour ce membre.' },
      { num: '4.3', action: 'Ajouter une absence (durée + motif)', expected: 'L\'absence est déduite de la disponibilité du membre.' },
      { num: '4.4', action: 'Observer la colonne "Net j·h"', expected: 'Les jours-homme nets sont recalculés en direct selon focus et absences.' },
      { num: '4.5', action: 'Retirer un membre', expected: 'Le membre disparaît ; le calcul de capacité est mis à jour.' },
    ],
  },
  {
    title: '5. Calcul de capacité',
    tests: [
      { num: '5.1', action: 'Observer les totaux jours-homme / heures', expected: 'Les totaux se mettent à jour en direct à chaque changement.' },
      { num: '5.2', action: 'Renseigner "Points / jour·homme"', expected: 'La capacité en points est calculée et affichée.' },
      { num: '5.3', action: 'Modifier les heures/jour ou les jours travaillés', expected: 'Les totaux heures et points sont recalculés immédiatement.' },
    ],
  },
  {
    title: '6. Engagement & réalisation',
    tests: [
      { num: '6.1', action: 'Saisir les points engagés et réalisés', expected: 'Les indicateurs engagé vs réalisé s\'affichent.' },
      { num: '6.2', action: 'Saisir des notes (risques, hypothèses, dépendances)', expected: 'Les notes sont enregistrées.' },
      { num: '6.3', action: 'Consulter l\'historique de réalisation', expected: 'Les valeurs des sprints/PI passés sont listées.' },
    ],
  },
  {
    title: '7. Retour des PI / sprints précédents',
    tests: [
      { num: '7.1', action: 'Observer le panneau "Retour des PI / sprints précédents"', expected: 'La vélocité moyenne des événements précédents est affichée.' },
      { num: '7.2', action: 'Estimer une salle Scrum liée à l\'équipe', expected: 'À l\'estimation complète, le total de points remplit le sprint en planification.' },
    ],
  },
  {
    title: '8. Suppression & persistance',
    tests: [
      { num: '8.1', action: 'Supprimer un événement (confirmation)', expected: 'L\'événement est supprimé de la liste après confirmation.' },
      { num: '8.2', action: 'Rafraîchir la page (F5)', expected: 'Événements, équipes, membres et calculs sont conservés.' },
    ],
  },
  {
    title: '9. Thème sombre',
    tests: [
      { num: '9.1', action: 'Basculer en thème sombre (Profil -> Thème) et recharger /capacity', expected: 'Tous les éléments respectent le thème sombre. Aucun texte illisible.' },
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
  drawText('CAHIER DE TESTS — CAPACITÉ', M + 12, currentY + 12 + 14, fB, 14, cl.white)
  drawText(`PouetPouet v0.15.0  ·  ${TOTAL} tests à exécuter`, M + 12, currentY + 30 + FS, fR, 8, rgb(0.82, 0.80, 1.0))
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
  const outPath = 'apps/web/public/aide/CT-v0.15.0-capacite.pdf'
  writeFileSync(outPath, bytes)
  console.log(`✓  ${outPath}  (${TOTAL} tests · ${doc.getPageCount()} page${doc.getPageCount() > 1 ? 's' : ''})`)
}

generate().catch(console.error)
