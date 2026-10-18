# Vidéo de pitch — Pivot (Challenge Innovation)

Script de tournage, version **narrative**.
Production : Veo (couloir et salles) + ElevenLabs (voix off) + capture d'écran → montage CapCut.

---

## 1. Le concept

**Un couloir d'entreprise.** La caméra avance. De part et d'autre, des salles
vitrées : à droite un atelier qui part en fumée, à gauche un mur de ficelles
recopié à la main dans un tableur, plus loin le shadow IT, puis une idée qui
meurt dans une bannette.
Chaque salle est une douleur de l'avant-Pivot — et chacune a **une réponse
produit précise** (§3).

**Au bout du couloir, un écran.** La caméra s'en approche, plonge dedans — on
bascule sur l'application réelle, enregistrée en direct. La démo n'est pas une
parenthèse : c'est la destination du récit.

**On ressort de l'écran — et la salle du bout reprend vie.** Cadre identique à
celui d'avant la plongée, à la fenêtre près : la lumière revient, les stores se
lèvent, la plante reverdit, les gens entrent. Rien ne bouge d'autre. C'est le
plan qui dit *Pivot a réanimé la boîte* sans un mot, et c'est le cœur émotionnel
du film.

Puis on redescend le couloir **en sens inverse** : les quatre salles, vivantes.

### Format

| Paramètre | Valeur |
|-----------|--------|
| **Durée** | **2 min 45** (165 s) |
| Ratio | 16:9 — 1920×1080, 30 fps |
| Structure | Acte I couloir **62 s** · Acte II écran **72 s** · Acte III résolution **31 s** |
| Plans Veo | **11 plans**, ~15 générations (§5) — l'acte II n'est pas généré |
| Voix off | Une voix française narrative (~2,4 mots/s) — ~400 mots |
| Musique | Un thème en 3 mouvements : tendu → suspendu → lumineux |

---

## 2. Conducteur

### Acte I — Le couloir (0:00 → 1:02)

| # | TC | Durée | Plan | Clip |
|---|----|-------|------|------|
| A1 | 0:00 → 0:09 | 9 s | Entrée du couloir, vide, trop calme | `CO1` |
| — | 0:09 → 0:12 | 3 s | Liaison, pano à **droite** | `LIA` |
| A2 | 0:12 → 0:22 | 10 s | **Salle 1 — L'atelier perdu** | `R1` |
| — | 0:22 → 0:25 | 3 s | Liaison, pano à **gauche** | `LIA` ↔ miroir |
| A3 | 0:25 → 0:35 | 10 s | **Salle 2 — Le mur recopié** | `R2` |
| — | 0:35 → 0:38 | 3 s | Liaison, pano à **droite** | `LIA` |
| A4 | 0:38 → 0:46 | 8 s | **Salle 3 — Le shadow IT** | `R3` |
| — | 0:46 → 0:49 | 3 s | Liaison, pano à **gauche** | `LIA` ↔ miroir |
| A5 | 0:49 → 0:57 | 8 s | **Salle 4 — L'idée qui meurt** | `R4` |
| A6 | 0:57 → 1:02 | 5 s | **La salle du bout** — grise, éteinte, un écran s'allume | `CO6` |

### Acte II — Dans l'écran (1:02 → 2:14)

| # | TC | Durée | Contenu | Répond à |
|---|----|-------|---------|----------|
| B0 | 1:02 → 1:08 | 6 s | **Plongée dans l'écran** | — |
| B1 | 1:08 → 1:20 | 12 s | **Hub · identité · souveraineté** | Salle 3 |
| B2 | 1:20 → 1:38 | 18 s | **Tableau blanc temps réel** | Salle 1 |
| B3 | 1:38 → 1:58 | 20 s | **Capacité · Roadmap · PI Planning** | Salle 2 |
| B4 | 1:58 → 2:14 | 16 s | **Innovation** | Salle 4 |

> **B1 → B4 sont intégralement capturés à l'écran — aucun plan généré, plein
> cadre, pas de vignette.** Les deux seuls plans Veo de l'acte II sont la
> **plongée** (B0) et la **sortie** (C1), et ils forment une **paire continue** :
> même salle, même cadre, même axe. On entre par l'écran, on ressort par l'écran,
> au même endroit.

### Acte III — La résolution (2:14 → 2:45)

| # | TC | Durée | Contenu | Clip |
|---|----|-------|---------|------|
| C1 | 2:14 → 2:24 | 10 s | **La renaissance** — on ressort sur le cadre exact de A6, la couleur revient | `REBIRTH` |
| C2 | 2:24 → 2:39 | 15 s | **Le retour** — couloir en sens inverse, **gains en périphérie**, ROI et élévation finale | `CO7` |
| C3 | 2:39 → 2:45 | 6 s | Signature | `LOGO` |

> **La symétrie porte tout l'acte.** À l'acte I on remonte le couloir *vers*
> l'écran, dans le froid. À l'acte III on le redescend *depuis* l'écran, dans la
> couleur. Même décor, sens inverse, température inverse.
>
> **Attention au sens :** en repartant dans l'autre sens, on croise les salles
> **en ordre inverse et du côté opposé** — salle 4 à droite, salle 3 à gauche,
> salle 2 à droite, salle 1 à gauche. Le prompt `CO7` et les gains périphériques
> (§8) suivent cet ordre.

---

## 3. Les 4 salles et leur réponse produit

