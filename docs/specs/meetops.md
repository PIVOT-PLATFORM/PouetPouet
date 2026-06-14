# Spec — MeetOps

> Version : 0.4 — Statut : Brouillon — Dernière mise à jour : 2026-06-14

---

## 1. Vision

MeetOps est le module de **gestion industrielle de réunions** de la suite Pivot. Il couvre l'ensemble du cycle de vie d'un événement organisationnel : conception, planification en série, envoi, suivi des modifications, reporting et archivage.

### 1.1 Origine concrète : fiabiliser un flux Power Automate

MeetOps part d'un besoin réel et existant. Aujourd'hui, un **flux Power Automate** orchestre la création de réunions :

1. Il lit un **planning de réunions depuis un fichier Excel** (date, heure, durée, sujet…).
2. Il croise ce planning avec une **table de listes de diffusion** (une liste de destinataires par réunion).
3. Il **crée et envoie les réunions dans Outlook avec un lien Teams**, à chaque liste concernée.

Ce flux est fragile (dépendance à Power Automate, peu de visibilité, gestion des modifications difficile, pas de reprise sur erreur). **L'objectif de MeetOps est de remplacer entièrement ce flux par un vrai outil dans l'application Pivot** — fini l'Excel et Power Automate — de façon fiable, traçable et pilotable :

- **création et gestion 100 % dans l'app** du planning de réunions et des listes de diffusion (plus aucun fichier Excel intermédiaire) ;
- **connecteurs Microsoft Office (Graph API)** pour créer/mettre à jour/annuler les réunions Outlook et générer les liens Teams ;
- création et gestion faciles d'un **lot de réunions** (suivi d'envoi, modifications de masse, reprise sur échec).

### 1.2 Le flux cible (canonique)

```
Planning + listes de diffusion           Événement + réunions + participants
gérés nativement dans MeetOps    ──────▶  (création directe dans l'app)
                                                      │
                                                      ▼
                                  Connecteur Microsoft Graph (par organisateur)
                                                      │
                              ┌───────────────────────┼───────────────────────┐
                              ▼                        ▼                        ▼
                      Réunion Outlook            Lien Teams             Suivi RSVP / statut
                      (chaque destinataire)      (onlineMeeting)        (accepté/refusé)
```

Tout est saisi et piloté **dans l'application** : aucune dépendance à un fichier externe. Le canal **Microsoft Graph (Outlook + Teams) est le canal de diffusion principal** ; l'export/`.ics` SMTP reste un **fallback** quand Graph n'est pas configuré.

**Cas d'usage cibles :**
- Équipe qui pilote aujourd'hui ses réunions récurrentes via un Excel + Power Automate (cas fondateur)
- Chef de projet gérant un programme complet (PI Planning, release train, comités récurrents)
- Assistant(e) de direction centralisant les invitations d'un COPIL ou COMOP
- Équipe IT pilotant les fenêtres de mise en production et réunions de suivi

---

## 2. Concepts clés

> **Évolution v0.4 — modèle à plat.** Les *séries* et la *génération de récurrence* ont
> été retirées au profit d'une **liste de réunions à plat** par événement, plus simple et
> plus scalable. Le classement se fait par une **étiquette libre (`label`)** au lieu d'un
> objet série, et l'ordre d'affichage est **manuel (drag & drop)**.

```
Événement (Event)
 └── Réunion (Meeting)   ← liste à plat, ordre manuel, étiquette libre
      ├── Participants (listes de diffusion ou unitaires)
      ├── Canal d'envoi (Outlook / Teams / Email / Manuel)
      └── Statut (Brouillon / Envoyée / Modifiée / Annulée)
```

| Terme | Définition |
|---|---|
| **Événement** | Conteneur de haut niveau (ex : "Release v2.0", "COPIL mensuel Q3"). Porte les droits, templates et métriques. |
| **Réunion** | Une occurrence planifiée : titre, étiquette, date, heure, durée, lieu/lien, participants, ordre du jour. Ordonnée manuellement au sein de l'événement. |
| **Étiquette (`label`)** | Texte libre de classement d'une réunion (ex : "Daily", "Review", "COPIL"). Donne sa couleur dans le calendrier et le tableau. Remplace la notion de série. |
| **Liste de diffusion** | Groupe de destinataires réutilisable, global (centralisé) ou local à un événement |
| **Template** | Modèle d'événement : lignes de réunions en **décalages relatifs** (étiquette, titre, durée, jour+heure relatifs à une date de départ), sans dates absolues |
| **Modification live** | Propagation immédiate d'une modification à toutes les invitations déjà envoyées (update Outlook/Teams) |

