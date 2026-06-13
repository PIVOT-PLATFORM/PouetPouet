# Spec — Mes PIP (PI Planning — Gestionnaire d'événements)

> Version : 0.3 — Statut : Brouillon — Dernière mise à jour : 2026-06-13
> PIP = PI Planning. Outil centré sur la **préparation et gestion des événements** d'un Program Increment.

---

## 1. Vision

**Mes PIP** est un **gestionnaire d'événements spécialisé PI Planning**. Il aide à organiser, planifier et suivre tous les événements qui constituent un cycle de PI : la cérémonie de planification principale, mais aussi les reviews, démos, rétrospectives, points de synchronisation, et l'Inspect & Adapt final.

Il ne remplace pas MeetOps (gestion générique de réunions) mais en est une **couche métier SAFe** : les événements sont typés, ordonnés, liés aux équipes et aux itérations du PI.

**Cas d'usage cibles :**
- RTE organisant l'ensemble des cérémonies d'un PI (de la kick-off à l'I&A)
- Scrum Master préparant les itérations et sessions de son équipe
- Direction souhaitant une vue calendaire de tous les événements du programme
- Équipe distribuée ayant besoin de retrouver rapidement les liens et agendas de chaque événement

---

## 2. Concepts clés

```
PI (Program Increment)
 └── Calendrier d'événements
      └── Événement PI
           ├── Type (PI Planning, Sprint Review, Démo, I&A, Sync…)
           ├── Itération cible
           ├── Équipes concernées
           ├── Agenda
           ├── Participants / listes de diffusion
           └── Documents liés (order du jour, CR, slides)
```

| Terme | Définition |
|---|---|
| **PI** | Program Increment — cycle de 8 à 12 semaines découpé en itérations |
| **Événement PI** | Cérémonie ou réunion rattachée à un PI et à une ou plusieurs itérations |
| **ART** | Agile Release Train — ensemble des équipes qui partagent le PI |
| **Itération** | Sprint du PI (ex : IT1 à IT5 + IP Sprint) |
| **Template d'événement** | Modèle préconfigurable pour reproduire des événements récurrents d'un PI à l'autre |

---

## 3. Types d'événements PI

| Type | Fréquence typique | Portée | Description |
|---|---|---|---|
| `PI_PLANNING` | 1× par PI | ART entier | Cérémonie 2 jours de planification du PI |
| `SPRINT_REVIEW` | 1× par itération | Par équipe | Présentation des réalisations de l'itération |
| `SYSTEM_DEMO` | 1× par itération | ART entier | Démo intégrée du système à toutes les équipes |
| `SPRINT_RETRO` | 1× par itération | Par équipe | Rétrospective de l'équipe |
| `SPRINT_PLANNING` | 1× par itération | Par équipe | Planification de l'itération suivante |
| `PO_SYNC` | Hebdo | Product Owners | Synchronisation PO / Product Management |
| `RTE_SYNC` | Hebdo | RTE + SM | Point de suivi du programme |
| `INSPECT_ADAPT` | 1× par PI | ART entier | Rétrospective et amélioration à l'échelle du PI |
| `CUSTOM` | Libre | Libre | Tout autre événement du programme |

---

## 4. Fonctionnalités

### 4.1 Gestion des PI

- Créer un PI : nom (ex : "PI 2026.Q3"), dates début/fin, équipes de l'ART, nombre d'itérations, durée par itération
- Le PI génère automatiquement les **créneaux d'itérations** (IT1 → ITn + IP Sprint) avec dates calculées
- Statuts PI : `PREPARATION` → `ACTIVE` → `INSPECT_ADAPT` → `CLOSED`
- Dupliquer un PI (reprend la structure d'équipes et les templates d'événements)

### 4.2 Calendrier des événements

- Vue **calendrier mensuel** de tous les événements du PI
- Vue **par itération** : liste des événements de chaque sprint
- Vue **par équipe** : filtre pour n'afficher que les événements d'une équipe donnée
- Indicateur : événements à venir dans les 7 jours (widget dashboard)
- Couleur par type d'événement

### 4.3 Création d'un événement PI

Champs d'un événement :

| Champ | Type | Notes |
|---|---|---|
| Type | enum | Cf. tableau §3 |
| Titre | string | Pré-rempli depuis le type (ex : "Sprint Review IT2 — Équipe Alpha") |
| Itération | référence | IT1, IT2… ou "Transverse" si multi-itérations |
| Équipes concernées | liste | Toutes ou sélection |
| Date / heure début | datetime | |
| Durée | number (min) | |
| Lieu / lien | string | Salle ou URL Teams/Zoom |
| Animateur | User Pivot | |
| Participants | listes de diffusion MeetOps ou unitaires | |
| Ordre du jour | markdown | |
| Documents préparatoires | liens Mes PDF ou URL | |
| Statut | `PLANNED` / `CONFIRMED` / `DONE` / `CANCELLED` | |

### 4.4 Génération automatique du calendrier de cérémonie

À la création d'un PI, le module propose de **générer automatiquement** tous les événements standards du cycle :

- PI Planning (J1-J2 du PI)
- Pour chaque itération : Sprint Planning, Sprint Review, System Demo, Rétro
- PO Sync hebdomadaire
- RTE Sync hebdomadaire
- Inspect & Adapt (dernière semaine du PI)

Les dates sont calculées automatiquement depuis les dates des itérations. L'utilisateur peut ajuster chaque événement avant envoi.

### 4.5 Envoi des invitations

- Envoi massif via **MeetOps** (délègue la gestion des invitations Outlook/Teams/SMTP)
- Envoi sélectif : sélectionner quels événements envoyer
- Modification live : si un événement est déplacé, la mise à jour est propagée automatiquement (via MeetOps)
- Statut d'envoi par événement : Non envoyé / Envoyé / Modifié / Annulé

### 4.6 Documents et préparation

Pour chaque événement :
- Joindre des documents préparatoires (via Mes PDF ou lien externe)
- Créer et partager l'ordre du jour
- Saisir le compte rendu après l'événement
- Marquer l'événement comme terminé (DONE) avec résumé

### 4.7 Templates d'événements

- Sauvegarder la configuration d'un événement comme template (durée, agenda type, participants type)
- Bibliothèque de templates par type (ex : "Sprint Review 1h30 — équipe de 8")
- Réutiliser les templates d'un PI au suivant
- Templates système fournis : PI Planning 2 jours, Sprint Review 1h, System Demo 2h, I&A journée

### 4.8 Suivi et reporting

| Rapport | Description |
|---|---|
| Taux de complétion | % événements DONE / total planifié à date |
| Événements annulés | Combien et pourquoi |
| Participation | (Si RSVP via MeetOps) taux d'acceptation |
| Calendrier imprimable | Export PDF du calendrier du PI complet |
| Historique PI | Comparer la densité événementielle PI par PI |

---

## 5. Intégrations

| Module | Intégration |
|---|---|
| **MeetOps** | Délègue l'envoi et la gestion des invitations ; chaque événement PI crée/met à jour une réunion MeetOps |
| **Mes PDF** | Stockage des ordres du jour, CR, slides de présentation |
| **Roadmap** | Affiche les jalons PI (PI Planning, I&A, Go-live) sur la roadmap stratégique |
| **Capacité** | Import des itérations PI comme périodes de sprint dans le module Capacité |
| **Notifications Pivot** | Rappels 48h avant chaque événement, alertes événements non confirmés |

---

## 6. Droits

| Action | RTE (Propriétaire) | Scrum Master (Éditeur) | Participant (Lecteur) |
|---|---|---|---|
| Créer / configurer le PI | ✅ | ❌ | ❌ |
| Créer / modifier des événements | ✅ | ✅ (son équipe) | ❌ |
| Envoyer les invitations | ✅ | ✅ (son équipe) | ❌ |
| Saisir le CR / marquer DONE | ✅ | ✅ | ❌ |
| Voir le calendrier complet | ✅ | ✅ | ✅ |
| Exporter le calendrier | ✅ | ✅ | ✅ |
| Supprimer le PI | ✅ | ❌ | ❌ |

---

## 7. Modèle de données (Prisma — ébauche)

```prisma
model PiCycle {
  id             String   @id @default(cuid())
  ownerId        String
  name           String
  artName        String?
  startDate      DateTime
  endDate        DateTime
  iterationCount Int      @default(5)
  iterationWeeks Int      @default(2)
  status         PiCycleStatus @default(PREPARATION)
  teams          PiCycleTeam[]
  iterations     PiIteration[]
  events         PiCycleEvent[]
  shares         PiCycleShare[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model PiIteration {
  id        String   @id @default(cuid())
  cycleId   String
  cycle     PiCycle  @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  number    Int      // 1, 2, 3... N, puis IP
  label     String   // "IT1", "IT2", "IP Sprint"
  startDate DateTime
  endDate   DateTime
  events    PiCycleEvent[]
}

model PiCycleTeam {
  id      String  @id @default(cuid())
  cycleId String
  cycle   PiCycle @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  name    String
  color   String  @default("#6366f1")
  smId    String? // Scrum Master
}

model PiCycleEvent {
  id            String   @id @default(cuid())
  cycleId       String
  cycle         PiCycle  @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  iterationId   String?
  iteration     PiIteration? @relation(fields: [iterationId], references: [id])
  type          PiEventType  @default(CUSTOM)
  title         String
  teamIds       String[]
  startAt       DateTime
  durationMin   Int
  location      String?
  animatorId    String?
  agenda        String?
  summary       String?  // CR post-événement
  status        PiEventStatus @default(PLANNED)
  meetOpsId     String?  // lien vers réunion MeetOps
  documents     PiEventDoc[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model PiEventDoc {
  id      String       @id @default(cuid())
  eventId String
  event   PiCycleEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  label   String
  url     String
  pdfId   String?
}

enum PiCycleStatus { PREPARATION ACTIVE INSPECT_ADAPT CLOSED }
enum PiEventType   { PI_PLANNING SPRINT_REVIEW SYSTEM_DEMO SPRINT_RETRO SPRINT_PLANNING PO_SYNC RTE_SYNC INSPECT_ADAPT CUSTOM }
enum PiEventStatus { PLANNED CONFIRMED DONE CANCELLED }
```

---

## 8. Questions ouvertes

- [ ] **Génération auto du calendrier** : les dates sont-elles calculées strictement (ex : rétro = dernier jour de l'itération) ou juste suggérées ?
- [ ] **Multi-équipes sur un événement** : un System Demo implique toutes les équipes — un seul événement ou un par équipe ?
- [ ] **Lien MeetOps** : création automatique de la réunion MeetOps à la création de l'événement PI, ou étape manuelle "Envoyer via MeetOps" ?
- [ ] **SAFe strict ou adapté** : les types d'événements sont-ils fixes ou l'utilisateur peut-il les personnaliser ?

---

## 9. Périmètre v1

**Dans le scope v1 :**
- Création PI + itérations calculées
- Création et gestion des événements (tous types)
- Génération automatique du calendrier de cérémonie
- Calendrier (mois + par itération + par équipe)
- Envoi invitations via MeetOps
- Documents liés + CR
- Templates d'événements
- Export PDF calendrier

**Reporté v2 :**
- Reporting multi-PI (historique, comparaison)
- Lien Capacité automatique
- Dashboard RTE (vue santé du programme)
