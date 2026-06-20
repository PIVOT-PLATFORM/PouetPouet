// Generates an interactive PDF test notebook for the Board editor.
// Run: node docs/cahiers-tests/generate-boards.mjs

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
    title: '1. Chargement du board',
    tests: [
      { num: '1.1', action: 'Ouvrir un board depuis le dashboard', expected: 'Le board se charge. La barre d\'outils est visible. Le canvas est centré sur le contenu.' },
      { num: '1.2', action: 'Observer la présence (badge d\'avatar) dans la barre de nav', expected: 'L\'utilisateur courant est affiché dans la zone de présence. Aucune erreur socket.' },
      { num: '1.3', action: 'Ouvrir un board vide', expected: 'Canvas vide affiché. Message ou indicateur suggérant de créer une carte.' },
    ],
  },
  {
    title: '2. Navigation sur le canvas',
    tests: [
      { num: '2.1', action: 'Faire défiler la molette pour zoomer/dézoomer', expected: 'Le zoom s\'applique centré sur la position du curseur. Les contrôles de zoom se mettent à jour.' },
      { num: '2.2', action: 'Maintenir Espace et déplacer la souris (pan)', expected: 'Le canvas se déplace. Curseur main visible. Relâcher Espace restaure l\'outil précédent.' },
      { num: '2.3', action: 'Cliquer sur l\'outil Main dans la barre d\'outils', expected: 'Mode pan activé (icône mise en évidence). Cliquer-glisser déplace le canvas.' },
      { num: '2.4', action: 'Double-cliquer sur un espace vide du canvas', expected: 'Création d\'une nouvelle carte TEXT à l\'endroit du clic.' },
      { num: '2.5', action: 'Appuyer sur Echap', expected: 'Retour à l\'outil Sélection. Cartes désélectionnées. Tous les menus fermés.' },
    ],
  },
  {
    title: '3. Création et édition de cartes',
    tests: [
      { num: '3.1', action: 'Cliquer sur l\'outil Carte (TEXT) puis cliquer sur le canvas', expected: 'Nouvelle carte TEXT créée à la position cliquée. Carte en mode édition.' },
      { num: '3.2', action: 'Double-cliquer sur une carte TEXT existante', expected: 'Carte en mode édition. Curseur positionné à l\'endroit du clic. Carte s\'agrandit à la saisie.' },
      { num: '3.3', action: 'Saisir du texte dans une carte, puis cliquer ailleurs', expected: 'Texte sauvegardé. Carte redimensionnée. Mode édition quitté.' },
      { num: '3.4', action: 'Créer une carte IMAGE depuis la barre d\'outils', expected: 'Sélecteur de fichier s\'ouvre. Image importée et affichée dans la carte.' },
      { num: '3.5', action: 'Déplacer une carte par glisser-déposer', expected: 'Carte se déplace avec le curseur. Position sauvegardée après relâchement.' },
      { num: '3.6', action: 'Redimensionner une carte depuis un coin ou un bord', expected: 'Poignées de redimensionnement visibles au survol. Taille mise à jour en temps réel.' },
      { num: '3.7', action: 'Changer la couleur d\'une carte (barre flottante)', expected: 'Couleur appliquée immédiatement. En-tête colorée de la carte TEXT mise à jour.' },
      { num: '3.8', action: 'Supprimer une carte (touche Suppr ou bouton)', expected: 'Carte supprimée du canvas. Liaisons associées également supprimées.' },
    ],
  },
  {
    title: '4. Formes, dessins et libellés',
    tests: [
      { num: '4.1', action: 'Sélectionner une forme dans la barre d\'outils et tracer sur le canvas', expected: 'Forme créée (rectangle, cercle, étoile, trait, etc.) à la taille dessinée.' },
      { num: '4.2', action: 'Cliquer sur une forme ou un trait (pas autour)', expected: 'La forme est sélectionnée. Cliquer en dehors de la géométrie exacte ne la sélectionne pas.' },
      { num: '4.3', action: 'Utiliser l\'outil Dessin libre', expected: 'Tracé libre visible en temps réel. Couleur et épaisseur configurables.' },
      { num: '4.4', action: 'Ajouter un libellé (LABEL) et saisir du texte', expected: 'Libellé créé et éditable. Aucune poignée d\'ancrage ne couvre le texte.' },
      { num: '4.5', action: 'Quitter l\'édition du libellé (clic ailleurs ou Échap)', expected: 'Le libellé se redimensionne automatiquement pour contenir le texte, sans retour à la ligne.' },
      { num: '4.6', action: 'Zoomer à 200 % puis créer un libellé', expected: 'Libellé créé à la même taille écran qu\'à 100 %. Aucun retour à la ligne forcé par le zoom.' },
    ],
  },
  {
    title: '5. Liaisons entre cartes',
    tests: [
      { num: '5.1', action: 'Sélectionner l\'outil Liaison et cliquer sur une carte source, puis une carte cible', expected: 'Flèche créée entre les deux cartes. Style par défaut appliqué.' },
      { num: '5.2', action: 'Modifier le style de la liaison (droite, courbe, orthogonale)', expected: 'Tracé de la liaison mis à jour immédiatement.' },
      { num: '5.3', action: 'Ajouter un libellé sur une liaison', expected: 'Libellé visible au centre de la liaison. Éditable au double-clic.' },
      { num: '5.4', action: 'Supprimer une liaison (clic + Suppr)', expected: 'Liaison supprimée. Les cartes source et cible restent intactes.' },
      { num: '5.5', action: 'Déplacer une carte connectée', expected: 'La liaison suit la carte. Points d\'ancrage repositionnés correctement.' },
    ],
  },
  {
    title: '6. Cadres (Frames)',
    tests: [
      { num: '6.1', action: 'Créer un cadre et déplacer des cartes dans son aire', expected: 'Cartes capturées dans le cadre (titre du cadre affiché).' },
      { num: '6.2', action: 'Activer le mode "cadre actif" et déplacer le cadre', expected: 'Toutes les cartes non verrouillées dans le cadre se déplacent avec lui.' },
      { num: '6.3', action: 'Désactiver le mode "cadre actif" et déplacer le cadre', expected: 'Seul le cadre se déplace. Les cartes restent en place.' },
    ],
  },
  {
    title: '7. Couches (Layers)',
    tests: [
      { num: '7.1', action: 'Sélectionner une carte et changer sa couche (fond/principal/avant-plan)', expected: 'La carte passe sur la couche sélectionnée. L\'ordre d\'affichage z est mis à jour.' },
      { num: '7.2', action: 'Superposer deux cartes de couches différentes', expected: 'La carte de couche supérieure s\'affiche toujours par-dessus l\'autre.' },
    ],
  },
  {
    title: '8. Groupes',
    tests: [
      { num: '8.1', action: 'Sélectionner plusieurs cartes (Ctrl+clic) et grouper (Ctrl+G)', expected: 'Groupe créé. Bordure colorée commune. Les cartes se déplacent ensemble.' },
      { num: '8.2', action: 'Ouvrir le panneau des groupes (bouton Groupes)', expected: 'Panneau affiché avec la liste des groupes et le nombre de cartes par groupe.' },
      { num: '8.3', action: 'Cliquer sur un groupe dans le panneau', expected: 'Cartes du groupe mises en surbrillance. Les autres cartes sont estompées.' },
      { num: '8.4', action: 'Changer la couleur de contour d\'un groupe', expected: 'Couleur appliquée immédiatement et visible pour tous les participants.' },
      { num: '8.5', action: 'Supprimer un groupe depuis le panneau', expected: 'Groupe dissous. Les cartes restent sur le board sans appartenance à un groupe.' },
      { num: '8.6', action: 'Réduire un groupe à un seul objet (supprimer toutes les cartes sauf une)', expected: 'Groupe automatiquement dissous.' },
    ],
  },
  {
    title: '9. Sélection multiple',
    tests: [
      { num: '9.1', action: 'Cliquer-glisser pour sélectionner plusieurs cartes', expected: 'Toutes les cartes dans la zone de sélection sont sélectionnées. Barre flottante apparaît.' },
      { num: '9.2', action: 'Appuyer sur Ctrl+A', expected: 'Toutes les cartes du board sont sélectionnées.' },
      { num: '9.3', action: 'Appuyer sur Ctrl+D', expected: 'Toutes les sélections sont désélectionnées. Barre flottante disparaît.' },
      { num: '9.4', action: 'Sélectionner plusieurs cartes et appuyer sur Suppr', expected: 'Toutes les cartes sélectionnées sont supprimées.' },
      { num: '9.5', action: 'Utiliser les outils d\'arrangement (aligner, répartir, grille)', expected: 'Les cartes sont repositionnées selon l\'arrangement choisi.' },
    ],
  },
  {
    title: '10. Undo / Redo',
    tests: [
      { num: '10.1', action: 'Créer une carte puis appuyer sur Ctrl+Z', expected: 'La carte est supprimée (action annulée).' },
      { num: '10.2', action: 'Déplacer une carte puis Ctrl+Z', expected: 'La carte revient à sa position précédente.' },
      { num: '10.3', action: 'Annuler puis appuyer sur Ctrl+Y (ou Ctrl+Shift+Z)', expected: 'L\'action annulée est rétablie.' },
      { num: '10.4', action: 'Grouper des cartes, annuler (Ctrl+Z)', expected: 'Le groupe est dissous. Les cartes retrouvent leur état précédent.' },
      { num: '10.5', action: 'Verrouiller une carte, annuler (Ctrl+Z)', expected: 'La carte est déverrouillée. L\'état de verrouillage est bien annulable.' },
    ],
  },
  {
    title: '11. Import / Export',
    tests: [
      { num: '11.1', action: 'Ouvrir le menu Import et importer un fichier .klx', expected: 'Cartes importées sur le board depuis le fichier Klaxoon.' },
      { num: '11.2', action: 'Importer un PDF', expected: 'Une carte IMAGE est créée par page du PDF.' },
      { num: '11.3', action: 'Coller une image (Ctrl+V avec image dans le presse-papier)', expected: 'Une carte IMAGE est créée avec l\'image collée.' },
      { num: '11.4', action: 'Exporter le board en PDF (menu Export)', expected: 'Fichier PDF téléchargé. Le contenu du board est visible sur une page.' },
      { num: '11.5', action: 'Exporter en PNG', expected: 'Fichier PNG téléchargé. Dimensions correctes.' },
      { num: '11.6', action: 'Exporter en Excel (.xlsx)', expected: 'Fichier Excel téléchargé. Les cartes TEXT et leurs champs sont listés.' },
      { num: '11.7', action: 'Exporter en archive PouetPouet (.ppb) puis l\'importer', expected: 'Le board est restauré à l\'identique (cartes, liaisons, groupes, couches).' },
    ],
  },
  {
    title: '12. Copier-coller inter-boards',
    tests: [
      { num: '12.1', action: 'Sélectionner des cartes et Ctrl+C, puis ouvrir un autre board et Ctrl+V', expected: 'Les cartes sont collées sur le second board avec préservation des groupes et couches.' },
      { num: '12.2', action: 'Coller une seconde fois (Ctrl+V) sur le même board', expected: 'Aucune carte collée (le presse-papier a été vidé après le premier collage).' },
    ],
  },
  {
    title: '13. Votes sur cartes',
    tests: [
      { num: '13.1', action: 'Ouvrir le menu Vote et configurer une session de vote', expected: 'Fenêtre de configuration ouverte. Paramètres de la session visibles.' },
      { num: '13.2', action: 'Démarrer une session de vote', expected: 'Bouton de vote affiché sur chaque carte. Les participants peuvent voter.' },
      { num: '13.3', action: 'Arrêter la session de vote', expected: 'Boutons de vote masqués. Résultats visibles sur les cartes (si configuré).' },
    ],
  },
  {
    title: '14. Collaboration temps réel',
    tests: [
      { num: '14.1', action: 'Ouvrir le même board depuis deux onglets/navigateurs', expected: 'Les modifications d\'un onglet apparaissent en temps réel dans l\'autre.' },
      { num: '14.2', action: 'Observer les curseurs des autres utilisateurs', expected: 'Les curseurs des autres participants sont visibles avec leur nom.' },
      { num: '14.3', action: 'Couper la connexion et la rétablir', expected: 'Reconnexion automatique. Les modifications faites hors-ligne ne sont pas perdues.' },
    ],
  },
  {
    title: '15. Tableaux',
    tests: [
      { num: '15.1', action: 'Cliquer sur l\'outil Tableau puis cliquer sur le canvas', expected: 'Un tableau 3x3 vide est créé à la position cliquée.' },
      { num: '15.2', action: 'Cliquer dans une cellule et saisir du texte', expected: 'Le texte est éditable dans la cellule et sauvegardé en quittant la cellule.' },
      { num: '15.3', action: 'Sélectionner le tableau et utiliser +/- Lignes', expected: 'Une ligne est ajoutée / la dernière retirée (minimum 1 ligne).' },
      { num: '15.4', action: 'Sélectionner le tableau et utiliser +/- Colonnes', expected: 'Une colonne est ajoutée / la dernière retirée (minimum 1 colonne).' },
      { num: '15.5', action: 'Glisser la bordure entre deux colonnes', expected: 'La largeur des deux colonnes adjacentes s\'ajuste ; la répartition est conservée après F5.' },
      { num: '15.6', action: 'Déplacer le tableau via la poignée du haut', expected: 'Le tableau se déplace ; cliquer une cellule ne déclenche pas le déplacement.' },
      { num: '15.7', action: 'Copier un tableau dans Excel / Google Sheets puis coller (Ctrl+V) sur le canvas', expected: 'Un tableau reprenant les lignes et colonnes collées est créé au curseur.' },
      { num: '15.8', action: 'Sélectionner un tableau existant puis coller un tableau du presse-papier', expected: 'Le tableau sélectionné est rempli avec les données collées (pas de nouvelle carte).' },
      { num: '15.9', action: 'Changer la couleur du tableau (barre flottante)', expected: 'La teinte de l\'en-tête (1re ligne) est mise à jour.' },
    ],
  },
  {
    title: '16. Grille d\'aimantation & guides d\'alignement',
    tests: [
      { num: '16.1', action: 'Activer la grille via le bouton dédié de la barre d\'outils', expected: 'Un quadrillage apparaît ; les éléments déplacés s\'aimantent à la grille.' },
      { num: '16.2', action: 'Activer les guides d\'alignement et déplacer une carte près d\'une autre', expected: 'Des lignes roses apparaissent quand les bords/centres s\'alignent ; la carte s\'aimante.' },
      { num: '16.3', action: 'Relâcher la carte', expected: 'Les guides disparaissent ; la carte reste à la position alignée.' },
      { num: '16.4', action: 'Recharger la page (F5)', expected: 'Les préférences grille / guides sont conservées.' },
    ],
  },
  {
    title: '17. Verrou d\'édition & robustesse collaborative',
    tests: [
      { num: '17.1', action: 'Depuis deux onglets, commencer à éditer une carte dans l\'un', expected: 'L\'autre onglet affiche "édite…" sur la carte et ne peut pas l\'ouvrir en même temps.' },
      { num: '17.2', action: 'Un collègue crée une carte pendant que vous écrivez dans une autre', expected: 'Votre curseur/saisie n\'est pas volé par la nouvelle carte.' },
      { num: '17.3', action: 'Réinitialiser le board puis Ctrl+Z', expected: 'Suppression atomique (pas d\'éléments fantômes) ; le contenu effacé est restauré.' },
      { num: '17.4', action: 'Supprimer le même objet simultanément depuis deux onglets', expected: 'Aucune erreur serveur ; l\'objet disparaît proprement des deux côtés.' },
    ],
  },
  {
    title: '18. Rôles & co-propriété',
    tests: [
      { num: '18.1', action: 'En tant qu\'Éditeur, tenter de réinitialiser le board', expected: 'Action refusée : la réinitialisation est réservée aux propriétaires.' },
      { num: '18.2', action: 'En tant qu\'Éditeur, prolonger un vote en cours', expected: 'Action autorisée (lancer / prolonger / clôturer un vote).' },
      { num: '18.3', action: 'Partager le board via un lien et rejoindre', expected: 'Le rôle obtenu via le lien est au maximum Éditeur (jamais Propriétaire).' },
      { num: '18.4', action: 'Nommer un co-propriétaire et vérifier ses droits', expected: 'Le co-propriétaire gère partages, paramètres et suppression ; le créateur reste intouchable.' },
    ],
  },
  {
    title: '19. Thème sombre',
    tests: [
      { num: '19.1', action: 'Basculer en thème sombre et recharger le board', expected: 'Canvas, barre d\'outils et panneaux respectent le thème sombre. Cartes lisibles.' },
    ],
  },
  {
    title: '20. Paramètres du board',
    tests: [
      { num: '20.1', action: 'Désactiver "Vote" dans les paramètres, recharger la page', expected: 'Le bouton Vote n\'apparaît plus dans la barre d\'outils.' },
      { num: '20.2', action: 'Désactiver "Timer" dans les paramètres', expected: 'Le bouton Timer n\'apparaît plus dans la barre d\'outils.' },
      { num: '20.3', action: 'Fixer un max de participants (ex. 2), faire rejoindre un 3e participant', expected: 'Le 3e participant reçoit "Session complète". L\'animateur ne compte pas.' },
      { num: '20.4', action: 'Réactiver une fonctionnalité désactivée', expected: 'Le bouton correspondant réapparaît sans rechargement de page.' },
    ],
  },
  {
    title: '21. Zoom & création d\'items',
    tests: [
      { num: '21.1', action: 'Zoomer à 50 % puis créer un sticky, une forme et un libellé', expected: 'Chaque item a une empreinte à l\'écran identique à celle à 100 % de zoom.' },
      { num: '21.2', action: 'Zoomer à 200 % puis créer les mêmes items', expected: 'Même empreinte écran. Les items ne sont pas disproportionnés.' },
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
  drawText('CAHIER DE TESTS — ÉDITEUR DE BOARDS', M + 12, currentY + 12 + 14, fB, 14, cl.white)
  drawText(`PouetPouet v0.19.0  ·  ${TOTAL} tests à exécuter`, M + 12, currentY + 30 + FS, fR, 8, rgb(0.82, 0.80, 1.0))
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
  const outPath = 'apps/web/public/aide/CT-v0.19.0-boards.pdf'
  writeFileSync(outPath, bytes)
  console.log(`✓  ${outPath}  (${TOTAL} tests · ${doc.getPageCount()} page${doc.getPageCount() > 1 ? 's' : ''})`)
}

generate().catch(console.error)