> C'est la colonne vertébrale du film. Chaque salle pose une douleur, un beat de
> démo y répond avec des **fonctionnalités nommées et montrées à l'écran**, et
> l'acte III en montre le résultat. Ne jamais réordonner un étage sans les autres.

### Salle 1 — L'atelier perdu → **Tableau blanc (PouetPouet)**

| | |
|---|---|
| **Douleur (A2)** | Un mur de post-its photographié au téléphone. Demain, recopié à la main. Ou perdu. |
| **Beat de réponse** | **B2** (1:20 → 1:38, 18 s) |
| **Fonctionnalités à montrer** | Cartes, cadres, groupes, **connexions** · **votes sur cartes** · templates · **temps réel multi-curseurs** · lien de partage public, **participant anonyme sans compte** · partage par rôles Lecteur/Éditeur · export |
| **Capture** | Créer un post-it, le déplacer, le relier à un autre → **split 2 navigateurs**, le curseur du second participant bouge en direct → lancer un vote, les points apparaissent en temps réel |
| **Overlay** | `Temps réel · lien public, sans compte` |
| **Résolution (C2)** | La salle a gardé son mur d'idées — sur l'écran partagé, personne ne photographie |

### Salle 2 — Le mur recopié → **Capacité · Roadmap · PI Planning · Portefeuille**

> **Salle fusionnée** (ex-salles B et K du catalogue). Le mur de kraft apporte
> l'image, le tableur apporte le vécu : un jury non-agile ne connaît pas le
> program board, mais tout le monde a vu quelqu'un recopier quelque chose à la
> main dans Excel. Les deux dans le même plan, la douleur *et* sa cause.

| | |
|---|---|
| **Douleur (A3)** | Un mur de kraft couvert de post-its et de fils rouges tendus entre équipes. Dos au mur, quelqu'un recopie tout ça à la main dans un tableur. Un post-it se décolle et tombe derrière lui — il ne le voit pas. |
| **Beat de réponse** | **B3** (1:38 → 1:58, 20 s) |
| **Fonctionnalités à montrer** | **Capacité** : roster, FTE, disponibilités, sprint / PI / release · **Roadmap** : Gantt d'initiatives et jalons, statuts, responsables, **dépendances**, vues trimestre/mois/semaine, export PDF/CSV · **PI Planning** : **program board multi-équipes, tickets typés, dépendances** — les fils rouges, en natif · **Portefeuille** : plusieurs roadmaps sur une timeline unique · partage par rôles Lecteur/Éditeur/Owner |
| **Capture** | Capacité (roster + dispos, 5 s) → Roadmap Gantt, drag d'un jalon, changement d'échelle (7 s) → **program board PI : tirer une dépendance entre deux équipes, elle se trace et se garde** (8 s). Portefeuille en insert 2 s seulement si le timing le permet. |
| **Overlay** | `Une source · pas trois versions` |
| **Résolution (C2)** | Le mur de kraft est nu, les fils rouges enroulés sur la table ; tout est sur le grand écran, les mêmes personnes détendues devant |

> **Le plan de la dépendance tirée est le plus important de B3.** C'est le rappel
> visuel direct du fil rouge de l'acte I. Le capturer lentement et zoomer dessus
> en post.

### Salle 3 — Le shadow IT → **Hub · identité · auto-hébergement · Feedback**

| | |
|---|---|
| **Douleur (A4)** | Carte bleue perso, compte ouvert en deux minutes, en douce. Le shadow IT comble un vide. |
| **Beat de réponse** | **B1** (1:08 → 1:20, 12 s) |
| **Fonctionnalités à montrer** | **Hub** : tous les modules, favoris, activité récente, une seule identité · **SSO OIDC / LDAP**, JWT, clés API · **auto-hébergé** — données sur votre infra · export RGPD, suppression de compte, audit log · **Feedback** : kanban de retours (bugs & idées) avec votes — le besoin remonte *dans* l'outil |
| **Capture** | Hub : scroll lent sur la grille de modules, survol de 2–3 cartes, favoris et activité visibles → un aperçu 2 s de l'écran de connexion SSO |
| **Overlay** | `19 modules · une identité · votre serveur` |
| **Résolution (C2)** | La carte bleue retourne dans le portefeuille ; la personne ouvre le hub de l'entreprise |

### Salle 4 — L'idée qui meurt → **Innovation**

| | |
|---|---|
| **Douleur (A5)** | Une vraie idée, écrite avec enthousiasme, jetée dans une bannette pleine. Silence. |
| **Beat de réponse** | **B4** (1:58 → 2:14, 16 s) |
| **Fonctionnalités à montrer** | **Innovation** : fiches publiques ou privées, **votes, favoris, commentaires**, pièces jointes, liens, tags · **challenges administrés**, jurys, **notation multi-critères** · dashboard et gamification · instruction de l'idée via **Formulaires** et **Parcours** |
| **Capture** | Une fiche d'idée s'ouvre (votes qui montent, commentaires) → vue challenge avec classement → grille de notation du jury → dashboard |
| **Overlay** | `Vue · suivie · décidée` |
| **Résolution (C2)** | La bannette est vide ; la feuille est devenue une fiche votée, affichée sur le tableau de bord |

---

## 4. Voix off

> Texte définitif, à coller tel quel dans le TTS. Les « / » marquent une respiration.
> Chiffres en toutes lettres : un TTS lit mal « 330 000 € ».

### ACTE I

**A1 (0:00 → 0:09)**
> Chaque entreprise a ce couloir. / Des portes fermées. Derrière chacune, une
> équipe qui essaie de travailler avec les autres. / Et qui n'y arrive pas.

