# Budgets de performance (Lighthouse)

Tests de performance frontend basés sur **Lighthouse CI** (#14). Mesure les pages
publiques critiques contre des budgets explicites de métriques et de poids.

## Pages couvertes
| Page | URL | Pourquoi |
|------|-----|----------|
| Landing | `/` | première impression, page la plus visitée |
| Connexion | `/login` | porte d'entrée de tout utilisateur |
| Inscription | `/register` | acquisition |

Pages authentifiées (dashboard, board, modules) : à ajouter une fois l'auth
Lighthouse scriptée (puppeteer login) — suivi à part.

## Budgets (`lighthouse-budgets.json`)
| Métrique | Budget |
|----------|--------|
| First Contentful Paint | ≤ 2000 ms |
| Largest Contentful Paint | ≤ 2500 ms |
| Time to Interactive | ≤ 3500 ms |
| Total Blocking Time | ≤ 300 ms |
| Cumulative Layout Shift | ≤ 0.1 |
| Poids JS | ≤ 450 Ko |
| Poids total | ≤ 1700 Ko |

Scores de catégorie (`lighthouserc.json`) : Performance ≥ 0,8 (warn),
Accessibilité ≥ 0,9 (**error**), Best practices ≥ 0,9 (warn).

> Les seuils temporels sont en **warn** (la perf varie sur les runners CI) ;
> l'accessibilité est bloquante. Resserrer les budgets quand une baseline stable
> est établie sur plusieurs runs.

## Exécution
**CI** : workflow `Performance (Lighthouse)` (`.github/workflows/perf.yml`),
non bloquant — lancé à la demande (`workflow_dispatch`) ou chaque lundi. Les
rapports HTML sont publiés en artefact (`lighthouse-reports`, 7 jours).

**Local** :
```bash
cd apps/web && npm run build && cd ../..
npx @lhci/cli@0.14.x autorun
# rapports dans ./lhci-reports
```

## Pourquoi non bloquant sur les PR
La mesure Lighthouse est sensible au bruit des runners partagés : la gater sur
chaque PR produirait des faux positifs. On suit la **tendance** (hebdo +
à la demande) et on traite les régressions de budget comme des tâches, pas comme
des blocages de merge. À promouvoir en gate sur `develop` quand la variance est
maîtrisée.
