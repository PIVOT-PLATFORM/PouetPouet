# Cahier de test — Correctif "Sessions : impossible de rejoindre"

Branche : `fix/sessions-join` · Commit : `775265b`

## Contexte du correctif

Le middleware socket.io (`apps/api/src/index.ts`) **refusait toute connexion sans JWT
valide**. Conséquences avant le fix :

- Un participant **anonyme** (sans compte) ne pouvait jamais ouvrir la socket → le bouton
  « Rejoindre » ne faisait **rien** (bug rapporté).
- Même problème silencieux pour **Scrum Poker** (`/scrum/join/[code]`) qui utilise la même socket.
- Un token **expiré** (durée 30 min) bloquait aussi un membre connecté.

Le fix rend l'authentification **optionnelle** : token valide → `socket.data.userId`
positionné ; token absent/expiré → connexion anonyme acceptée. Les handlers privilégiés
(`host_join`, `member_join`, `activity:launch/close`, `session:close`) continuent de vérifier
`userId`/`isHost` eux-mêmes.

> ⚠️ **Le middleware est partagé par TOUS les flux temps réel.** Ce cahier teste donc à la
> fois les flux réparés ET la non-régression de la collaboration, des votes, du daily, de la
> roue, de la présence et des notifications.

---

## Pré-requis & matériel de test

| Rôle | Comment l'obtenir |
|------|-------------------|
| **A — Animateur / Owner** | Compte connecté, propriétaire du board (navigateur 1) |
| **P — Participant anonyme** | Aucun compte, navigation privée ou autre navigateur/mobile (navigateur 2) |
| **M — Membre connecté** | 2ᵉ compte connecté, invité sur le board (éditeur OU lecteur) (navigateur 3) |

- Ouvrir la **console développeur** côté participant pour vérifier l'absence d'erreur
  `connect_error` / `WebSocket` / CORS.
- Tester au moins une fois **sur mobile** (les participants scannent souvent un QR / lien).
- Repère succès global : le compteur de participants se met à jour **en direct** des deux côtés.

Légende résultat : ✅ OK · ❌ KO · ⏭️ N/A

---

## A. Session interactive — flux participant anonyme (cœur du fix)

| # | Scénario | Étapes | Résultat attendu | Statut |
|---|----------|--------|------------------|:---:|
| A1 | Démarrer une session | A : sur le board, clic **Session** | Un code à 6 caractères s'affiche (badge vert), compteur `0 👤` | |
| A2 | Rejoindre via le code | P : `/join` → saisir le code → **Rejoindre** | Redirige vers `/session/CODE`, écran « Comment vous appelez-vous ? » | |
| A3 | **Join anonyme (le bug)** | P : saisir un prénom → **Rejoindre →** | Bascule immédiate sur l'écran « Vous êtes connecté ! » ; **plus aucun blocage** | |
| A4 | Compteur live | Après A3 | A voit `1 👤` et le HostPanel liste le participant, sans recharger | |
| A5 | Multi-participants | Ouvrir 2-3 autres onglets privés, rejoindre | Compteur cohérent partout (`2`, `3`…) | |
| A6 | Lancer un sondage (POLL) | A : HostPanel → lancer une activité **Sondage** avec options | P voit le sondage apparaître **automatiquement** | |
| A7 | Répondre au sondage | P : clic sur une option | Écran « Réponse envoyée ✅ » ; A voit le décompte de réponses monter | |
| A8 | Double réponse interdite | P : tenter de revoter (rafraîchir puis recliquer) | Réponse non dupliquée côté résultats | |
| A9 | Quiz | A : lancer activité **Quiz** | Idem POLL, libellé « Quiz » côté P | |
| A10 | Brainstorm (texte) | A : lancer **Brainstorm** | P : champ texte (max 200), envoi → « Contribution envoyée » | |
| A11 | Nuage de mots | A : lancer **Nuage de mots** | P : champ mot (max 30), envoi OK | |
| A12 | Fermer l'activité | A : fermer l'activité en cours | P : revient à l'écran d'attente « L'animateur va bientôt lancer… » | |
| A13 | Enchaîner les activités | A : fermer puis relancer une autre activité | P suit sans recharger, état remis à zéro (hasResponded) | |
| A14 | Fermer la session | A : Clore la session | P : écran « Session terminée 🏁 » | |
| A15 | Rejoindre une session close | P : ouvrir `/session/CODE` d'une session fermée | Écran « Session introuvable » / message terminé (pas de spinner infini) | |
| A16 | Code invalide | P : `/session/ZZZZZZ` | « Session introuvable » proprement | |