**A2 — L'atelier perdu (0:12 → 0:22)**
> À droite, l'atelier. Deux heures de post-its, des idées partout. / Demain, tout
> sera recopié à la main dans un autre outil. Ou perdu. / Le plus souvent : perdu.

**A3 — Le mur recopié (0:25 → 0:35)**
> À gauche, le pilotage. Un mur de ficelles — et quelqu'un qui le recopie à la
> main dans un tableur. / La capacité, la roadmap, les dépendances : un seul
> fichier. / Déjà trois versions.

**A4 — Le shadow IT (0:38 → 0:46)**
> Ici, personne n'a attendu. Un outil gratuit, une carte bleue perso, un compte en
> deux minutes. / Le shadow IT ne se cache pas. / Il comble un vide.

**A5 — L'idée qui meurt (0:49 → 0:57)**
> Et là, une idée. Une vraie. / Elle finit dans une bannette, puis dans le
> silence. / Personne ne saura jamais qu'elle a existé.

**A6 — Le bout du couloir (0:57 → 1:05)** *(déborde sur la plongée)*
> Au bout du couloir, il y a un écran. / Et devant cet écran, quelqu'un a arrêté
> de subir.

### ACTE II

**B0 — La plongée (1:05 → 1:08)**
> Pivot. / Une seule suite. Dix-neuf modules. Un seul graphe de données.

**B1 — Hub (1:08 → 1:20)** — *répond à la salle 3*
> Tout est là. Un hub, une identité, vos équipes. / Le SSO de l'entreprise, pas
> une carte bleue. / Et le serveur, c'est le vôtre.

**B2 — Tableau blanc (1:20 → 1:38)** — *répond à la salle 1*
> L'atelier de tout à l'heure — il vit ici. Cartes, cadres, groupes, connexions,
> votes. / Deux curseurs, deux navigateurs, la même session en temps réel. / Les
> participants arrivent par un lien, sans créer de compte. / Rien à photographier.
> Rien à recopier demain matin.

**B3 — Pilotage (1:38 → 1:58)** — *répond à la salle 2*
> Le mur d'à côté ? Le voilà — mais vivant, partagé, à jour. / La capacité
> d'équipe : roster, disponibilités, sprint ou PI. / La roadmap : jalons,
> responsables, dépendances, en Gantt. / Et le program board, où les fils rouges
> sont devenus des liens qu'on ne recolle plus. / Une source. Pas trois versions.

**B4 — Innovation (1:58 → 2:14)** — *répond à la salle 4*
> Et l'idée de la bannette ? Elle devient une fiche. Des votes, des commentaires,
> des pièces jointes. / Un challenge, un jury, une notation multi-critères. / Elle
> est vue, elle est suivie, elle est décidée. / Dix-neuf modules, un seul graphe.

### ACTE III