---

## 3. Fonctionnalités

### 3.1 Gestion des événements

- Créer / dupliquer / archiver / supprimer un événement
- Types prédéfinis : `VERSION`, `SPRINT`, `COPIL`, `COMOP`, `RELEASE`, `ONBOARDING`, `CUSTOM`
- Statuts : `DRAFT` → `ACTIVE` → `CLOSED` → `ARCHIVED`
- Champs : nom, description, date début/fin, responsable, couleur, tags libres
- Droits par événement (cf. §7)
- Créer depuis un template (cf. §6)

### 3.2 Tableau de réunions (liste à plat)

> Remplace l'ancienne section « Séries ». La saisie se fait dans un **tableau éditable**
> unique par événement.

- **Tableau inline** : colonnes Étiquette · Nom · Date · Heure · Durée · Statut. Édition
  directe de chaque cellule, sauvegarde automatique au blur/Entrée.
- **Ajout sans friction** : « + Ajouter une réunion » crée une ligne brouillon ;
  elle est enregistrée **dès qu'un champ valide est saisi** (le seul champ requis est la
  date, par défaut aujourd'hui), abandonnée si laissée vide.
- **Réorganisation manuelle** : drag & drop des lignes (poignée), ordre persisté
  (`Meeting.order`).
- **Étiquettes** : champ libre avec autocomplétion des étiquettes déjà utilisées ;
  couleur déterministe par étiquette.
- **Modification de masse** : sélection multi-lignes → appliquer une étiquette, une durée,
  décaler les dates de N jours, ou supprimer en lot.
- **Replanification** : via la modification de masse (décalage de N jours sur la sélection).

### 3.3 Réunion individuelle

Chaque réunion expose :

| Champ | Type | Notes |
|---|---|---|
| Titre | string | Libre par réunion (défaut « Réunion ») |
| Étiquette (`label`) | string? | Classement libre, donne la couleur |
| Ordre (`order`) | int | Position manuelle dans le tableau (drag & drop) |
| Date/heure début | datetime | Timezone supportée |
| Durée | number (minutes) | |
| Lieu | string | Salle physique ou URL Teams/Meet/Zoom |
| Lien Teams | URL | Généré automatiquement si intégration active |
| Ordre du jour | markdown | Structuré en points numérotés |
| Participants | Liste de diffusion + ajouts unitaires | |
| Organisateur | User Pivot | |
| Statut envoi | enum | `DRAFT / SENT / UPDATED / CANCELLED` |
| PJ / Pièces jointes | fichiers | Liées au CR ou à l'ordre du jour |

### 3.4 Envoi et synchronisation

- **Envoi initial** : génère et envoie les invitations Outlook (.ics) ou crée l'événement via l'API Graph (Teams/Outlook 365)
- **Modification live** : toute modification d'une réunion déjà envoyée propage automatiquement un update aux participants (mise à jour de l'invitation Outlook, notification in-app)
- **Annulation** : envoie une annulation Outlook + notification Pivot
- **Envoi différé** : programmer l'envoi à une date/heure future
- **Modes d'envoi disponibles :**
  - Microsoft 365 / Graph API (Outlook + Teams)
  - Email SMTP simple (.ics en pièce jointe)
  - Export .ics manuel (sans envoi automatique)
  - Pivot uniquement (sans envoi externe)

### 3.5 Historique des modifications

Chaque modification d'une réunion ou d'une série génère une entrée d'historique :

```
{
  at: datetime,
  by: userId,
  field: "startDate" | "participants" | "title" | ...,
  oldValue: any,
  newValue: any,
  scope: "occurrence" | "series" | "event",
  propagated: boolean   // l'update a-t-il été envoyé aux participants ?
}
```

- Consulter l'historique complet d'une réunion, d'une série ou d'un événement
- Filtrer par auteur, champ modifié, plage de dates
- Annuler la dernière modification (si l'invitation n'est pas encore envoyée)

### 3.6 Import de plannings

- **Import CSV/Excel** : colonnes titre, date début, date fin, participants (emails), lieu — mapping visuel à l'import
- **Import .ics / iCal** : fichier exporté depuis Outlook, Google Calendar, etc.
- **Import depuis un autre événement Pivot** : cloner les séries d'un événement existant
- Prévisualisation avant validation, détection des conflits (même participant, même créneau)

### 3.7 Listes de diffusion

**Listes centralisées (globales)**
- Créées et gérées au niveau de l'espace Pivot (tous les événements peuvent les utiliser)
- Versionnées : ajout/suppression d'un membre tracé
- Exemples : "Direction", "Équipe DevOps", "Comité Qualité"