## B. Session — reconnexion & cas limites participant

| # | Scénario | Étapes | Résultat attendu | Statut |
|---|----------|--------|------------------|:---:|
| B1 | Refresh participant | P (rejoint) : F5 | Auto-rejoin via `sessionStorage` (`klx_p_*`), reste connecté, ne redemande pas le prénom | |
| B2 | Activité active au rejoin | A lance une activité, **puis** P rafraîchit | P retrouve l'activité active immédiatement | |
| B3 | Perte réseau brève | P : couper/rétablir le Wi-Fi | Reconnexion auto ; sinon message « Connexion impossible. Réessayez… » (plus de silence) | |
| B4 | Fermeture pendant activité | A : fermer la session alors qu'une activité tourne | P : « Session terminée », `sessionStorage` nettoyé | |
| B5 | Prénom vide | P : laisser le champ vide → Rejoindre | Rejoint en tant que « Anonyme » | |

## C. Session — flux Owner & Membre connecté

| # | Scénario | Étapes | Résultat attendu | Statut |
|---|----------|--------|------------------|:---:|
| C1 | Owner ouvre le lien de sa session | A : ouvrir `/session/CODE` de son propre board | Écran « Vous êtes l'animateur » + bouton retour board (pas de double-comptage) | |
| C2 | Membre connecté rejoint | M (éditeur) sur le board pendant une session active | Badge session visible ; overlay d'activité s'affiche quand A lance | |
| C3 | Membre répond | M : répondre à une activité via l'overlay | Réponse comptée ; pas de doublon entre refreshes (`member_join` find-or-create) | |
| C4 | Membre lecteur | M (lecteur seul) | Peut rejoindre/répondre en tant que participant ; ne voit pas les contrôles d'édition | |

## D. Scrum Poker — participant anonyme (aussi réparé par le fix)