**C1 — La renaissance (2:14 → 2:24)**
> Il n'y a plus de vide.
>
> *(≈ 4 secondes de silence total. La couleur revient, la musique seule. **Ne pas
> combler ce silence** — c'est lui qui fait exister le plan.)*
>
> La même salle. Les mêmes gens. / Tout ce qui manquait, c'était un endroit où se
> retrouver.

**C2 — Le retour (2:24 → 2:39)**
> Les portes sont ouvertes. / L'idée de la bannette est sur le tableau de bord. Le
> mur a gardé ses dépendances. / Et l'atelier, toutes ses idées.
>
> *(silence ~1 s — les quatre gains périphériques finissent de s'effacer)*
>
> Et trois cent trente mille euros par an qui redeviennent du budget.

*(VO clairsemée à dessein — 37 mots pour 15 s. L'œil doit avoir le temps de lire
les gains en périphérie. Ne pas remplir.)*

> **La dernière phrase se cale sur deux choses en même temps** : le cartouche
> central `~330 000 €/an` qui apparaît à 2:33,5, et le début de l'élévation
> finale. Le chiffre est dit et montré au même instant, sur le seul mouvement
> ascendant du film.

**C3 — Signature (2:39 → 2:45)**
> Une équipe. Un espace. Vos données chez vous. / Pivot. Zéro dépendance.

> **Pourquoi le ROI n'est pas ici.** La dernière chose qu'on entend doit être la
> thèse, pas le prix : un film qui finit sur un montant ressemble à une facture.
> Le chiffre ferme l'argumentaire en C2 ; C3 ferme le propos. Ne pas déplacer.

*(2 dernières secondes : silence, logo plein cadre.)*

---

## 5. Plans Veo — 11 plans

### Pourquoi seulement 11

Les quatre liaisons de couloir sont **le même plan**, réutilisé : retourné
horizontalement pour les regards à gauche, re-timé (×0,9 / ×1,1) et recadré
différemment à chaque passage. Trois secondes de couloir anonyme ne se
reconnaissent pas d'un passage à l'autre — surtout avec un étalonnage légèrement
décalé. **Une génération couvre les quatre transitions.**

Et **l'acte II ne contient aucun plan généré** hors la plongée et la sortie : la
démo est une capture d'écran plein cadre, sans vignette.

| Priorité | Plans | Variantes à générer |
|---|---|---|
| Critiques (portent le récit) | `CO1` `CO6` `REBIRTH` `CO7` | 2 chacun = 8 |
| Standards | `LIA` `R1` `R2` `R3` `R4` `DIVE` `LOGO` | 1 chacun = 7 |
| | **11 plans** | **≈ 15 générations** |

### Bible du couloir — bloc à coller dans CHAQUE prompt de couloir

Aucune reformulation : la moindre variation de vocabulaire change le décor.

```
A long modern corporate corridor, polished grey concrete floor, warm oak wall
panels on both sides, evenly spaced floor-to-ceiling frosted glass meeting room
doors on the left and on the right, cool white overhead strip lighting, a single
large dark screen mounted on the far wall at the very end of the corridor.
Steady forward dolly at slow walking pace, camera at chest height, centered.
```

### Suffixe de style — à coller à la fin de TOUS les prompts

```
cinematic, 35mm, shallow depth of field, soft volumetric light, muted teal and
amber color grade, 16:9, no text, no logos, no readable on-screen UI, natural
film grain
```

### Prompts

| Clip | Rôle | Prompt (+ bible si couloir, + suffixe de style) |
|------|------|------|
| **CO1** | Ouverture | *[bible]* `The corridor is empty and slightly too quiet. The camera begins moving forward. Cold light, closed doors, no one in sight. The shot ends as the camera passes close behind a structural pillar that briefly fills the frame.` |
| **LIA** | Liaison ×4 | *[bible]* `The camera moves forward, then pans smoothly right toward a glass door, through which a dimly lit room is partly visible. A silhouette crosses the frame from right to left near the end of the shot.` |
| **R1** | Salle 1 | `Interior of a meeting room. A whiteboard completely covered in hundreds of colored sticky notes. Two people photograph it with their phones, shoulders slumped, then walk away leaving the wall untouched. Late afternoon light, an air of effort about to be wasted. Slow push-in on the wall of notes.` |
| **R2** | Salle 2 | `Interior of a planning room. A large brown kraft paper wall covered in hundreds of sticky notes, with red strings stretched between them forming a tangled web of dependencies. In the foreground, back turned to the wall, a person manually retypes all of it into a dense spreadsheet on a laptop, hunched and tired. A single sticky note peels off the wall and falls silently behind them. They do not notice. Slow push-in from the wall toward the laptop screen.` |
| **R3** | Salle 3 | `A person alone at a desk, glancing over their shoulder before typing a personal credit card number into a signup form on a laptop. Furtive body language, the room around them dim and deserted. Tight framing, slight handheld feel.` |
| **R4** | Salle 4 | `A person finishes writing on a single sheet of paper with real excitement, drops it into an overflowing inbox tray on an empty desk, and walks away. The tray sits untouched as the light in the room slowly fades out.` |
| **CO6** | La salle du bout, morte | *[bible]* `The camera reaches the end of the corridor and glides into the final room through an open glass wall, then settles into a locked wide shot and stops moving completely. The room is drained of color, grey and lifeless: blinds half closed, a dead potted plant in the corner, empty chairs pushed askew, dust floating in the stale air. A single large screen on the far wall flickers once and lights up, its warm glow the only color in the frame. The camera holds perfectly still until the end of the shot.` |
| **DIVE** | Plongée | `Extreme push-in into a glowing computer screen, the frame dissolving into flowing particles of light that reorganize into a clean luminous grid, ending on a bright calm surface. Fast, then decelerating.` |
| **REBIRTH** | **La renaissance** | **Image de départ obligatoire : la dernière image de `CO6`.** `Hold the exact same camera position as the given frame, locked off, absolutely no camera movement, no zoom, no drift. Color slowly floods back into the room: the blinds rise and daylight pours in, the dead potted plant turns green and full, the scattered chairs straighten, warm light spreads across the walls and floor. People walk in, sit down, start talking and pointing at the screen together. The room comes alive. Smooth and continuous, joyful but calm.` |
| **CO7** | Le retour | *[bible, mais :]* `The camera now travels in the opposite direction, moving away from the final room and back down the corridor, facing forward. The corridor is warmly lit by daylight, every glass door wide open. It glides past four rooms in this order: on the RIGHT, an empty inbox tray beside a bright dashboard on a wall screen; on the LEFT, a person slipping a credit card back into their wallet and smiling at a shared screen; on the RIGHT, a bare kraft paper wall with red strings neatly coiled on a table and a relaxed group in front of one big timeline display; on the LEFT, a whiteboard wall of sticky notes now mirrored on a large shared screen with no one photographing it. People move easily between rooms. Keep the center of the frame clear and uncluttered throughout. The shot ends with a smooth crane-up revealing the whole floor as one connected open space full of warm light.` |
| **LOGO** | Signature | `A single luminous node at the center of a dark frame, thin light threads radiating outward and connecting into a calm stable network, slow breathing pulse, ending on perfect stillness.` |

> **Ne jamais demander de texte lisible à Veo.** Titres, chiffres et interfaces
> viennent des overlays CapCut ou de la capture d'écran réelle.
>
> **Générer plus long que l'utile** : on coupe au montage, jamais au ras.
>
> `CO7` est le plan le plus chargé du film (quatre résolutions en un mouvement).
> S'il ne sort pas en 2 essais, plan B en §7.

---

## 6. Continuité du couloir

Veo ne tient pas la géométrie ni la lumière d'un clip à l'autre. Trois règles :

1. **La bible, copiée mot pour mot** dans chaque prompt de couloir.
2. **Couper sur une occlusion.** Pilier, encadrement de porte, silhouette qui
   traverse : l'œil ne peut pas comparer les deux décors, donc il les accepte.
   C'est la technique du faux plan-séquence.
3. **Les salles sont des plans intérieurs autonomes.** Le plan `LIA` se termine
   sur un début de panoramique vers la porte ; on coupe sur l'intérieur comme si
   c'était la continuation du regard. Raccord dans l'axe du regard — ça se lit
   comme continu et ça découple totalement les salles du problème de continuité.

> Si ta version de Veo accepte une **image de départ** : extraire la dernière
> image de `CO1` et la donner comme première image de `LIA`, puis de `LIA` vers
> `CO6`. Ça verrouille la cohérence des plans de couloir. Pas indispensable si les
> trois règles sont tenues.

---

## 7. Les deux transitions clés

### Entrée dans l'écran (0:57 → 1:08)

Le plan le plus important du film. Trois temps :

1. **0:57–1:02** — `CO6` : la caméra fonce vers l'écran, qui s'allume.
2. **1:02–1:05** — Incruster la capture du **hub Pivot** dans la zone du moniteur
   (masque rectangulaire + corner-pin pour suivre la perspective). L'app apparaît
   en fondu *dans* l'écran : le picture-in-picture au sens littéral.
3. **1:05–1:08** — Keyframes d'échelle sur la capture : de la taille du moniteur à
   plein cadre en 0,8 s, léger flou de mouvement, flash blanc de 2 images au
   moment où elle remplit le cadre. `DIVE` en surimpression à 40 % pendant la
   montée.

**Son :** la rumeur du couloir s'estompe → whoosh grave → **un demi-temps de
silence total** avant que la VO reprenne sur « Pivot ». Ce silence vaut trois
effets visuels.

### Sortie de l'écran et renaissance (2:10 → 2:24)

La sortie est la **stricte réciproque** de l'entrée : même salle, même cadre,
même axe. Quatre temps, et le troisième est celui qui fait tout :

1. **2:10–2:14** — La capture se réduit de plein cadre vers le moniteur (0,8 s),
   mêmes keyframes qu'à l'entrée, inversées.
2. **2:14** — On retrouve **la dernière image de `CO6`** : la salle grise, morte,
   stores baissés, plante crevée. Identique au pixel près.
3. **2:14–2:15** — **Tenir cette image grise une seconde pleine.** C'est le temps
   qu'il faut au spectateur pour reconnaître la salle du début. Sans cette
   seconde, la transformation n'a rien à quoi se comparer et l'effet tombe à
   plat. C'est la note la plus importante de la section.
4. **2:15–2:24** — `REBIRTH` : la couleur envahit le plan, les stores se lèvent,
   la plante reverdit, les gens entrent. Caméra rigoureusement fixe.

**Pourquoi l'image de départ est obligatoire** — `REBIRTH` doit être généré en
image-to-video à partir de la dernière image de `CO6`. Une régénération libre ne
retomberait jamais sur le même cadre, et un décalage de quelques pixels se voit
immédiatement sur un plan fixe. C'est la seule contrainte technique non
négociable du film.

**Son :** le fondu vers le thème lumineux démarre à **2:08**, avant la transition
visuelle — l'audio annonce la résolution. Puis **silence total sur la seconde
grise**, et la musique s'ouvre au moment exact où la couleur revient.

### Plan B si `CO7` ne sort pas

Remplacer le plan unique par **4 inserts de 3 s** montés cut, un par salle
résolue, en reprenant les cadrages de `R1`–`R4` : même angle, situation résolue.
Le rappel visuel est encore plus lisible, et les gains périphériques deviennent
même plus faciles à poser (un insert fixe par cartouche). Coût : 4 générations
supplémentaires, soit **15 plans**. C'est le seul endroit du film où j'accepterais
de remonter le compteur.

---

## 8. Montrer les gains dans l'acte III

L'acte III est court (28 s) : il ne raconte pas, **il montre**. Trois leviers.

**La renaissance** (`REBIRTH`, C1) — le plan fixe où la couleur revient. Aucun
texte dessus, jamais. C'est le seul moment purement émotionnel du film, et un
chiffre posé là le tuerait.

**Le rappel visuel** (`CO7`, C2) — les quatre salles rejouées dans leur état
résolu. Aucun commentaire nécessaire : le spectateur a vu la douleur 90 secondes
plus tôt, il la reconnaît.

**Les gains en vision périphérique** (C2) — les chiffres ne sont pas posés au
centre : chacun est **accroché à sa salle**, du côté où elle défile, à hauteur de
porte. Ils entrent avec le mouvement du travelling, ralentissent, tiennent, puis
s'effacent sur place.

| TC | Côté | Overlay | Salle |
|----|------|---------|-------|
| 2:25,5 | **Droite** | `100 % des idées tracées` | 4 |
| 2:27,5 | **Gauche** | `0 shadow IT` | 3 |
| 2:29,5 | **Droite** | `1 source de vérité` | 2 |
| 2:31,5 | **Gauche** | `0 ressaisie` | 1 |
| 2:33,5 | **Centre** | `~330 000 €/an réinvestis` *(estimation, 500 pers.)* | — |

**Animation de chaque cartouche périphérique** — 3 keyframes, ~2,5 s de vie :

1. Entre par le bord, à la vitesse du travelling *(0,3 s)*
2. **Décélère et tient, immobile** *(1,5 s)* ← sans ce palier, c'est illisible
3. Fondu **sur place**, sans sortir du cadre *(0,7 s)*

> **Ne jamais les laisser sortir du cadre avec le travelling.** Un texte qui
> défile en continu à la vitesse d'un plan en mouvement ne se lit pas. Le palier
> immobile est ce qui rend le procédé lisible — c'est le seul point sur lequel
> ne pas transiger.

Le cartouche central arrive sur l'élévation finale et **reste à l'écran jusqu'à
2:39**, le temps que la voix off dise le chiffre. C'est le seul moment du film où
un chiffre est dit et montré simultanément — il porte la mention « estimation »
en petit (§10). Les quatre périphériques : 3 mots maximum, gros, à ≥ 100 px du
bord.

---

## 9. Production

### La démo — dispositif (1:08 → 2:14)

**Capture d'écran plein cadre, 1920×1080. Rien d'autre.** Pas de vignette, pas de
plan généré, pas d'incrustation : une fois dans l'écran, on y est vraiment. Le
picture-in-picture, c'est la plongée elle-même (§7) — l'app apparaît *dans* le
moniteur puis prend tout le cadre. Le seul habillage pendant la démo, ce sont les
overlays texte de la piste 6.

### Règles de capture

- Profil navigateur neuf : **pas de favoris, pas d'extensions, pas de
  notifications**. Zoom **110 %** — lisible après compression.
- **Peupler la donnée avant de tourner** : noms d'équipe crédibles, board déjà
  riche, roadmap à 8–10 initiatives, fiches d'innovation déjà votées. Un écran
  vide annule tout le bénéfice du récit.
- Enregistrer chaque beat **séparément et lentement**, puis accélérer ×1,25–1,5.
  Une souris rapide est illisible ; un mouvement lent accéléré est fluide.
- Mise en évidence du curseur et des clics activée.
- Pour B2 : deux fenêtres côte à côte, ou deux enregistrements synchronisés.
  **Le plan qui impressionne le jury.** Ne pas le bâcler.
- Zoomer en post (échelle 100 % → 130 %) sur l'élément dont parle la voix off,
  au lieu de tout montrer en plan large.

### Voix off — ElevenLabs

> ⚠️ **Les « / » du §4 sont des marques de lecture, pas du texte.** Collés tels
> quels dans ElevenLabs, ils cassent la prosodie ou se font lire. Utiliser les
> blocs prêts à coller de l'**annexe §11**, où ils sont convertis en sauts de
> ligne.

**Modèle** — *Eleven Multilingual v2*. On rend une narration, pas du direct : la
qualité prime sur la latence, donc pas de Turbo / Flash. Si tu as accès à *v3*,
ses balises d'intention permettent de creuser l'écart de ton entre les actes ;
sinon le levier ci-dessous suffit.

**Réglages** — c'est la **stabilité** qui décide de tout ici :

| Paramètre | Valeur | Pourquoi |
|---|---|---|
| Stability | **55–60 %** | 17 rendus séparés doivent sonner comme une seule prise. En dessous de 40 %, la voix dérive d'un beat à l'autre et ça s'entend au montage. |
| Similarity | 75 % | Fidélité à la voix choisie. |
| Style | **0–15 %** | Au-delà, l'instabilité remonte et annule le réglage précédent. |
| Speaker boost | Activé | |
| Export | **WAV**, pas MP3 128 | On va encore compresser au montage. |

**Écart de ton entre les actes** — ElevenLabs n'a pas de direction d'acteur.
Le seul levier fiable : rendre l'**acte I à 60 % de stabilité** (plus posé, plus
plat, plus froid) et l'**acte III à 45 %** (plus de relief, plus ouvert). Écart
volontairement faible — deux voix différentes s'entendraient.

**Continuité entre les beats** — générer beat par beat casse la prosodie : chaque
rendu repart de zéro. Deux façons de l'éviter :

- **Studio / Projects** : coller le script entier, ElevenLabs tient la continuité
  sur toute la longueur, puis exporter section par section.
- **Via l'API** : renseigner `previous_text` et `next_text` (ou chaîner les
  `previous_request_ids`) pour que chaque beat connaisse son contexte.

