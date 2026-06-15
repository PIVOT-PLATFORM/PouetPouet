// Generates an interactive PDF test notebook for Compte / Profil.
// Run: node docs/cahiers-tests/generate-compte.mjs

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
    title: '1. Inscription',
    tests: [
      { num: '1.1', action: 'Naviguer vers /register et remplir le formulaire valide', expected: 'Compte créé. Email de vérification envoyé. Message de confirmation affiché.' },
      { num: '1.2', action: 'S\'inscrire avec un email déjà utilisé', expected: 'Erreur "Email déjà utilisé". Aucun compte créé.' },
      { num: '1.3', action: 'S\'inscrire avec un mot de passe trop court ou invalide', expected: 'Erreur de validation affichée. Aucun compte créé.' },
      { num: '1.4', action: 'S\'inscrire avec un email invalide', expected: 'Erreur de validation email affichée. Aucun compte créé.' },
    ],
  },
  {
    title: '2. Vérification email',
    tests: [
      { num: '2.1', action: 'Tenter de se connecter avant validation de l\'email', expected: 'Connexion bloquée. Message demandant de valider l\'email affiché.' },
      { num: '2.2', action: 'Cliquer sur le lien de vérification reçu par email', expected: 'Email validé. Connexion autorisée. Redirection vers le dashboard.' },
      { num: '2.3', action: 'Réutiliser un lien de vérification déjà consommé', expected: 'Erreur ou message "lien invalide ou expiré" affiché.' },
    ],
  },
  {
    title: '3. Connexion',
    tests: [
      { num: '3.1', action: 'Se connecter avec un email et mot de passe corrects', expected: 'Connexion réussie. Redirection vers le dashboard.' },
      { num: '3.2', action: 'Se connecter avec un mot de passe incorrect', expected: 'Erreur "Identifiants invalides". Aucune connexion.' },
      { num: '3.3', action: 'Laisser la session inactive 30 min', expected: 'Avertissement d\'expiration affiché avant la déconnexion automatique.' },
      { num: '3.4', action: 'Se déconnecter (bouton dans le profil)', expected: 'Token supprimé. Redirection vers /login.' },
    ],
  },
  {
    title: '4. Réinitialisation du mot de passe',
    tests: [
      { num: '4.1', action: 'Cliquer sur "Mot de passe oublié" sur /login et saisir l\'email', expected: 'Email de réinitialisation envoyé. Message de confirmation affiché.' },
      { num: '4.2', action: 'Utiliser un email inexistant dans le formulaire', expected: 'Aucun email envoyé (comportement silencieux ou erreur selon design).' },
      { num: '4.3', action: 'Cliquer sur le lien de réinitialisation reçu', expected: 'Page /reset-password affichée. Formulaire de nouveau mot de passe visible.' },
      { num: '4.4', action: 'Saisir et confirmer un nouveau mot de passe valide', expected: 'Mot de passe mis à jour. Connexion avec le nouveau mot de passe possible.' },
      { num: '4.5', action: 'Réutiliser un lien de réinitialisation déjà consommé', expected: 'Erreur "lien invalide ou expiré" affiché.' },
    ],
  },
  {
    title: '5. Page Profil',
    tests: [
      { num: '5.1', action: 'Naviguer vers /profile', expected: 'Page profil chargée. Nom, email, bio et avatar actuels affichés.' },
      { num: '5.2', action: 'Modifier le nom et enregistrer', expected: 'Nouveau nom visible dans le profil et dans la barre de navigation.' },
      { num: '5.3', action: 'Modifier la bio et enregistrer', expected: 'Nouvelle bio visible dans le profil.' },
      { num: '5.4', action: 'Uploader un nouvel avatar (image PNG ou JPG)', expected: 'Avatar mis à jour dans le profil et dans la barre de navigation.' },
      { num: '5.5', action: 'Modifier le mot de passe depuis le profil (ancien + nouveau)', expected: 'Mot de passe mis à jour. Connexion avec le nouveau mot de passe possible.' },
      { num: '5.6', action: 'Saisir un ancien mot de passe incorrect lors du changement', expected: 'Erreur "Ancien mot de passe incorrect". Aucune modification.' },
    ],
  },
  {
    title: '6. Thème',
    tests: [
      { num: '6.1', action: 'Basculer entre thème clair et sombre depuis le profil', expected: 'Thème appliqué immédiatement sur toute l\'interface.' },
      { num: '6.2', action: 'Rafraîchir la page après changement de thème', expected: 'Le thème choisi est conservé.' },
    ],
  },
  {
    title: '7. Suppression du compte',
    tests: [
      { num: '7.1', action: 'Cliquer sur "Supprimer mon compte" dans le profil', expected: 'Confirmation demandée : saisir le mot de passe.' },
      { num: '7.2', action: 'Confirmer avec le bon mot de passe', expected: 'Compte supprimé. Déconnexion automatique. Redirection vers /login.' },
      { num: '7.3', action: 'Tenter de se connecter avec le compte supprimé', expected: 'Erreur "Identifiants invalides". Aucune connexion.' },
    ],
  },
  {
    title: '8. Pages légales',
    tests: [
      { num: '8.1', action: 'Accéder aux Mentions légales (lien en pied de page)', expected: 'Page chargée. Contenu lisible. Logo et pied de page cohérents.' },
      { num: '8.2', action: 'Accéder à la Politique de confidentialité', expected: 'Page chargée. Contenu lisible.' },
      { num: '8.3', action: 'Accéder aux CGU', expected: 'Page chargée. Contenu lisible.' },
    ],
  },
  {
    title: '9. Palettes de couleurs',
    tests: [
      { num: '9.1', action: 'Ouvrir Profil -> Préférences et choisir une palette (parmi 7)', expected: 'La palette s\'applique instantanément à toute l\'interface.' },
      { num: '9.2', action: 'Combiner une palette avec le mode nuit', expected: 'La palette et le thème sombre se combinent correctement.' },
      { num: '9.3', action: 'Recharger la page', expected: 'La palette choisie est conservée.' },
    ],
  },
  {
    title: '10. Connexion SSO (OIDC)',
    tests: [
      { num: '10.1', action: 'Sur une instance reliée à un fournisseur d\'identité, ouvrir /login', expected: 'Un bouton "Se connecter avec…" est visible.' },
      { num: '10.2', action: 'Se connecter via le fournisseur SSO', expected: 'Le compte local est lié automatiquement par email ; connexion réussie.' },
    ],
  },
  {
    title: '11. Clés API',
    tests: [
      { num: '11.1', action: 'Créer une clé API depuis le profil', expected: 'Clé générée et affichée une seule fois ; visible dans la liste (jusqu\'à 10 par compte).' },
      { num: '11.2', action: 'Appeler l\'API avec l\'en-tête X-API-Key', expected: 'Authentification acceptée ; la date de dernière utilisation se met à jour.' },
      { num: '11.3', action: 'Révoquer une clé', expected: 'La clé est supprimée ; les appels suivants avec cette clé échouent.' },
    ],
  },
  {
    title: '12. Webhooks sortants',
    tests: [
      { num: '12.1', action: 'Créer un webhook (URL + événements)', expected: 'Webhook créé (jusqu\'à 20 par compte).' },
      { num: '12.2', action: 'Cliquer sur le bouton de test (ping)', expected: 'Un ping signé HMAC-SHA256 est envoyé ; la connectivité est vérifiée en temps réel.' },
      { num: '12.3', action: 'Déclencher un événement abonné (ex. import de board)', expected: 'La livraison apparaît dans l\'historique (statut HTTP, durée, date).' },
      { num: '12.4', action: 'Provoquer un échec de livraison (endpoint en erreur)', expected: 'Une nouvelle tentative part automatiquement après ~30 s ; les deux tentatives sont visibles.' },
    ],
  },
  {
    title: '13. Export RGPD & journal de sécurité',
    tests: [
      { num: '13.1', action: 'Cliquer sur "Exporter mes données" dans le profil', expected: 'Un JSON complet est téléchargé (profil, boards, dailys, salles, équipes, tirages, notifications).' },
      { num: '13.2', action: 'Ouvrir le journal de sécurité du profil', expected: 'Les 50 dernières actions sensibles sont listées (connexions, échecs, mots de passe, clés API, webhooks).' },
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
  drawText('CAHIER DE TESTS — COMPTE / PROFIL', M + 12, currentY + 12 + 14, fB, 14, cl.white)
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
  const outPath = 'apps/web/public/aide/CT-v0.15.1-compte.pdf'
  writeFileSync(outPath, bytes)
  console.log(`✓  ${outPath}  (${TOTAL} tests · ${doc.getPageCount()} page${doc.getPageCount() > 1 ? 's' : ''})`)
}

generate().catch(console.error)
