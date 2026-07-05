# Plan — Module PI Planning (SAFe) par composition : Forms + To-Do + Program Board neuf

> Version : 0.1 — Statut : Plan validé, en cours d'implémentation — Dernière mise à jour : 2026-07-05

## Context

Besoin exprimé pour un RTE d'un Train SAFe (ART, 11 équipes) : organiser les PI Planning. 3 sous-besoins :
- **A. Logistique** : formulaire par participant (présence Mar/Mer, hôtel, repas Midi J1 / Soir J1 / Midi J2, allergies), relances automatiques paramétrables aux non-répondants, dashboard RTE (Validé/En attente) + exports CSV.
- **B. Task board** : tâches (priorité, échéance), assignation multiple, Kanban (À faire / En cours / Bloqué / Fait), filtre par membre.
- **C. Program Board multi-équipes** : matrice itérations (colonnes) × équipes (swimlanes + ligne Train), tickets typés (Feature, Milestone, Risque, Objectif, Story, Enabler), flèches de dépendances vert (OK) / rouge (bloquant).

### Benchmark marché
- **Kendis, piplanning.io** : pure-players du program board digital SAFe (dépendances visuelles, overlay Jira/ADO). **Jira Align** : leader entreprise, 27 k$+/an. **Miro/Mural** : templates sans structure de données.
- **Gap** : aucun outil du marché ne couvre la **logistique événementielle** (hôtel, repas, relances) — vrai différenciateur.