**Listes locales (par événement)**
- Propres à un événement, non réutilisables ailleurs (sauf export)
- Peuvent hériter d'une liste globale puis être enrichies

**Gestion des membres**
- Import CSV (nom, email, rôle)
- Synchronisation avec l'annuaire Office 365 (si intégration Graph active)
- Groupes imbriqués (liste dans une liste)
- Indicateur de délivrance : invitation acceptée / refusée / en attente (via Graph API)

---

## 4. Vue Calendrier

### 4.1 Calendrier d'un événement

- Vue mensuelle / hebdomadaire / agenda (liste)
- Toutes les réunions de toutes les séries d'un événement
- Code couleur par série
- Click sur une réunion → panneau latéral de détail/édition
- Indicateur visuel : brouillon (pointillé), envoyée (plein), annulée (barré)

### 4.2 Calendrier multi-événements

- Superposer les calendriers de plusieurs événements (sélection depuis une liste)
- Chaque événement a sa couleur propre
- Filtres par série, statut, participant
- Masquer/afficher certaines réunions ou séries sans les supprimer
- Détection visuelle des conflits (mêmes participants, créneaux qui se chevauchent)

### 4.3 Vue personnelle

- Calendrier centré sur l'utilisateur connecté : toutes ses réunions, tous événements confondus
- Synchronisation vers Outlook/Google Calendar (abonnement .ics live)

---

## 5. Reporting

### 5.1 Tableau de bord d'un événement

| Métrique | Description |
|---|---|
| Taux d'envoi | % réunions envoyées / total planifié |
| Taux d'acceptation | % invitations acceptées (via Graph) |
| Réunions modifiées | nombre et % depuis envoi initial |
| Annulations | nombre, motifs si renseignés |
| Participants uniques | nombre de personnes distinctes impliquées |
| Charge réunion | heures totales × participants (coût organisationnel) |
| Respect des délais | % réunions envoyées à J-N avant l'échéance |

### 5.2 Reporting global (multi-événements)

- Vue agrégée sur une période sélectionnable
- Répartition par type d'événement, par responsable, par équipe
- Évolution temporelle (graphe) de la charge réunion
- Export CSV / PDF du rapport

### 5.3 Alertes et anomalies

- Réunion planifiée sans participants
- Invitation non envoyée à moins de N jours de l'échéance
- Participant ayant refusé toutes les occurrences d'une série
- Chevauchements de créneaux détectés

---

## 6. Templates

Un template capture la structure d'un événement sans les dates :

- Séries (récurrences, durées, titres, ordres du jour types)
- Listes de diffusion associées
- Droits par défaut
- Type d'envoi préféré

