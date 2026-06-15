// Generates an interactive PDF test notebook for the MeetOps module.
// Run: node docs/cahiers-tests/generate-meetops.mjs

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
      { num: '1.1', action: 'Naviguer vers /meetops', expected: 'La page MeetOps se charge. Liste des événements visible (ou message si vide).' },
      { num: '1.2', action: 'Accéder sans aucun événement', expected: 'Message invitant à créer un événement. Bouton de création visible.' },
    ],
  },
  {
    title: '2. Gestion des événements',
    tests: [
      { num: '2.1', action: 'Créer un événement (nom, type, responsable, couleur)', expected: 'Événement créé en statut Brouillon (DRAFT) et visible dans la liste.' },
      { num: '2.2', action: 'Choisir un type prédéfini (VERSION, SPRINT, COPIL, RELEASE…)', expected: 'Le type est enregistré et affiché sur l\'événement.' },
      { num: '2.3', action: 'Faire évoluer le statut (DRAFT -> ACTIVE -> CLOSED)', expected: 'Le statut change et est reflété dans la liste.' },
      { num: '2.4', action: 'Dupliquer un événement', expected: 'Une copie de l\'événement (réunions incluses) est créée.' },
      { num: '2.5', action: 'Archiver puis supprimer un événement', expected: 'L\'événement passe en archivé, puis est supprimé après confirmation.' },
    ],
  },
  {
    title: '3. Tableau de réunions (liste à plat)',
    tests: [
      { num: '3.1', action: 'Cliquer sur "+ Ajouter une réunion"', expected: 'Une ligne brouillon est créée (date par défaut = aujourd\'hui).' },
      { num: '3.2', action: 'Éditer une cellule (titre, date, heure, durée) puis valider', expected: 'La valeur est sauvegardée automatiquement au blur / Entrée.' },
      { num: '3.3', action: 'Laisser une ligne brouillon entièrement vide', expected: 'La ligne est abandonnée (non enregistrée).' },
      { num: '3.4', action: 'Recharger la page (F5)', expected: 'Les réunions saisies sont conservées avec leurs valeurs.' },
    ],
  },
  {
    title: '4. Étiquettes & ordre manuel',
    tests: [
      { num: '4.1', action: 'Saisir une étiquette dans une réunion', expected: 'Autocomplétion des étiquettes déjà utilisées ; couleur déterministe appliquée.' },
      { num: '4.2', action: 'Glisser-déposer une ligne via la poignée', expected: 'L\'ordre est mis à jour et persisté (Meeting.order).' },
      { num: '4.3', action: 'Réutiliser une étiquette existante sur une autre réunion', expected: 'Même couleur que les autres réunions de cette étiquette.' },
    ],
  },
  {
    title: '5. Modification de masse',
    tests: [
      { num: '5.1', action: 'Sélectionner plusieurs lignes', expected: 'Une barre d\'actions de masse apparaît.' },
      { num: '5.2', action: 'Appliquer une étiquette ou une durée à la sélection', expected: 'Toutes les réunions sélectionnées sont mises à jour.' },
      { num: '5.3', action: 'Décaler les dates de la sélection de N jours', expected: 'Les dates des réunions sélectionnées sont décalées de N jours.' },
      { num: '5.4', action: 'Supprimer la sélection en lot', expected: 'Toutes les réunions sélectionnées sont supprimées.' },
    ],
  },
  {
    title: '6. Réunion individuelle',
    tests: [
      { num: '6.1', action: 'Ouvrir le détail d\'une réunion', expected: 'Panneau latéral avec titre, lieu/lien, ordre du jour, participants.' },
      { num: '6.2', action: 'Saisir un ordre du jour (markdown)', expected: 'L\'ordre du jour est enregistré et rendu correctement.' },
      { num: '6.3', action: 'Ajouter des participants (liste de diffusion + ajout unitaire)', expected: 'Les participants apparaissent sur la réunion.' },
    ],
  },
  {
    title: '7. Listes de diffusion',
    tests: [
      { num: '7.1', action: 'Créer une liste globale et y ajouter des membres', expected: 'La liste est réutilisable sur tous les événements.' },
      { num: '7.2', action: 'Créer une liste locale à un événement', expected: 'La liste n\'est disponible que dans cet événement.' },
      { num: '7.3', action: 'Appliquer une liste de diffusion à une réunion', expected: 'Les membres de la liste deviennent participants de la réunion.' },
    ],
  },
  {
    title: '8. Envoi & synchronisation',
    tests: [
      { num: '8.1', action: 'Choisir un mode d\'envoi (Graph / SMTP / .ics / Pivot)', expected: 'Le mode sélectionné est pris en compte pour l\'envoi.' },
      { num: '8.2', action: 'Envoyer une réunion', expected: 'Le statut passe à Envoyée (SENT).' },
      { num: '8.3', action: 'Modifier une réunion déjà envoyée', expected: 'Le statut passe à Modifiée (UPDATED) ; un update est propagé.' },
      { num: '8.4', action: 'Annuler une réunion envoyée', expected: 'Le statut passe à Annulée (CANCELLED).' },
      { num: '8.5', action: 'Simuler un échec d\'envoi puis relancer', expected: 'L\'erreur est affichée par réunion ; la reprise sur échec renvoie l\'invitation.' },
      { num: '8.6', action: 'Exporter une réunion en .ics (fallback)', expected: 'Un fichier .ics valide est téléchargé.' },
    ],
  },
  {
    title: '9. Connecteur Microsoft Graph',
    tests: [
      { num: '9.1', action: 'Avec Graph non configuré, observer le module', expected: 'Mode dégradé : pas d\'envoi Graph, export .ics manuel disponible.' },
      { num: '9.2', action: 'Connecter un compte Microsoft (OAuth délégué)', expected: 'Le compte est lié ; les tokens sont stockés chiffrés.' },
      { num: '9.3', action: 'Envoyer une réunion via Graph', expected: 'Événement Outlook créé + lien Teams généré (onlineMeeting).' },
    ],
  },
  {
    title: '10. Vue calendrier',
    tests: [
      { num: '10.1', action: 'Ouvrir le calendrier d\'un événement (mois / semaine / agenda)', expected: 'Les réunions s\'affichent ; code couleur par étiquette.' },
      { num: '10.2', action: 'Observer les indicateurs de statut', expected: 'Brouillon (pointillé), envoyée (plein), annulée (barré).' },
      { num: '10.3', action: 'Superposer plusieurs événements (vue multi-événements)', expected: 'Chaque événement a sa couleur ; filtres et masquage disponibles.' },
    ],
  },
  {
    title: '11. Historique des modifications',
    tests: [
      { num: '11.1', action: 'Modifier une réunion et consulter l\'historique de l\'événement', expected: 'Une entrée (action, champ, auteur, date) est enregistrée.' },
      { num: '11.2', action: 'Supprimer une réunion puis rouvrir l\'historique', expected: 'L\'historique survit (libellé figé de la réunion supprimée).' },
    ],
  },
  {
    title: '12. Templates',
    tests: [
      { num: '12.1', action: 'Créer un template depuis un événement existant', expected: 'Template créé avec des lignes en décalages relatifs (sans dates absolues).' },
      { num: '12.2', action: 'Instancier un événement depuis un template (date de départ)', expected: 'Les réunions sont générées aux dates relatives à la date de départ.' },
      { num: '12.3', action: 'Consulter la bibliothèque de templates', expected: 'Templates personnels et partagés à l\'espace listés.' },
    ],
  },
  {
    title: '13. Reporting',
    tests: [
      { num: '13.1', action: 'Ouvrir le tableau de bord d\'un événement', expected: 'Métriques affichées : taux d\'envoi, réunions modifiées, annulations.' },
      { num: '13.2', action: 'Observer les indicateurs de charge', expected: 'Participants uniques et charge réunion (heures × participants) affichés.' },
    ],
  },
  {
    title: '14. Droits & permissions',
    tests: [
      { num: '14.1', action: 'En tant que Lecteur, tenter de créer/modifier une réunion', expected: 'Action refusée : seuls Propriétaire et Éditeur peuvent éditer/envoyer.' },
      { num: '14.2', action: 'Partager l\'événement via un lien', expected: 'Le rôle obtenu est Lecteur uniquement (pas d\'envoi externe).' },
      { num: '14.3', action: 'Nommer un co-propriétaire', expected: 'Le co-propriétaire a les mêmes droits (même modèle que les boards).' },
    ],
  },
  {
    title: '15. Thème sombre',
    tests: [
      { num: '15.1', action: 'Basculer en thème sombre (Profil -> Thème) et recharger /meetops', expected: 'Tableau, calendrier et panneaux respectent le thème sombre. Aucun texte illisible.' },
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
    tf.addToPage(page, { x, y: rectBottom(yTop + PAD, h - 2 * PAD), width: w - 2 * PAD, height: h - 2 * PAD, borderColor: rgb(0.88, 0.88, 0.93), borderWidth: 0.4, backgroundColor: cl.white })
    tf.setFontSize(FS - 0.5)
    if (multiline) tf.enableMultiline()
  }

  newPage()
  drawRect(M, currentY, CW, 42, cl.indigo, null)
  drawText('CAHIER DE TESTS — MEETOPS', M + 12, currentY + 12 + 14, fB, 14, cl.white)
  drawText(`PouetPouet v0.15.1  ·  ${TOTAL} tests à exécuter`, M + 12, currentY + 30 + FS, fR, 8, rgb(0.82, 0.80, 1.0))
  currentY += 42 + 8

  const META_H = 21, META_COL = CW / 2
  drawRect(M, currentY, CW, META_H * 2 + 8, cl.sectionBg, cl.border)
  ;[['Date du test', 'meta_date'], ['Testeur', 'meta_testeur'], ['Environnement', 'meta_env'], ['Navigateur', 'meta_nav']].forEach(([label, name], i) => {
    const col = i % 2, row = Math.floor(i / 2)
    const xBase = M + 6 + col * META_COL, yBlock = currentY + 4 + row * META_H
    const labelW = fR.widthOfTextAtSize(label + ' : ', FS)
    drawText(label + ' :', xBase, yBlock + PAD + FS, fR, FS, cl.gray)
    const tf = form.createTextField(name)
    tf.addToPage(page, { x: xBase + labelW + 2, y: rectBottom(yBlock + 3, META_H - 6), width: META_COL - labelW - 20, height: META_H - 6, borderColor: cl.border, borderWidth: 0.5, backgroundColor: cl.white })
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
    tf.addToPage(page, { x: xBase + PAD + lw + 2, y: rectBottom(currentY + 3, BRH - 6), width: 40, height: BRH - 6, borderColor: cl.border, borderWidth: 0.5, backgroundColor: cl.white })
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
  tfSig.addToPage(page, { x: M + PAD + sigLw + 2, y: rectBottom(currentY + 3, 16), width: 190, height: 16, borderColor: cl.border, borderWidth: 0.5, backgroundColor: cl.white })
  tfSig.setFontSize(FS)

  const bytes = await doc.save()
  const outPath = 'apps/web/public/aide/CT-v0.15.1-meetops.pdf'
  writeFileSync(outPath, bytes)
  console.log(`✓  ${outPath}  (${TOTAL} tests · ${doc.getPageCount()} page${doc.getPageCount() > 1 ? 's' : ''})`)
}

generate().catch(console.error)