### Architecture retenue (validée par Julien) : COMPOSITION de modules existants
1. **Module Hub dédié `pi`** (nav `/pi`) : socle PI (cycle, itérations IT1…ITn+IP, équipes du Train) + Program Board (seul gros morceau neuf, rien d'existant ne le couvre).
2. **Logistique = le module Forms, étendu** : le PI crée un formulaire **dans Forms** (template logistique pré-rempli, modifiable ensuite dans le builder — « options supplémentaires paramétrables ») et le rattache au PI. Forms gagne une feature générique **destinataires nommés + relances automatiques** (profite à tous les formulaires). Participants sans compte, lien token personnel.
3. **Tâches = le module To-Do, étendu** : statuts En cours/Bloqué, assignation multiple, vue Kanban + filtre par membre. Le PI se rattache à un TodoDashboard existant/créé (stats de complétion gratuites via le mécanisme TodoDashboard→TodoList déjà livré en 0.30.0).

### Briques réutilisées
Scheduler relances : gabarit `apps/api/src/modules/signdoc/signdoc.scheduler.ts` (setInterval + advisory lock Postgres + cooldown). Kanban DnD HTML5 : `apps/web/src/app/(app)/feedback/page.tsx`. Assignation : `validateAssignee()` `roadmap.routes.ts:219-244`. Anti-cycle deps : `validateDeps` `roadmap.routes.ts:197-212`. CSV BOM UTF-8 : `forms.routes.ts:350-383`. Emails : `apps/api/src/lib/mailer.ts` (`actionHtml`). Notifs : `apps/api/src/lib/notify.ts`. Partage : `ModuleShare` (`shares.ts`). Spec brouillon `docs/specs/mes-pip.md` : socle PiCycle/PiIteration/PiCycleTeam repris ; ses cérémonies/calendrier restent hors scope.

---

## Modèle de données

### Extension Forms (générique)
```prisma
model FormRecipient {  // destinataire nommé d'un formulaire
  id, formId (→ Form, Cascade), name, email
  token String @unique          // lien personnel /f/{token} (clair, base64url 24o, style publicToken)
  invitedAt?, respondedAt?, lastRemindedAt?, remindersSent Int @default(0)
  @@unique([formId, email])
  @@index([formId, respondedAt]) // scheduler : non-répondants
}
// Form        += remindersEnabled Boolean @default(false), reminderFrequencyDays Int @default(7)
// FormResponse += recipientId String? (→ FormRecipient, SetNull) — qui a répondu
```
- Page publique `/f/[token]` : lookup `Form.publicToken` puis fallback `FormRecipient.token` → même formulaire, mais la soumission enregistre `recipientId` + `respondedAt` ; un destinataire revoit sa réponse et peut la **mettre à jour** (nécessaire pour la logistique).
- Export `responses.csv` : colonnes Nom/Email ajoutées quand la réponse a un destinataire.

### Extension To-Do
```prisma
// TodoItemStatus += IN_PROGRESS, BLOCKED   (ALTER TYPE ADD VALUE — additif)
// TodoItem       += assigneeIds String[] @default([])  (validé API : accès à la liste requis)
```
- Tri (`todo-sort.ts`) : TODO/IN_PROGRESS/BLOCKED = « ouverts », puis DONE, puis CANCELLED. Stats dashboards : done = DONE ; overdue/byPriority = statuts ouverts (CANCELLED toujours exclu).

### Nouveau module PI
```prisma
model PiCycle {     // ownerId, name "PI 2026.Q3", artName?, startDate/endDate,
                    // status PREPARATION|ACTIVE|CLOSED, eventDay1?, eventDay2?, eventLocation?
                    // logisticsFormId String?   — référence lâche vers Form (créé via template)
                    // todoDashboardId String?   — référence lâche vers TodoDashboard (tâches du Train)
  iterations PiIteration[]; teams PiCycleTeam[]; tickets PiTicket[]; dependencies PiDependency[]
}
model PiIteration { // cycleId (Cascade), number (1..N puis IP), label "IT1"/"IP Sprint",
                    // startDate/endDate, @@unique([cycleId, number])
model PiCycleTeam { // SNAPSHOT : name, color, order, sourceTeamId? (lâche, sans FK —
                    // la suppression d'une Team pivot ne casse pas un PI historique)
model PiTicket {    // cycleId (Cascade), teamId? (null = ligne Train, Cascade),
                    // iterationId? (null = Non planifié, SetNull), type, title, description?, order
model PiDependency {// cycleId, fromTicketId → toTicketId (Cascade), status OK|BLOCKED, note?
                    // @@unique([fromTicketId, toTicketId])
enum PiCycleStatus { PREPARATION ACTIVE CLOSED }
enum PiTicketType  { FEATURE MILESTONE RISK OBJECTIVE STORY ENABLER }
enum PiDependencyStatus { OK BLOCKED }
```
Références **lâches** (`logisticsFormId`, `todoDashboardId`, sans FK) : pas de couplage de schéma entre modules ; nettoyées à l'affichage si la cible a disparu. Partage `ModuleShare` clé `'pi'` (RTE = OWNER, Scrum Masters = EDITOR).

---

## Découpage en PRs (feat/* → develop ; flag `module.pi` à false pendant le dev ; les PRs Forms/To-Do sont utiles seules et peuvent être activées sans attendre le module PI)

### PR1/PR2 — Forms : destinataires nommés + relances automatiques (M+S) — ✅ mergé (PR #240)
Implémentées ensemble sur une seule branche (à la demande de Julien) :
- Migration : `FormRecipient` + `FormResponse.recipientId` + `Form.remindersEnabled`/`reminderFrequencyDays`.
- API (`apps/api/src/modules/forms/forms.routes.ts`) : CRUD destinataires (ajout unitaire + collage en lot « Nom <email> » par ligne), `POST /:id/recipients/send`, `POST /:id/recipients/:rid/remind` (cooldown 20 h), statut par destinataire.
- Public : `/f/[token]` accepte le token destinataire (fallback lookup) ; soumission liée + mise à jour possible de sa propre réponse ; `respondedAt` posé.
- Mailer : `sendFormInviteEmail` / `sendFormReminderEmail`.
- Scheduler `apps/api/src/modules/forms/forms.scheduler.ts` — copie structurelle de `signdoc.scheduler.ts` : `runFormReminders(now)` pur + tick horaire + `pg_try_advisory_xact_lock`. Dû si `now − max(invitedAt, lastRemindedAt) ≥ frequencyDays × 24h` ; fenêtre 8h–18h ; garde-fou ≥ 20 h ; stop naturel (form fermé, plus de non-répondants). Notif owner par batch. Câblé dans `apps/api/src/index.ts`.
- Web : section « Destinataires » dans `apps/web/src/app/(app)/forms/[id]/responses/` (tableau Répondu/En attente, Relancer, Copier le lien, config relances) ; CSV enrichi Nom/Email ; page publique adaptée (prefill + modification de réponse).
- Tests : `forms-recipients.integration.test.ts` + `forms.scheduler.integration.test.ts` (14 tests). Typecheck + lint + smoke test manuel OK.

### PR3 — To-Do : statuts + assignation + vue Kanban (M)
- Migration : `IN_PROGRESS`/`BLOCKED` dans `TodoItemStatus` (additif) + `TodoItem.assigneeIds`.
- API `todo.routes.ts` : PATCH accepte les nouveaux statuts + `assigneeIds` (helper `validateAssignees()` calqué roadmap : chaque assigné doit avoir accès à la liste via `roleFor`) ; `todo-sort.ts` et stats dashboards mis à jour (ouverts = TODO/IN_PROGRESS/BLOCKED).
- Web `apps/web/src/app/(app)/todo/[id]/page.tsx` : bascule **Liste ⇄ Kanban** ; kanban 4 colonnes (À faire / En cours / Bloqué / Fait) en DnD HTML5 copié de `feedback/page.tsx`, tâches annulées masquées derrière un toggle ; sélecteur d'assignés (owner + comptes partagés) + avatars + **filtre par membre** (chips) dans les deux vues.
- Tests : extension `todo.routes.integration.test.ts` (nouveaux statuts, assigné sans accès → 400, stats).

### PR4 — Socle module PI + intégrations Forms/To-Do (M/L)
- Enregistrement 4 points : `PI_MODULE` (`packages/shared/src/forge/modules.ts`), flag `module.pi` false (`flags.ts`), `registry.ts`, icône + Hub `DOMAINS` (+ retrait « Mes PIP » de INCOMING) + page Aide.
- Migration : PiCycle/PiIteration/PiCycleTeam.
- API `apps/api/src/modules/pi/pi.routes.ts` : CRUD cycle (génération auto des itérations : nombre + semaines → dates, dernière = « IP Sprint »), CRUD équipes + import depuis `Team` pivot, résolveur `'pi'` dans `shares.ts`, `deleteResourceShares` au delete.
- **Intégration Forms** : `POST /:id/logistics-form` — crée un `Form` (owner = RTE) avec le template logistique pré-rempli depuis `eventDay1/eventDay2` (checkboxes présence Mardi/Mercredi, radio hôtel, checkboxes 3 repas, long_text allergies), le publie, stocke `logisticsFormId`. Le RTE peut ensuite l'éditer librement dans le builder Forms.
- **Intégration To-Do** : `PATCH /:id` accepte `todoDashboardId` (dashboard To-Do accessible) ; option « Créer le tableau du Train » qui crée un TodoDashboard nommé d'après le PI.
- Web : `apps/web/src/app/(app)/pi/page.tsx` (liste + création) ; `pi/[id]/page.tsx` (aperçu : itérations, équipes, partage, **carte Logistique** — statut répondants agrégé + liens vers le formulaire Forms — et **carte Tâches** — stats du TodoDashboard lié + lien).
- Tests : `pi.routes.integration.test.ts` (CRUD, itérations générées, rôles, création formulaire logistique rattaché).

### PR5 — Program Board : données + API (M)
- Migration : PiTicket/PiDependency.
- API `apps/api/src/modules/pi/pi-board.routes.ts` : `GET /:id/board` (payload unique : itérations + équipes + tickets + deps), CRUD tickets (teamId/iterationId du même cycle), `PATCH /tickets/:tid/move` (cellule cible + order), CRUD dépendances — anti-cycle (adaptation `validateDeps`), anti-doublon, PATCH statut OK/BLOCKED + note.
- Tests : `pi-board.routes.integration.test.ts` (cycle refusé, doublon, cross-cycle refusé, cascades équipe/itération).

### PR6 — Program Board : UI (L)
- `pi/[id]/board/page.tsx` + composants `apps/web/src/components/pi/` : `program-board.tsx`, `pi-ticket-card.tsx`, `dependency-layer.tsx`, `ticket-modal.tsx`.
- **Matrice** : conteneur `overflow-auto`, wrapper `relative` à la taille du contenu (porte l'overlay SVG → flèches défilent avec le contenu, zéro recalcul au scroll). Grille CSS `180px + repeat(N+1, minmax(230px,1fr))` : colonne équipes sticky-left, colonne « Non planifié », puis IT1…IP ; header sticky-top (label + dates) ; ligne 0 = **Train** (fond distinct), puis équipes (pastille couleur, `order`). Chaque cellule = drop zone HTML5 (pattern Feedback).
- **Tickets** : bordure gauche + badge par type (Feature bleu, Milestone violet, Objectif ambre, Risque orange, Story gris, Enabler cyan) ; `+` au survol de cellule ; clic → modale.
- **Flèches** (`dependency-layer.tsx`) : `<svg absolute inset-0 pointer-events-none>` dans le wrapper ; markers vert `#10b981` / rouge `#ef4444` (rouge = plus épais + dasharray, lisibilité daltonienne) ; ancres via `Map<ticketId, HTMLElement>` (callback refs) + `useLayoutEffect` + `ResizeObserver`, positions relatives au wrapper ; Bézier simple façon `roadmap-timeline.tsx:113-128` ; path invisible élargi pour le clic → popover (OK/Bloquant, note, supprimer) ; création par mode « Lier » (clic source → clic cible) + fallback sélecteur dans la modale.
- **Pas de socket.io en v1** : polling 15–30 s + refetch au focus + mutations optimistes (chaque équipe édite surtout sa ligne). Temps réel = premier candidat v2 (room `pi:{cycleId}`).
- Volumétrie 11 équipes × ~7 colonnes : un render suffit, mémoïser `PiTicketCard`.

### PR7 — Activation + release (XS)
- `module.pi` → true, aide finalisée, retouches dogfooding, release (patch-notes, bump, CHANGELOG/ROADMAP/README, develop → master). Les features Forms/To-Do (PR1–3) peuvent être mentionnées dans une release intermédiaire si mergées avant.

---

## Points de vigilance
- **RGPD** : allergies = donnée sensible dans une réponse Forms ; bouton « Purger destinataires + réponses » côté Forms ; la route publique token ne renvoie jamais la liste des autres destinataires ; token non énumérable.
- **Migration enum To-Do** : `ALTER TYPE ADD VALUE` = additif, safe ; ne pas renommer les valeurs existantes. Module fraîchement livré → tests d'intégration existants doivent rester verts sans modification de leurs assertions DONE/CANCELLED.
- **Références lâches** (`logisticsFormId`, `todoDashboardId`) : vérifier l'accès de l'appelant à la cible au moment du lien ET à l'affichage (pas de fuite de stats d'un dashboard non partagé).
- **Suppression PiCycleTeam** = cascade tickets → confirmation UI avec compte.
- Emails dev/test : fallback log console de `mailer.ts` ; les tests vérifient `lastRemindedAt`/`remindersSent` en base.

## Hors scope v1
Cérémonies/calendrier/templates de `docs/specs/mes-pip.md`, intégration MeetOps/Outlook, temps réel socket.io sur le program board (v2), ROAM, confidence vote, duplication de PI, export PDF/image du board, import Jira/ADO, lien Capacité, exports CSV « traiteur/hôtel » sur mesure (l'export générique Forms couvre le besoin).

## Vérification (chaque PR)
1. `npx tsc --noEmit` (api + web) + `npm test` + `npm --workspace apps/api run test:integration`.
2. Smoke test avec flag surchargé en DB (pattern habituel, revert après) :
   - PR1/2 : formulaire + 3 destinataires, envoi, réponse via `/f/{token}` (curl + page), update de réponse, statut, `runFormReminders(date)` pose `lastRemindedAt`, CSV enrichi.
   - PR3 : kanban To-Do, drag entre colonnes, assignation multiple, filtre membre, stats dashboard inchangées pour DONE/CANCELLED.
   - PR4 : créer un PI (itérations générées), bouton formulaire logistique → Form rattaché avec les bons champs, lien TodoDashboard.
   - PR5/6 : 2 équipes + 3 itérations, tickets, dépendance verte → rouge, cycle de dépendance refusé.
3. CI verte sur chaque PR ; merges par Julien.