| # | Scénario | Étapes | Résultat attendu | Statut |
|---|----------|--------|------------------|:---:|
| D1 | Créer une salle | A : créer une salle Scrum, récupérer le code | Salle créée, code affiché | |
| D2 | **Join anonyme** | P : `/scrum/join/CODE` → prénom → Rejoindre | Entre dans la salle (bouton n'affiche plus « Connexion… » bloqué) | |
| D3 | Compteur participants | Après D2 | Compteur live à jour côté hôte et participant | |
| D4 | Voter un ticket | A : activer un ticket → P : choisir une carte | « Vote envoyé » ; hôte voit le nombre de votes monter | |
| D5 | Révélation | A : révéler | P voit toutes les cartes + sa propre carte surlignée | |
| D6 | Estimation finale | A : valider l'estimation | P : ticket « ✅ » avec valeur finale | |
| D7 | Changement d'échelle | A : changer l'échelle (Fibonacci/T-shirt/Temps) | P voit les bonnes valeurs proposées | |
| D8 | Refresh participant | P : F5 en pleine session | Auto-rejoin via `klx_scrum_*`, reste dans la salle | |
| D9 | Reconnexion réseau | P : couper/rétablir réseau | `scrum:join` ré-émis automatiquement (handler `reconnect`) | |
| D10 | Code invalide | P : code inexistant | Message d'erreur clair, pas de blocage sur « Connexion… » | |

## E. Non-régression — collaboration board (membres authentifiés)

> Vérifie que rendre l'auth optionnelle n'a **pas** cassé les connexions avec token.

| # | Scénario | Étapes | Résultat attendu | Statut |
|---|----------|--------|------------------|:---:|
| E1 | Édition temps réel | A + M (éditeur) sur le même board | Ajout/déplacement/suppression de cartes visibles en direct chez l'autre | |
| E2 | Présence | A + M ouverts | Avatars de présence (`PresenceIndicator`) corrects des deux côtés | |
| E3 | Frames / groupes / champs | Créer/modifier | Synchro live | |
| E4 | Timer | A : lancer un timer | M voit le timer ; overlay de fin pour tous | |
| E5 | Lock cartes | A : verrouiller une sélection | M ne peut pas déplacer les cartes verrouillées | |
| E6 | Undo/redo | A : Ctrl+Z / Ctrl+Y | Cohérent, pas d'erreur socket | |

## F. Non-régression — votes board

| # | Scénario | Étapes | Résultat attendu | Statut |
|---|----------|--------|------------------|:---:|
| F1 | Lancer un vote | A : menu Vote → Lancer (X votes/personne, timer) | Bandeau « Vote en cours » chez A et M | |
| F2 | Voter | M (votant éligible) : poser des gommettes | Décompte « restants » correct ; visible chez A | |
| F3 | Retirer un vote | M : retirer une gommette | Compteur réajusté | |
| F4 | Timer de vote | Laisser expirer | Overlay de fin + résultats accessibles | |
| F5 | Prolonger | A : +1m/+2m/+5m | Timer prolongé pour tous | |
| F6 | Résultats / dernier vote | A : ouvrir résultats puis « Dernier vote » | Données correctes | |

## G. Non-régression — Daily & Roue

| # | Scénario | Étapes | Résultat attendu | Statut |
|---|----------|--------|------------------|:---:|
| G1 | Daily standup | A : ouvrir/animer un daily | Synchro temps réel des tours/participants | |
| G2 | Roue | A : lancer la roue | Tirage synchronisé, animation correcte | |

## H. Non-régression — présence & notifications

| # | Scénario | Étapes | Résultat attendu | Statut |
|---|----------|--------|------------------|:---:|
| H1 | Cloche notifications | A : déclencher une activité génératrice de notif (invitation, etc.) | Notification reçue live (room `user:<id>`) | |
| H2 | Notes de version | Ouvrir la cloche | PATCH_NOTES s'affiche correctement | |

## I. Sécurité / contrôle d'accès (le fix ne doit PAS ouvrir de faille)

| # | Scénario | Étapes | Résultat attendu | Statut |
|---|----------|--------|------------------|:---:|
| I1 | Anonyme ne peut pas animer | P (sans token) : tenter `session:host_join` (DevTools console) sur une session | Reçoit `error: Accès refusé`, n'obtient pas `isHost` | |
| I2 | Anonyme ne peut pas lancer d'activité | P : émettre `activity:launch` | `error: Accès refusé` | |
| I3 | Anonyme ne peut pas fermer la session | P : émettre `session:close` | `error: Accès refusé` | |
| I4 | Membre non-owner ne peut pas animer | M (token valide, non-owner) : `session:host_join` | `error: Accès refusé` (vérif `ownerId`) | |
| I5 | `member_join` exige un compte | P (sans token) : `session:member_join` | `error: Non authentifié` | |
| I6 | Routes HTTP protégées | P : `POST /api/sessions` sans token | 401 (preHandler `authenticate`) | |
| I7 | Board privé | P : ouvrir `/boards/<id>` d'un board non partagé | « Accès refusé » (et non plantage) | |

## J. Cas limites token / réseau

| # | Scénario | Étapes | Résultat attendu | Statut |
|---|----------|--------|------------------|:---:|
| J1 | Token expiré (membre) | M : attendre > 30 min OU forcer un token expiré dans `localStorage` puis recharger un board | La socket se connecte quand même (anonyme) — pas de blocage total ; les actions nécessitant l'auth renvoient un message clair plutôt qu'un silence | |
| J2 | Token corrompu | Mettre une valeur bidon dans `localStorage.token` | Connexion anonyme, pas de crash serveur | |
| J3 | Deux sessions sur un même board | A : clore puis relancer une session | `/api/sessions/active` renvoie la bonne session ; les anciens participants voient « terminée » | |

---

## Critères de validation avant merge sur `develop`

- [ ] **A3** et **D2** passent (les deux bugs anonymes corrigés).
- [ ] Aucune régression sur **E / F / G / H** (flux authentifiés).
- [ ] **Toute la section I** passe (aucune élévation de privilège via connexion anonyme).
- [ ] Console participant : aucun `connect_error` persistant en conditions normales.
- [ ] Test effectué au moins une fois sur **mobile**.
