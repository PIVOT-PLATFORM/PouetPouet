// Generates an interactive PDF test notebook for La Roue.
// Each test row has:  OK checkbox · KO checkbox · text field for comments
// Header fields (date, tester, environment, browser) are also fillable.
// Run: node docs/cahiers-tests/generate-roue.mjs

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { writeFileSync } from 'fs'

// ── Page geometry ─────────────────────────────────────────────────────────────
const PW = 595.28, PH = 841.89, M = 36
const CW = PW - 2 * M  // 523.28

// ── Column X positions ────────────────────────────────────────────────────────
const C_NUM = M             // width 24
const C_ACT = C_NUM + 24   // width 120
const C_EXP = C_ACT + 120  // width 148
const C_OK  = C_EXP + 148  // width 26
const C_KO  = C_OK  + 26   // width 26
const C_CMT = C_KO  + 26   // width = remaining
const W_CMT = CW - (24 + 120 + 148 + 26 + 26)  // 179.28

// ── Colors ────────────────────────────────────────────────────────────────────
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

// ── Test data ─────────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    title: '1. Chargement de la page',
    tests: [
      { num: '1.1', action: 'Naviguer vers /wheel', expected: 'La page se charge. Titre "La roue" et sous-titre visibles.' },
      { num: '1.2', action: 'Observer la sélection initiale (au moins 1 équipe disponible)', expected: 'La première équipe est auto-sélectionnée (fond indigo).' },
      { num: '1.3', action: 'Accéder à /wheel sans aucune équipe créée', expected: 'Message "Aucune équipe" avec lien vers Mes dailys affiché.' },
    ],
  },
  {
    title: '2. Sélection de l\'équipe',
    tests: [
      { num: '2.1', action: 'Cliquer sur une autre équipe dans la liste', expected: 'La sélection bascule (fond indigo). Grille des membres mise à jour.' },
      { num: '2.2', action: 'Changer d\'équipe alors que des membres sont exclus', expected: 'Exclusions réinitialisées. Compteur "disponibles" = total de la nouvelle équipe.' },
      { num: '2.3', action: 'Observer les boutons d\'équipe', expected: 'Format "Nom (N)" affiche le nombre de membres.' },
    ],
  },
  {
    title: '3. Configuration du tirage',
    tests: [
      { num: '3.1', action: 'Cliquer sur "1" dans "Nombre à tirer"', expected: 'Bouton en fond indigo. Bouton Tirer affiche "Tirer 1 personne".' },
      { num: '3.2', action: 'Cliquer sur "2", "3", "4", "5" successivement', expected: 'Bouton sélectionné en indigo, les autres en blanc. Le bouton Tirer se met à jour.' },
      { num: '3.3', action: 'Cliquer sur un chiffre supérieur au nombre de membres disponibles', expected: 'Bouton grisé et non cliquable.' },
      { num: '3.4', action: 'Sélectionner le mode "Equilibré"', expected: 'Toggle en violet. Description "Réduit la probabilité des personnes récemment tirées" visible.' },
      { num: '3.5', action: 'Sélectionner le mode "Aléatoire pur"', expected: 'Toggle en orange. Description correspondante visible. Bouton Tirer devient orange.' },
    ],
  },
  {
    title: '4. Exclusion de membres',
    tests: [
      { num: '4.1', action: 'Cliquer sur un membre dans la grille', expected: 'Membre grisé avec texte barré. Compteur "disponibles" décrémente de 1.' },
      { num: '4.2', action: 'Vérifier la section "Exclus du prochain tirage"', expected: 'Nom en pill grisé avec bouton X.' },
      { num: '4.3', action: 'Cliquer à nouveau sur le même membre', expected: 'Membre réinclus (redevient indigo). Compteur s\'incrémente.' },
      { num: '4.4', action: 'Cliquer sur X d\'un pill d\'exclusion', expected: 'Membre redevient disponible dans la grille.' },
      { num: '4.5', action: 'Cliquer sur "Réinitialiser"', expected: 'Tous disponibles. Section "Exclus" disparaît.' },
      { num: '4.6', action: 'Exclure tous les membres de l\'équipe', expected: 'Bouton Tirer affiche "Tous exclus · Réinitialisez !" et est désactivé.' },
    ],
  },
  {
    title: '5. Lancement du tirage',
    tests: [
      { num: '5.1', action: 'Cliquer sur le bouton "Tirer"', expected: 'Animation de slot démarre, noms défilent rapidement. Texte "Tirage en cours..." affiché.' },
      { num: '5.2', action: 'Tenter de cliquer "Tirer" pendant l\'animation', expected: 'Bouton désactivé. Impossible de relancer avant la fin.' },
      { num: '5.3', action: 'Attendre la fin de l\'animation (~1,5 s)', expected: 'Cartes figées avec animation pop. Résultats = nombre demandé. Aucun exclu présent.' },
      { num: '5.4', action: 'Lancer 5 tirages consécutifs en mode Equilibré', expected: 'Personnes récemment tirées apparaissent moins souvent (tendance observable sur 5 tirages).' },
      { num: '5.5', action: 'Lancer 5 tirages consécutifs en mode Aléatoire pur', expected: 'Mêmes personnes peuvent être tirées consécutivement (aucune pondération).' },
    ],
  },
  {
    title: '6. Panneau de résultats',
    tests: [
      { num: '6.1', action: 'Observer le panneau affiché après le tirage', expected: 'Panneau visible sous les cartes avec récapitulatif et options d\'action.' },
      { num: '6.2', action: 'Utiliser "Retirer et relancer" (ou équivalent)', expected: 'Personnes tirées ajoutées aux exclusions. Nouveau tirage démarre.' },
      { num: '6.3', action: 'Saisir une note dans le champ prévu', expected: 'Note sauvegardée et visible dans l\'historique pour ce tirage.' },
      { num: '6.4', action: 'Associer le tirage à un événement existant', expected: 'Tirage se déplace dans la section de l\'événement dans l\'historique.' },
      { num: '6.5', action: 'Créer un nouvel événement depuis le panneau résultats', expected: 'Événement créé, tirage associé, visible dans l\'historique à droite.' },
    ],
  },
  {
    title: '7. Historique des tirages',
    tests: [
      { num: '7.1', action: 'Observer la colonne droite après un tirage', expected: 'Tirage visible dans "Tirages isolés" : date, équipe, mode, résultats.' },
      { num: '7.2', action: 'Rafraîchir la page (F5)', expected: 'Historique toujours présent. Aucun tirage perdu.' },
      { num: '7.3', action: 'Supprimer un tirage depuis l\'historique', expected: 'Tirage supprimé de l\'historique. Aucune erreur.' },
      { num: '7.4', action: 'Effectuer 3 tirages sans les associer à un événement', expected: 'Tous visibles dans "Tirages isolés", du plus récent au plus ancien.' },
    ],
  },
  {
    title: '8. Gestion des événements',
    tests: [
      { num: '8.1', action: 'Utiliser le champ "Créer un événement" (bas de la colonne droite) et valider', expected: 'Événement créé dans l\'historique avec son nom et une liste vide.' },
      { num: '8.2', action: 'Renommer un événement existant', expected: 'Nom mis à jour dans l\'historique sans rechargement de page.' },
      { num: '8.3', action: 'Supprimer un événement', expected: 'Événement supprimé. Tirages associés passent en "Tirages isolés".' },
      { num: '8.4', action: 'Associer un tirage à un événement depuis le panneau résultats', expected: 'Tirage visible sous l\'événement (et non dans les tirages isolés).' },
      { num: '8.5', action: 'Rafraîchir la page après création d\'un événement', expected: 'Événement et ses tirages toujours présents.' },
    ],
  },
  {
    title: '9. Notifications & webhooks de tirage',
    tests: [
      { num: '9.1', action: 'Effectuer un tirage et consulter la cloche de notifications', expected: 'Une notification de tirage (avec le résultat) est créée.' },
      { num: '9.2', action: 'Configurer un webhook abonné au tirage Roue puis lancer un tirage', expected: 'Un événement webhook "tirage roue" est émis avec le résultat.' },
    ],
  },
  {
    title: '10. Thème sombre',
    tests: [
      { num: '10.1', action: 'Activer le thème sombre (Profil → Thème) et recharger /wheel', expected: 'Tous les éléments respectent le thème sombre. Aucun texte illisible.' },
    ],
  },
]

