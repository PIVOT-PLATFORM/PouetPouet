# Recette — Lot C (11 PRs)

> **Procédure :** checkout de chaque branche, `npm run dev`, tester chaque cas, cocher, puis merger dans l'ordre indiqué à la fin.


## PR #146 — MeetOps améliorations calendrier/modèles
**Branche :** `feat/meetops-improvements`  
**Issue :** #132

### Cas à tester
- [ ] **Recherche modèles** : `/meetops/templates` → barre de recherche → filtrage par nom/description/type en temps réel
- [ ] **Recherche calendrier** : vue calendrier → icône loupe → input se déploie → saisir un terme → meetings filtrés par titre/événement
- [ ] **Grille horaire vue jour** : basculer en vue Jour → axe horaire 7h–21h visible, meetings positionnés à la bonne heure
- [ ] **Grille horaire vue semaine** : vue Semaine → même vérification, hauteur proportionnelle à la durée
- [ ] **Navigation prev/next** : ouvrir le détail d'un événement (parmi ≥ 2) → flèches ← → visibles → navigation entre événements OK
- [ ] **Vider un calendrier** : détail d'un événement → bouton « Vider » → confirmation → toutes les réunions supprimées, liste vide
- [ ] **Vider irréversible** : annuler la confirmation → rien ne change

---

## Ordre de merge recommandé

> Merger dans cet ordre pour respecter la timeline des migrations Prisma.

| Ordre | PR | Branche | Issue |
|-------|----|---------|-------|
| 1 | #139 | `feat/team-sharing` | #134 |
| 2 | #140 | `feat/share-to-team` | #131 |
| 3 | #141 | `feat/scrum-kick-participants` | #129/#120 |
| 4 | #142 | `feat/hub-pro-icons` | #124 |
| 5 | #143 | `feat/scrum-excel-import` | #130 |
| 6 | #144 | `feat/daily-stats` | #128 |
| 7 | #145 | `feat/activity-management` | #127 |
| 8 | #146 | `feat/meetops-improvements` | #132 |
| 9 | **#147** | `feat/testbooks-module` | #133 |
| 10 | #148 | `feat/board-cover-upload` | #125 |
| 11 | **#149** | `feat/card-og-preview` | #126 |

> #147 doit être mergée **avant** #149 (migration `testbooks` doit être présente dans la DB avant la migration `card_og_meta`).

---

## Checklist release post-merge

- [ ] Bumper `version` dans `package.json` (racine) + `apps/api/package.json` + `apps/web/package.json`
- [ ] Ajouter les entrées de patch notes dans `apps/api/src/lib/patch-notes.ts`
- [ ] Commit sur `develop` → merge `develop → master` → push `master`