Sans ça, A1 et A2 sonneront comme deux enregistrements collés.

**Prononciation à vérifier au premier essai** — les blocs du §11 intègrent déjà
les corrections :

| Dans le texte | Risque | Correction |
|---|---|---|
| SSO | lu « sso » | écrire `S.S.O.` |
| PI (sprint ou PI) | lu « pi », la lettre grecque | écrire `P.I.` |
| program board · roster | bascule d'accent anglais en plein français | à écouter ; garder si propre, sinon « tableau de programme » et « effectif » |
| Gantt · Pivot | — | OK en l'état |

### Choisir la voix — protocole en 3 manches

Revenir en arrière après coup coûte les 17 rendus. Onze rendus de test valent
largement la précaution.

**Ce qu'on cherche** — le film demande une voix qui tienne **les deux bouts** :
froide et retenue sur l'acte I, ouverte et humaine sur la renaissance. Une voix
qui ne fait qu'un des deux est éliminée, aussi belle soit-elle.

| Critère | Cible | À fuir |
|---|---|---|
| Registre | Médium, médium-grave | Les voix « bande-annonce » très graves : sur un sujet d'organisation, ça vire au ridicule |
| Âge perçu | 35–50 ans | Trop jeune : perd l'autorité sur les sujets budget et organisation |
| Accent | **Français natif** | Une voix anglophone passée en Multilingual v2 — l'accent s'entend, un jury français le relève |
| Intention | Documentaire, narratif | **Le ton pub.** C'est le mode d'échec le plus fréquent : beaucoup de voix poussent en permanence et ne savent pas se taire |

