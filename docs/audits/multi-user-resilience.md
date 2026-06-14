# Audit — résilience multi-utilisateur (temps réel)

> Date : 2026-06-14 · Périmètre : comportement des modules temps réel face aux
> déconnexions, reconnexions, arrivées tardives et accès concurrents.
> Méthode : revue des handlers Socket.io + cartographie de la couverture E2E.

## Synthèse

Le socle est globalement **robuste** sur les cas limites nommés. Un correctif de
scalabilité a été apporté lors de cet audit (comptage des participants de session,
voir §2). Le reste tient déjà ; la couverture E2E est listée en §4.

---

## 1. Garanties par module

### Sessions live (`apps/api/src/sockets/session.ts`)
- **Auth optionnelle** : un participant anonyme rejoint sans compte ; chaque handler
  vérifie lui-même `socket.data` (le middleware ne rejette jamais).
- **Reconnexion** : après refresh, le client se re-identifie via `session:rejoin`
  (`participantId` en `sessionStorage` `klx_p_<code>`) sans re-saisir son prénom.
  La race React StrictMode est neutralisée par le pattern *ref + emit dans
  `socket.on('connect')`* (`useParticipantSession.ts`).
- **Déconnexion** : un participant qui part met à jour le compteur diffusé ; la
  déconnexion de l'**animateur** est ignorée (la session continue).

### Scrum Poker (`apps/api/src/modules/scrum/scrum.sockets.ts`)
- **Registre des participants** en hash Redis (`scrum:participants:<roomId>`) avec
  repli sur une `Map` mémoire en l'absence de Redis (dev) → correct en multi-instance.
- **Déconnexion** : `removeParticipant(socket.id)` retire le votant et rediffuse l'état.
- **Reconnexion pendant un vote** : auto-rejoin via `sessionStorage` `klx_scrum_<code>`
  (race StrictMode gérée dans `useScrumParticipant.ts`).

### Daily (`apps/api/src/modules/daily/daily.sockets.ts`)
- **Piloté par le propriétaire** : tous les events sont gated `isOwner` (pas de
  participants clients ; les « participants » sont des entrées de liste).
- **Arrivée tardive** (2ᵉ onglet/écran de l'hôte) : `daily:host_join` rediffuse
  l'état courant (`broadcastState`) → l'onglet tardif est synchronisé immédiatement.
- **Course double-`next`** (double-clic / deux onglets) neutralisée par un
  `updateMany` conditionnel sur `status: 'SPEAKING'` : le 2ᵉ appel voit 0 ligne
  modifiée et s'arrête au lieu de sauter un orateur.

### Boards (`apps/api/src/modules/pouetpouet/board.sockets.ts`)
- **Présence** en hash Redis (`board:presence:<boardId>`, TTL 1 h) → cross-instance,
  plus de boucle O(n) sur les sockets.
- **Verrou doux d'édition** : libéré au blur, au leave **et** au disconnect
  (purement éphémère, aucune persistance).
- **Curseurs** coalescés côté serveur ; **rôles** appliqués (reset/sessions/votes/export).

---

## 2. Correctif apporté — comptage des participants de session

**Avant :** `getParticipantCount()` lisait `io.sockets.adapter.rooms` + `io.sockets.sockets`,
qui ne voient que les sockets de **l'instance locale**. En single-instance (prod
actuelle) c'est exact, mais dès `--max-instances > 1` le compteur aurait **sous-évalué**
le nombre de participants (chaque instance ne compte que les siens).

**Après :** comptage via `io.in(room).fetchSockets()`, résolu par l'adapter Redis
donc correct quel que soit le nombre d'instances. Comportement single-instance
inchangé. Aligné avec la présence boards et le registre Scrum (déjà sur Redis).

---

## 3. Risques résiduels / recommandations

- **Charge > ~5 utilisateurs simultanés** : non testée automatiquement. À couvrir par
  le load test k6/Artillery (cf. ROADMAP P2 « Performance & charge restantes »).
- **Avant d'activer `--max-instances > 1`** : valider en conditions multi-instance
  (l'adapter Redis + le correctif §2 le permettent) et provisionner `REDIS_HOST` en prod.
- **Déconnexion *dure* d'un votant Scrum** (fermeture d'onglet, sans rejoin) : retirée
  côté serveur, mais pas encore couverte par un test E2E dédié (cf. §4).

---

## 4. Couverture E2E (`apps/web/e2e/`)

| Cas | Spec |
|-----|------|
| Refresh participant Scrum pendant un vote → auto-rejoin | `reconnect.spec.ts` |
| Refresh participant session live → auto-rejoin | `reconnect.spec.ts` |
| Création de carte distante ne vole pas le focus (multi-onglets) | `collab.spec.ts` |
| Reset board propagé + Ctrl+Z restaure | `collab.spec.ts` |
| Vote Scrum d'un participant anonyme | `scrum.spec.ts` |
| Parcours Daily / Roue / session / capacité / hub / SSO | specs dédiées |
| Accessibilité (axe-core) | `a11y.spec.ts` |

Ces specs tournent désormais en CI (job `e2e`).

**Ajouts E2E recommandés (non bloquants) :** déconnexion dure d'un votant Scrum
(disparition côté hôte) ; synchro d'un 2ᵉ onglet hôte Daily pendant un timer actif.