**Lifecycle d'un template :**
- Créer depuis zéro ou depuis un événement existant ("Sauvegarder comme template")
- Bibliothèque de templates (personnels + partagés à l'espace)
- Versionner un template (modification sans casser les événements existants qui en sont issus)
- Indicateur : "N événements créés depuis ce template"

**Templates système fournis :**
- PI Planning (kick-off + IDP + sprints + demos + inspect & adapt)
- Release train (go/no-go + communication + post-mortem)
- COPIL mensuel (série mensuelle récurrente)
- Sprint Scrum (daily + review + rétro + planning)

---

## 7. Droits et permissions

Chaque événement a sa propre matrice de droits, indépendante des droits board Pivot.

| Action | Propriétaire | Éditeur | Lecteur |
|---|---|---|---|
| Voir l'événement et ses réunions | ✅ | ✅ | ✅ |
| Créer / modifier une réunion | ✅ | ✅ | ❌ |
| Envoyer / modifier les invitations | ✅ | ✅ | ❌ |
| Annuler une réunion | ✅ | ✅ | ❌ |
| Gérer les séries | ✅ | ✅ | ❌ |
| Gérer les listes de diffusion locales | ✅ | ✅ | ❌ |
| Modifier les droits | ✅ | ❌ | ❌ |
| Supprimer l'événement | ✅ | ❌ | ❌ |
| Créer un template depuis l'événement | ✅ | ✅ | ❌ |

- Partage par lien (rôle Lecteur uniquement, pas d'envoi externe possible)
- Co-propriétaires possibles (même modèle que les boards Pivot)

---

## 8. Intégrations

### Microsoft 365 / Graph API

| Fonctionnalité | Endpoint Graph |
|---|---|
| Créer un événement Outlook | `POST /me/events` |
| Mettre à jour un événement | `PATCH /me/events/{id}` |
| Annuler | `DELETE /me/events/{id}` |
| Créer une réunion Teams | `onlineMeeting` dans le body de l'événement |
| Lire les réponses (accepté/refusé) | `GET /me/events/{id}/attendees` |
| Lire l'annuaire | `GET /groups/{id}/members` |
| Sync calendrier utilisateur | `GET /me/calendarView` |

**Auth :** OAuth2 PKCE vers tenant Azure AD — scope `Calendars.ReadWrite`, `User.Read`, `Group.Read.All`

**Mode dégradé :** si l'intégration n'est pas configurée, MeetOps fonctionne en autonome (pas d'envoi Graph, export .ics manuel disponible).

### Google Workspace (phase 2)

- Google Calendar API v3
- Meet link generation

### SMTP / .ics (fallback universel)

- Envoi par email avec pièce jointe .ics (RFC 5545)
- Compatible avec tous les clients mail

---

## 9. Modèle de données (Prisma — ébauche)

```prisma
model MeetEvent {
  id          String   @id @default(cuid())
  ownerId     String
  name        String
  description String?
  type        MeetEventType @default(CUSTOM)
  status      MeetEventStatus @default(DRAFT)
  startDate   DateTime?
  endDate     DateTime?
  color       String   @default("#6366f1")
  tags        String[]
  templateId  String?
  template    MeetTemplate? @relation(fields: [templateId], references: [id])
  series      MeetSeries[]
  shares      MeetEventShare[]
  distLists   MeetDistList[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// v0.4 : plus de MeetSeries — les réunions sont rattachées directement à l'événement.

model Meeting {
  id            String   @id @default(cuid())
  eventId       String
  event         MeetEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  title         String
  label         String?  // étiquette libre de classement (remplace la série)
  order         Int      @default(0) // ordre manuel (drag & drop)
  startAt       DateTime
  durationMin   Int
  location      String?
  teamsUrl      String?
  agenda        String?
  status        MeetingStatus @default(DRAFT)
  externalId    String?  // ID Outlook/Graph si synchronisé
  sendError     String?  // dernier message d'erreur d'envoi (reprise)
  participants  MeetingParticipant[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model MeetingParticipant {
  id         String  @id @default(cuid())
  meetingId  String
  email      String
  name       String?
  role       String? // organisateur, requis, optionnel
  rsvp       MeetingRsvp @default(PENDING)
}

// Journal d'activité au niveau ÉVÉNEMENT (survit à la suppression d'une réunion).
model MeetHistory {
  id            String   @id @default(cuid())
  eventId       String
  event         MeetEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  meetingId     String?  // null si l'action porte sur l'événement lui-même
  meetingTitle  String?  // libellé figé (la réunion peut être supprimée ensuite)
  userId        String?
  action        String   // created | updated | deleted | sent | reordered | bulk | ...
  field         String?
  oldValue      String?
  newValue      String?
  createdAt     DateTime @default(now())
}

model MeetDistList {
  id        String   @id @default(cuid())
  eventId   String?  // null = liste globale
  name      String
  members   MeetDistMember[]
  createdAt DateTime @default(now())
}

model MeetDistMember {
  id         String      @id @default(cuid())
  listId     String
  list       MeetDistList @relation(fields: [listId], references: [id], onDelete: Cascade)
  email      String
  name       String?
}

model MeetTemplate {
  id          String   @id @default(cuid())
  ownerId     String
  name        String
  description String?
  type        MeetEventType @default(CUSTOM)
  color       String   @default("#475569")
  // Lignes de réunions en décalages relatifs à une date de départ :
  // [{ label, title, durationMin, dayOffset, time }]
  lines       Json
  isShared    Boolean  @default(false)
  events      MeetEvent[]
  createdAt   DateTime @default(now())
}

enum MeetEventType  { VERSION SPRINT COPIL COMOP RELEASE ONBOARDING CUSTOM }
enum MeetEventStatus { DRAFT ACTIVE CLOSED ARCHIVED }
enum MeetingStatus  { DRAFT SENT UPDATED CANCELLED }
enum MeetingRsvp    { PENDING ACCEPTED DECLINED TENTATIVE }
```

---

## 10. Bus d'événements Pivot (inter-modules)

| Événement émis | Déclencheur | Consommateurs potentiels |
|---|---|---|
| `meetops.meeting.sent` | Invitation envoyée | Notifications, Audit |
| `meetops.meeting.updated` | Modification propagée | Notifications |
| `meetops.meeting.cancelled` | Annulation | Notifications |
| `meetops.event.closed` | Événement clôturé | Reporting, Audit |

---

## 11. Questions ouvertes

- [ ] **Tenant Office 365** : enregistrement de l'app Azure AD côté Pivot ou côté client ? (impact sur le modèle de déploiement)
- [ ] **RSVP en temps réel** : webhook Graph ou polling ? (Graph supporte les change notifications)
- [ ] **Gestion des fuseaux horaires** : Pivot stocke en UTC, affichage dans le TZ du participant ou de l'organisateur ?
- [ ] **Taille limite des listes globales** : pas de limite ou quota par espace ?
- [ ] **Droit d'envoi délégué** : un éditeur peut-il envoyer depuis la boîte de l'organisateur (Exchange delegation) ?
- [ ] **Archivage** : les événements archivés sont-ils supprimés de Graph ou juste marqués dans Pivot ?
- [ ] **Mobile** : notifications push pour les mises à jour de réunion (hors périmètre v1 ?)

---

## 12. Périmètre v1 (MVP) — recentré sur le flux fondateur

Le v1 vise à **remplacer le flux Power Automate** de bout en bout.

**Cœur v1 (le flux fondateur, 100 % natif) :**
- **Création et gestion du planning dans l'app** : événement → réunions → participants (aucun import Excel)
- **Listes de diffusion** (par réunion / par événement, réutilisables) gérées dans l'app
- **Connecteur Microsoft Graph** : créer / mettre à jour / annuler les réunions Outlook + générer le **lien Teams** (`onlineMeeting`)
- **Suivi d'envoi par réunion** : non envoyée / envoyée / modifiée / annulée / en erreur, avec **reprise sur échec**
- Gestion d'un **lot de réunions** : modification et envoi de masse

**Autour (déjà amorcé / utile) :**
- Gestion événements + réunions (CRUD, tableau à plat éditable) — ✅ fait
- Étiquettes + ordre manuel (drag & drop) — ✅ fait
- Modification de masse (étiquette / durée / décalage de dates / suppression) — ✅ fait
- Export `.ics` (**fallback** si Graph non configuré) — ✅ fait
- Vue calendrier mono-événement — ✅ fait

> Note : la **génération de récurrence** (séries) a été retirée en v0.4. Pourra revenir
> comme action au niveau événement (« générer N réunions étiquetées »).

**Reporté v2 (en cours) :**
- Historique des modifications (journal d'événement) — ✅ fait
- Templates (lignes relatives, sauver/instancier, bibliothèque) — ✅ fait
- Reporting / tableau de bord — ✅ fait
- Vue multi-événements — ✅ fait

**Reporté v3 :**
- Synchronisation RSVP temps réel (webhooks Graph)
- Annuaire Office 365 (résolution des destinataires)
- Google Workspace

---

## 13. État d'avancement (2026-06-14)

| Brique | État |
|---|---|
| Socle CRUD (événements → réunions → participants, **tableau à plat**) | ✅ |
| Étiquettes + ordre manuel (drag & drop) | ✅ |
| Modification de masse | ✅ |
| Export `.ics` (fallback) | ✅ |
| Vue calendrier mono-événement | ✅ |
| **Vue calendrier multi-événements** | ✅ |
| **Listes de diffusion** + application aux réunions | ✅ |
| **Historique des modifications** (journal d'événement) | ✅ |
| **Templates** (lignes relatives, sauver/instancier, bibliothèque) | ✅ |
| **Reporting** (tableau de bord par événement) | ✅ |
| **Connecteur Microsoft Graph (Outlook + Teams)** | ✅ code prêt — ⏳ en attente des identifiants app Azure AD |
| **Suivi d'envoi + reprise sur échec** | ✅ (statut + erreur par réunion, renvoi/MàJ) |
| Annulation Outlook à la suppression (Graph `DELETE`) | ⏳ à brancher (`cancelEvent` existe) |
| Génération de récurrence (séries) | ❌ retiré en v0.4 |

> Note : pas d'import Excel — l'Excel + Power Automate est le legacy remplacé ; tout est créé et géré nativement dans l'app.
>
> Connecteur Graph : OAuth2 délégué (l'organisateur connecte son compte Microsoft), tokens chiffrés au repos (AES-256-GCM), création/MàJ/annulation d'événements Outlook avec `isOnlineMeeting`/`teamsForBusiness` (lien Teams). Variables d'env : `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_SECRET` (cf. `.env.example`). Le flux réel OAuth + envoi reste à valider en conditions réelles une fois l'app Azure créée.

---

*Spec rédigée pour cadrage. À affiner avec les retours utilisateurs avant le démarrage du développement.*