**Manche 1 — le froid** (5–6 candidates × `A1`)
La ligne « Et qui n'y arrive pas. » doit descendre naturellement, pas sonner
comme une nouvelle phrase. Et la pause après « Des portes fermées. » doit
paraître voulue, pas subie. → garder 3.

**Manche 2 — le chaud** (3 × `C1b`)
« La même salle. Les mêmes gens. » doit contenir de la **reconnaissance**, pas
juste de la lecture. C'est le plan le plus fragile du film : si la voix ne
l'habite pas, la renaissance ne fonctionne pas. → garder 2.

**Manche 3 — le jargon** (2 × `B3`)
Le bloc le plus dense et le seul qui accumule les pièges : `roster`,
`program board`, `P.I.`, `Gantt`. On vérifie qu'il n'y a pas de bascule
d'accent anglais en plein français (§ prononciation ci-dessus). → décision.

**Deux pièges de jugement**

- **Écouter sur le bon matériel.** Trancher au casque puis diffuser sur les
  enceintes d'une salle de réunion réserve des surprises. Juger sur ce que le
  jury utilisera.
- **Comparer dans la même session, jamais à un jour d'intervalle.** L'oreille ne
  garde pas la référence. Et si le lit musical est déjà choisi, faire la manche 3
  **avec la musique** : une voix superbe en solo peut disparaître dessous.