const TOTAL = SECTIONS.reduce((s, sec) => s + sec.tests.length, 0)

// ── PDF generation ────────────────────────────────────────────────────────────
async function generate() {
  const doc  = await PDFDocument.create()
  const fR   = await doc.embedFont(StandardFonts.Helvetica)
  const fB   = await doc.embedFont(StandardFonts.HelveticaBold)
  const form = doc.getForm()

  const FS  = 8.0       // base font size
  const LH  = FS * 1.3  // line height
  const PAD = 4         // cell padding

  // Helvetica uses WinAnsi encoding (0x00-0xFF). Strip anything outside that range.
  function sanitize(s) {
    return String(s)
      .replace(/→/g, '->').replace(/←/g, '<-').replace(/↔/g, '<->') // arrows
      .replace(/[–—]/g, '-')          // en/em dash
      .replace(/[‘’]/g, "'")          // curly apostrophes
      .replace(/[“”]/g, '"')          // curly quotes
      .replace(/…/g, '...')                // ellipsis
      .replace(/[•∙·]/g, '-')   // bullets / middle dot
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')   // anything else outside WinAnsi
  }

  let page, currentY

  // ── Coordinate helpers (we track y from page TOP, pdf-lib uses y from BOTTOM)
  const fromBottom = (yTop)     => PH - yTop          // point on page
  const rectBottom = (yTop, h)  => PH - yTop - h      // bottom-left of rect

  function newPage() {
    page = doc.addPage([PW, PH])
    currentY = M
  }

  function ensureSpace(needed) {
    if (currentY + needed > PH - M) {
      newPage()
      drawTableHeader()
    }
  }

  // ── Draw primitives ──────────────────────────────────────────────────────────

  function drawRect(x, yTop, w, h, fill, stroke) {
    const opts = { x, y: rectBottom(yTop, h), width: w, height: h }
    if (fill)   page.drawRectangle({ ...opts, color: fill })
    if (stroke) page.drawRectangle({ ...opts, borderColor: stroke, borderWidth: 0.5 })
  }

  function drawVLine(x, yTop, h) {
    page.drawLine({
      start: { x, y: fromBottom(yTop) },
      end:   { x, y: fromBottom(yTop + h) },
      thickness: 0.4, color: cl.border,
    })
  }

  // yBaseline = distance from TOP to text baseline
  function drawText(str, x, yBaseline, font, size, color = cl.text) {
    page.drawText(sanitize(str), { x, y: fromBottom(yBaseline), font, size, color })
  }

  function wrapText(str, font, size, maxW) {
    const words = sanitize(str).split(' ')
    const lines = []
    let line = ''
    for (const word of words) {
      const candidate = line ? line + ' ' + word : word
      if (font.widthOfTextAtSize(candidate, size) <= maxW) {
        line = candidate
      } else {
        if (line) lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
    return lines
  }

  function drawCellText(str, x, cellTopY, colW, font = fR, size = FS) {
    const lines = wrapText(str, font, size, colW - 2 * PAD)
    lines.forEach((l, i) =>
      drawText(l, x + PAD, cellTopY + PAD + size + i * LH, font, size)
    )
  }

  function rowHeight(test) {
    const aLines = wrapText(test.action,   fR, FS, 120 - 2 * PAD).length
    const eLines = wrapText(test.expected, fR, FS, 148 - 2 * PAD).length
    return Math.max(28, Math.max(aLines, eLines) * LH + 2 * PAD + 2)
  }

  // ── Reusable table header ────────────────────────────────────────────────────

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

  // ── Reusable form field helpers ──────────────────────────────────────────────

  function addCheckbox(name, x, centerY, borderColor) {
    const SIZE = 11
    const cb = form.createCheckBox(name)
    cb.addToPage(page, {
      x,
      y: rectBottom(centerY - SIZE / 2, SIZE),
      width: SIZE, height: SIZE,
      borderColor,
      borderWidth: 0.8,
      backgroundColor: cl.white,
    })
    return cb
  }

  function addTextField(name, x, yTop, w, h, multiline = false) {
    const tf = form.createTextField(name)
    tf.addToPage(page, {
      x,
      y: rectBottom(yTop + h - PAD, h - 2 * PAD),
      width: w - 2 * PAD,
      height: h - 2 * PAD,
      borderColor: rgb(0.88, 0.88, 0.93),
      borderWidth: 0.4,
      backgroundColor: cl.white,
    })
    tf.setFontSize(FS - 0.5)
    if (multiline) tf.enableMultiline()
    return tf
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — TITLE + METADATA + LEGEND + TABLE START
  // ══════════════════════════════════════════════════════════════════════════════

  newPage()

  // ── Title banner ─────────────────────────────────────────────────────────────
  drawRect(M, currentY, CW, 42, cl.indigo, null)
  drawText('CAHIER DE TESTS — LA ROUE', M + 12, currentY + 12 + 14, fB, 15, cl.white)
  drawText(
    `PouetPouet v0.15.0  ·  ${TOTAL} tests à exécuter`,
    M + 12, currentY + 30 + FS, fR, 8, rgb(0.82, 0.80, 1.0)
  )
  currentY += 42 + 8

  // ── Metadata form fields (2 columns × 2 rows) ─────────────────────────────
  const META_H   = 21
  const META_COL = CW / 2
  const metaFields = [
    ['Date du test',  'meta_date'],
    ['Testeur',       'meta_testeur'],
    ['Environnement', 'meta_env'],
    ['Navigateur',    'meta_nav'],
  ]
  drawRect(M, currentY, CW, META_H * 2 + 8, cl.sectionBg, cl.border)

  metaFields.forEach(([label, name], i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const xBase  = M + 6 + col * META_COL
    const yBlock = currentY + 4 + row * META_H
    const labelW = fR.widthOfTextAtSize(label + ' : ', FS)

    drawText(label + ' :', xBase, yBlock + PAD + FS, fR, FS, cl.gray)
    const tf = form.createTextField(name)
    tf.addToPage(page, {
      x: xBase + labelW + 2,
      y: rectBottom(yBlock + META_H - 3, META_H - 6),
      width:  META_COL - labelW - 20,
      height: META_H - 6,
      borderColor:     cl.border,
      borderWidth:     0.5,
      backgroundColor: cl.white,
    })
    tf.setFontSize(FS)
  })
  currentY += META_H * 2 + 8 + 6

  // ── Legend ────────────────────────────────────────────────────────────────
  drawRect(M, currentY, CW, 14, rgb(0.97, 0.97, 0.99), cl.border)
  drawText(
    '[ ] OK = Comportement conforme au resultat attendu          [ ] KO = Comportement non conforme -> remplir la colonne Commentaire',
    M + PAD, currentY + PAD + 7, fR, 7, cl.gray
  )
  currentY += 14 + 6

  // ── Table header ──────────────────────────────────────────────────────────
  drawTableHeader()

  // ══════════════════════════════════════════════════════════════════════════════
  // TEST SECTIONS
  // ══════════════════════════════════════════════════════════════════════════════

  let fieldId = 0

  for (const section of SECTIONS) {
    // Section title row
    ensureSpace(14 + 28)
    drawRect(M, currentY, CW, 14, cl.sectionBg, cl.border)
    ;[C_ACT, C_EXP, C_OK, C_KO, C_CMT].forEach(x => drawVLine(x, currentY, 14))
    drawText(section.title, M + PAD, currentY + PAD + FS, fB, FS - 0.5, cl.indigo)
    currentY += 14

    section.tests.forEach((test, ti) => {
      const rh = rowHeight(test)
      ensureSpace(rh)

      // Row background + border
      drawRect(M, currentY, CW, rh, ti % 2 === 0 ? cl.white : cl.altRow, cl.border)
      ;[C_ACT, C_EXP, C_OK, C_KO, C_CMT].forEach(x => drawVLine(x, currentY, rh))

      // Static text cells
      drawText(test.num, C_NUM + PAD, currentY + PAD + FS, fB, FS - 0.5, cl.gray)
      drawCellText(test.action,   C_ACT, currentY, 120)
      drawCellText(test.expected, C_EXP, currentY, 148)

      // Interactive: OK checkbox (green border)
      ++fieldId
      addCheckbox(`ok_${fieldId}`, C_OK + (26 - 11) / 2, currentY + rh / 2, cl.green)

      // Interactive: KO checkbox (red border)
      addCheckbox(`ko_${fieldId}`, C_KO + (26 - 11) / 2, currentY + rh / 2, cl.red)

      // Interactive: comment text field
      addTextField(`cmt_${fieldId}`, C_CMT, currentY, W_CMT, rh, rh > 32)

      currentY += rh
    })
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // BILAN
  // ══════════════════════════════════════════════════════════════════════════════

  ensureSpace(130)
  currentY += 10

  // Header
  drawRect(M, currentY, CW, 15, cl.indigoBg, cl.border)
  drawText('BILAN', M + PAD, currentY + PAD + FS, fB, FS, cl.indigo)
  currentY += 15

  // Count fields (3 columns)
  const BILAN_ROW_H = 22
  const BILAN_COL_W = CW / 3
  drawRect(M, currentY, CW, BILAN_ROW_H, cl.white, cl.border)

  ;[
    ['Tests OK',      'bilan_ok'],
    ['Tests KO',      'bilan_ko'],
    ['Non exécutés',  'bilan_na'],
  ].forEach(([label, name], i) => {
    const xBase = M + i * BILAN_COL_W
    if (i > 0) drawVLine(xBase, currentY, BILAN_ROW_H)
    const lw = fR.widthOfTextAtSize(label + ' : ', FS)
    drawText(label + ' :', xBase + PAD, currentY + PAD + FS + 1, fR, FS, cl.gray)
    const tf = form.createTextField(name)
    tf.addToPage(page, {
      x: xBase + PAD + lw + 2,
      y: rectBottom(currentY + BILAN_ROW_H - 3, BILAN_ROW_H - 6),
      width: 40, height: BILAN_ROW_H - 6,
      borderColor: cl.border, borderWidth: 0.5,
      backgroundColor: cl.white,
    })
    tf.setFontSize(FS)
    tf.setText(`/ ${TOTAL}`)
  })
  currentY += BILAN_ROW_H

  // Observations (multiline)
  drawRect(M, currentY, CW, 13, cl.sectionBg, cl.border)
  drawText('Observations générales :', M + PAD, currentY + PAD + FS - 1, fB, FS - 0.5, cl.gray)
  currentY += 13
  const OBS_H = 60
  drawRect(M, currentY, CW, OBS_H, cl.white, cl.border)
  addTextField('observations', M, currentY, CW, OBS_H, true)
  currentY += OBS_H

  // Signature
  drawRect(M, currentY, CW, 22, cl.white, cl.border)
  const sigLw = fR.widthOfTextAtSize('Signature : ', FS)
  drawText('Signature :', M + PAD, currentY + PAD + FS + 2, fR, FS, cl.gray)
  const tfSig = form.createTextField('signature')
  tfSig.addToPage(page, {
    x: M + PAD + sigLw + 2,
    y: rectBottom(currentY + 22 - 3, 16),
    width: 190, height: 16,
    borderColor: cl.border, borderWidth: 0.5,
    backgroundColor: cl.white,
  })
  tfSig.setFontSize(FS)

  // ── Save ──────────────────────────────────────────────────────────────────
  const bytes = await doc.save()
  const outPath = 'apps/web/public/aide/CT-v0.15.0-roue.pdf'
  writeFileSync(outPath, bytes)
  console.log(`✓  ${outPath}  (${TOTAL} tests · ${doc.getPageCount()} page${doc.getPageCount() > 1 ? 's' : ''})`)
}

generate().catch(console.error)