### Rôle de Gemini

| Usage | Comment |
|-------|---------|
| Relecture du texte | Traquer les liaisons difficiles et les chiffres ambigus avant de passer au TTS. |
| Visuels fixes | Logo, carton de fin, miniature. |

**Sous-titres** : ne pas les générer à part. Une fois la VO posée sur la timeline,
utiliser les **sous-titres automatiques de CapCut** sur la piste voix — ils sont
déjà calés, et il n'y a que ~400 mots à relire. Beaucoup de jurys regardent sans
le son.

### Plan de pistes CapCut

```
Piste 5   Overlays texte (titres, gains périphériques)
Piste 4   Captures d'écran app (1:02 → 2:14, keyframes aux transitions)
Piste 3   Plans Veo — salles (R1 → R4)
Piste 2   Plans Veo — couloir (CO1, LIA ×4, CO6, DIVE, REBIRTH, CO7, LOGO)
Piste 1   Musique (3 mouvements, ducking −18 dB sous la voix)
Audio A   Voix off (A1 → C4)
Audio B   Sound design (portes, rumeur, whoosh, silence)
```

### Points d'attention montage

- **Poser d'abord la voix off**, puis caler l'image dessus.
- Couper **pile sur l'occlusion** dans les plans de couloir — une image trop tôt
  ou trop tard et le raccord se voit.
- Les 4 usages de `LIA` : retourner horizontalement les passages 2 et 4, varier la
  vitesse (×0,9 / ×1,0 / ×1,1 / ×0,95) et le recadrage. Sinon la répétition se voit.
- Cut franc dans la démo, fondus courts (0,3 s) entre plans Veo. Aucune transition
  fantaisie.
- Overlays : 3 s minimum, jamais plus de 6 mots, à ≥ 100 px des bords.
- Étalonnage : acte I désaturé et froid, acte III chaud et ouvert. Un LUT par acte
  suffit à rendre la bascule lisible même sans le son.
- VO à −16 LUFS, musique à −30 LUFS sous la voix.
- Export 1080p, 30 fps, bitrate ≥ 12 Mbps.

### Ordre de production

**Trois postes de nature différente** — les confondre fait perdre des jours :

| Poste | Nature | Coût réel |
|---|---|---|
| **Veo** | Asynchrone — ça cuit sans toi, avec des rebuts et des relances | Long en horloge, court en attention |
| **VO** | Synchrone — 40 min de ton attention, relançable à l'infini | Le poste le **moins** risqué |
| **Capture démo** | Synchrone — 66 s à tourner, entièrement ton temps | Le plus long en attention |

**Donc : lancer Veo en premier, et faire le reste pendant que ça tourne.**

1. **Lancer les générations Veo**, dans cet ordre de dépendance imposé :
   `CO1` → `LIA` → **`CO6`** (valider la continuité du couloir avant d'aller plus
   loin) → extraire la dernière image de `CO6` → **`REBIRTH`** à partir de cette
   image → `CO7` → salles `R1`–`R4` → `DIVE`, `LOGO`.
   `REBIRTH` **dépend** de `CO6` : ne pas le lancer avant d'avoir figé le plan de
   la salle morte, sinon tout est à refaire.
2. **Pendant que Veo tourne** : choisir la voix (protocole 3 manches ci-dessus,
   ~30 min), puis rendre les 17 blocs du §11 (~10 min).
3. **Capturer la démo** — peupler la donnée d'abord. 66 s des 165, et c'est le
   seul poste que personne ne peut faire à ta place.
4. **Monter** : VO d'abord sur la timeline, puis l'image dessus — couloir →
   salles → plongée → démo → renaissance → gains → son.
5. **Relire sans son**, puis avec son, puis sur téléphone.

> **La VO peut-elle attendre la fin ?** Techniquement oui : elle n'est une
> dépendance d'aucune génération Veo ni de la capture. Mais elle est la **colonne
> de temps du montage** — c'est elle qui fixe la longueur réelle de chaque beat,
> et l'image se taille dessus. La poser en dernier oblige à recouper tout ce qui
> a déjà été monté. Comme elle ne coûte que 40 minutes et ~2 400 caractères,
> l'économiser n'économise rien : la faire pendant que Veo cuit est gratuit.

---

## 10. Réserves à lever avant diffusion

- **Chiffre ROI — à sécuriser avant diffusion.** Le cartouche
  « ~330 000 €/an » est une **extrapolation à 500 personnes**, pas un chiffre du
  deck : `docs/pitch-innovation.md` ne va que jusqu'à 300 personnes. Dérivation
  retenue :

  | | 15 pers. *(deck)* | 300 pers. *(deck)* | **500 pers. *(extrapolé)*** |
  |---|---|---|---|
  | SaaS (licences + conformité) | 10 400 € | 200 000 € | **~333 000 €** |
  | soit par personne | 693 € | 667 € | ~667 € |
  | Infra Pivot | 360 € | 2 400 € | **~4 000 €** |
  | **Économie annuelle** | 10 040 € | 197 600 € | **~330 000 €** |

  L'infra est extrapolée en **sous-linéaire** (×20 de personnes entre 15 et 300
  pour seulement ×6,7 de coût), d'où ~4 000 € et non ~6 700 €. C'est l'hypothèse
  la plus attaquable du calcul : si le jury la conteste, l'économie reste
  ~327 000 €, donc l'ordre de grandeur tient.

  **Mention « estimation » obligatoire à l'écran.** Et avoir cette table en tête
  pour la session de questions : un chiffre non sourcé challengé par un jury
  coûte plus cher qu'il ne rapporte — à 330 000 €, il sera challengé.
- **`docs/pitch-innovation.md` est daté** : 8 modules et v0.22 annoncés, alors que
  le produit est à 19 modules et v0.33.0. À mettre à jour si les slides
  accompagnent la vidéo.
- **Données à l'écran** : vérifier qu'aucune capture ne laisse passer de vrais
  noms, emails ou contenus internes.
- **Visages générés** : les salles et `REBIRTH` contiennent des personnages Veo.
  S'ils ressemblent à des collaborateurs réels, régénérer — un jury interne le
  remarque.

---

## 11. Annexe — texte prêt à coller dans ElevenLabs

Blocs nettoyés : plus de « / », sauts de ligne à la place, acronymes corrigés
(§9). **Un rendu par bloc**, nommé d'après son identifiant.

**ACTE I — stabilité 60 %**

```
[A1]
Chaque entreprise a ce couloir.
Des portes fermées. Derrière chacune, une équipe qui essaie de travailler avec les autres.
Et qui n'y arrive pas.

[A2]
À droite, l'atelier. Deux heures de post-its, des idées partout.
Demain, tout sera recopié à la main dans un autre outil. Ou perdu.
Le plus souvent : perdu.

[A3]
À gauche, le pilotage. Un mur de ficelles — et quelqu'un qui le recopie à la main dans un tableur.
La capacité, la roadmap, les dépendances : un seul fichier.
Déjà trois versions.

[A4]
Ici, personne n'a attendu. Un outil gratuit, une carte bleue perso, un compte en deux minutes.
Le shadow IT ne se cache pas.
Il comble un vide.

[A5]
Et là, une idée. Une vraie.
Elle finit dans une bannette, puis dans le silence.
Personne ne saura jamais qu'elle a existé.

[A6]
Au bout du couloir, il y a un écran.
Et devant cet écran, quelqu'un a arrêté de subir.
```

**ACTE II — stabilité 55 %**

```
[B0]
Pivot.
Une seule suite. Dix-neuf modules. Un seul graphe de données.

[B1]
Tout est là. Un hub, une identité, vos équipes.
Le S.S.O. de l'entreprise, pas une carte bleue.
Et le serveur, c'est le vôtre.

[B2]
L'atelier de tout à l'heure — il vit ici. Cartes, cadres, groupes, connexions, votes.
Deux curseurs, deux navigateurs, la même session en temps réel.
Les participants arrivent par un lien, sans créer de compte.
Rien à photographier. Rien à recopier demain matin.

[B3]
Le mur d'à côté ? Le voilà — mais vivant, partagé, à jour.
La capacité d'équipe : roster, disponibilités, sprint ou P.I.
La roadmap : jalons, responsables, dépendances, en Gantt.
Et le program board, où les fils rouges sont devenus des liens qu'on ne recolle plus.
Une source. Pas trois versions.

[B4]
Et l'idée de la bannette ? Elle devient une fiche. Des votes, des commentaires, des pièces jointes.
Un challenge, un jury, une notation multi-critères.
Elle est vue, elle est suivie, elle est décidée.
Dix-neuf modules, un seul graphe.
```

**ACTE III — stabilité 45 %**

```
[C1a]
Il n'y a plus de vide.

[C1b]
La même salle. Les mêmes gens.
Tout ce qui manquait, c'était un endroit où se retrouver.

[C2a]
Les portes sont ouvertes.
L'idée de la bannette est sur le tableau de bord. Le mur a gardé ses dépendances.
Et l'atelier, toutes ses idées.

[C2b]
Et trois cent trente mille euros par an qui redeviennent du budget.

[C3]
Une équipe. Un espace. Vos données chez vous.
Pivot. Zéro dépendance.
```

> **C1 est volontairement coupé en deux rendus.** Le silence de 4 secondes entre
> `C1a` et `C1b` se fabrique au montage, pas dans le TTS : ElevenLabs comblerait
> ou raccourcirait la pause. C'est le silence le plus important du film (§7).

**Total : 17 rendus** (A1–A6, B0–B4, C1a, C1b, C2a, C2b, C3), ~400 mots.
