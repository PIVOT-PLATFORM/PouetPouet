# Module "Parcours" — Spécification

## Concept

Un **Parcours** est un workflow défini par une suite d'étapes typées, instanciable à volonté.

On distingue :
- **Template** — la définition réutilisable (partageable, starrable)
- **Instance** — un parcours en cours, avec ses données, ses participants, son état

Cas d'usage cibles : traitement de demandes, validation de jalons, parcours cyber, parcours archi, onboarding, conformité, etc.

---

## Ce qu'on réutilise

| Existant | Rôle dans Parcours |
|---|---|
| `ModuleShare` (polymorphe) | Partage des instances et templates |
| `AuditLog` | Traçabilité des accès C2/C3 |
| `mailer.ts` | Étapes d'envoi email + relances SLA |
| `crypto.ts` (AES-256-GCM) | Chiffrement at-rest pour documents C3 |
| `Notification` | Alertes à chaque étape assignée / complétée |
| `retention.ts` | Pattern de job 24h réutilisé pour les relances SLA |
| `bus.ts` | Événements `parcours.*` pour webhooks externes |

**Sur le multi-tenancy :** Pivot n'a pas de concept d'organisation — tout est `ownerId` + `ModuleShare`. "Au sein de la même org" = partagé avec les mêmes utilisateurs via ModuleShare. Aucun changement structurel nécessaire.

**Seul élément vraiment nouveau :** stockage de fichiers → **GCS** (Google Cloud Storage, cohérent avec l'infra Cloud Run).

---

## Modèle d'acteurs

| Acteur | Comment |
|--------|---------|
| **Initiateur** | Crée l'instance — OWNER via `ownerId` |
| **Participant d'étape** | Assigné à une étape précise (`StepDef.assignedTo`) — notifié quand c'est son tour |
| **Valideur** | Assigné à une étape `approval` |
| **Observateur** | ModuleShare VIEWER sur l'instance — voit tout, ne complète rien |

Les observateurs par défaut peuvent être définis au niveau du template (`defaultObservers[]`) et sont automatiquement ajoutés en VIEWER à chaque instance créée.

---

## Types d'étapes

| Type | Description |
|------|-------------|
| `info` | Bloc de texte / instructions (lecture seule) |
| `form` | Formulaire à remplir (champs typés) |
| `document` | Dépôt d'un document avec classification C0–C3 |
| `approval` | Validation humaine (approuver / rejeter + commentaire) |
| `email` | Envoi automatique d'un mail (template avec variables dynamiques) |

---

## Modèle de données

```prisma
model ParcourTemplate {
  id               String   @id @default(cuid())
  ownerId          String
  name             String
  description      String?
  category         String?        // 'cyber' | 'archi' | 'onboarding' | 'custom'
  tags             String[]       @default([])
  isPublic         Boolean        @default(false)
  starCount        Int            @default(0)
  steps            Json           // ParcourStepDef[]
  defaultObservers String[]       @default([])  // userIds ajoutés VIEWER auto à chaque instance
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  owner     User              @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  instances ParcourInstance[]
  stars     ParcourStar[]
}

// Favori utilisateur (like GitHub stars)
model ParcourStar {
  userId     String
  templateId String
  createdAt  DateTime @default(now())

  user     User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  template ParcourTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@unique([userId, templateId])
}

// Instance = un parcours en cours d'exécution
model ParcourInstance {
  id          String        @id @default(cuid())
  templateId  String
  ownerId     String
  title       String
  refNumber   String?       @unique   // ex: "CYBER-2025-042" (généré à la création)
  status      ParcourStatus @default(IN_PROGRESS)
  priority    String        @default("normal")  // 'low' | 'normal' | 'high' | 'urgent'
  currentStep Int           @default(0)
  dueAt       DateTime?     // deadline globale de l'instance
  data        Json          @default("{}")  // données accumulées par les steps
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  template  ParcourTemplate       @relation(fields: [templateId], references: [id], onDelete: Restrict)
  owner     User                  @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  steps     ParcourStepInstance[]
  documents ParcourDocument[]
  history   ParcourHistory[]
}

model ParcourStepInstance {
  id          String     @id @default(cuid())
  instanceId  String
  stepIndex   Int
  status      StepStatus @default(PENDING)
  assignedTo  String?    // userId (résolu au démarrage de l'étape depuis StepDef.assignedTo)
  completedBy String?    // userId
  completedAt DateTime?
  dueAt       DateTime?  // SLA : calculé à l'activation (now + slaDays)
  remindedAt  DateTime?  // dernière relance envoyée
  notifiedAt  DateTime?  // notification d'assignation envoyée (évite les doublons)
  data        Json?      // réponse formulaire, commentaire validation…

  instance ParcourInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)

  @@unique([instanceId, stepIndex])
}

model ParcourDocument {
  id             String          @id @default(cuid())
  instanceId     String
  stepIndex      Int?
  filename       String
  mimeType       String
  storageKey     String          // clé GCS
  sizeBytes      Int
  classification ParcourDocClass @default(C1)
  encryptedKey   String?         // C3 uniquement : clé AES wrappée par la masterKey serveur
  uploadedBy     String          // userId
  createdAt      DateTime        @default(now())

  instance ParcourInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)
}

// Journal métier lisible dans le cockpit (≠ AuditLog technique)
// Pattern identique à MeetHistory
model ParcourHistory {
  id         String   @id @default(cuid())
  instanceId String
  stepIndex  Int?
  userId     String?
  action     String   // 'started' | 'step_completed' | 'step_rejected' | 'step_skipped' | 'document_added' | 'completed' | 'cancelled'
  comment    String?
  createdAt  DateTime @default(now())

  instance ParcourInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)

  @@index([instanceId, createdAt])
}

// Séquence de numérotation par catégorie (pour refNumber)
model ParcourSeq {
  category String @id
  lastSeq  Int    @default(0)
}

enum ParcourStatus  { IN_PROGRESS COMPLETED REJECTED CANCELLED }
enum StepStatus     { PENDING COMPLETED REJECTED SKIPPED }
enum ParcourDocClass { C0 C1 C2 C3 }
```

### Structure JSON des étapes (dans `ParcourTemplate.steps`)

```typescript
type FormField = {
  id: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox'
  required: boolean
  options?: string[]  // pour 'select'
}

type StepDef = {
  type: 'info' | 'form' | 'document' | 'approval' | 'email'
  title: string
  // Assignation
  assignedTo?:    string   // userId ou email — notifié quand l'étape devient active
  assignedLabel?: string   // libellé affiché si pas d'userId connu ("Responsable RSSI")
  // SLA
  slaDays?:       number   // délai attendu pour compléter l'étape (jours ouvrés)
  reminderDays?:  number   // relance email si pas complétée dans N jours
  // Branchement conditionnel
  skipIf?: {
    field:    string                        // clé dans instance.data (ex: "step_0.urgence")
    operator: 'eq' | 'neq' | 'contains'
    value:    string
  }
  // Spécifique par type
  body?:         string          // 'info' : contenu markdown
  fields?:       FormField[]     // 'form'
  maxClass?:     'C0'|'C1'|'C2'|'C3'  // 'document'
  instructions?: string          // 'document' | 'approval'
  to?:           string          // 'email' : destinataire (ou variable {{submitter.email}})
  subject?:      string          // 'email'
  // Variables email : {{instance.title}}, {{instance.refNumber}}, {{submitter.name}},
  //                   {{submitter.email}}, {{step.data.*}}, {{instance.priority}}
}
```

### Numérotation des instances (`refNumber`)

Format : `${CATEGORY}-${YYYY}-${NNN}` — ex. `CYBER-2025-042`, `ARCHI-2025-007`.

Généré à la création de l'instance via `ParcourSeq` (incrément atomique par catégorie) :
```
SELECT lastSeq + 1 FROM ParcourSeq WHERE category = ? (avec upsert atomique)
```

---

## Classification documentaire C0–C3

Référence : classification Oodrive / pratique courante en entreprise française.

| Niveau | Signification | Contrôle d'accès | Audit | Chiffrement |
|--------|--------------|-----------------|-------|-------------|
| C0 | Public | Aucun | Non | Non |
| C1 | Usage interne | ModuleShare standard | Non | Non (GCS chiffre at-rest par défaut) |
| C2 | Diffusion restreinte | Vérification explicite à chaque accès | Chaque accès → `AuditLog` | Non |
| C3 | Secret / Critique | Idem C2 | Entrée `ParcourHistory` + `AuditLog` (rétention étendue) | AES-256-GCM côté serveur |

**C3 — rétention :** `AuditLog` est purgé à 180j (`retention.ts`). Les accès C3 sont loggés dans `ParcourHistory` (qui vit aussi longtemps que l'instance) pour couvrir les exigences de traçabilité longue durée (5 ans).

**C3 — accès :** le serveur télécharge depuis GCS, déchiffre, et streame au client — pas de signed URL exposée.

---

## Stockage de fichiers (GCS)

- **Upload** : l'API génère une **signed URL en écriture** (15 min) → le client upload directement sur GCS
- **Download C0/C1/C2** : l'API génère une **signed URL en lecture** (expire 15 min) + `AuditLog` si C2
- **Download C3** : stream serveur avec déchiffrement — aucune signed URL exposée

---

## SLA et relances automatiques

Job planifié (pattern `scheduleRetention`) tournant toutes les 24h :
1. Cherche les `ParcourStepInstance` `PENDING` dont `dueAt < now` → notifie l'assigné + l'initiateur
2. Cherche les steps dont `dueAt - reminderDays < now` et `remindedAt` est null ou ancien → envoie un email de relance via `sendParcourStepEmail`, met à jour `remindedAt`

---

## Branchements conditionnels (`skipIf`)

Le moteur évalue `skipIf` au moment d'activer chaque étape. Si la condition est vraie, l'étape passe à `SKIPPED` (entrée dans `ParcourHistory`) et le moteur avance au step suivant. Permet d'avoir un template unique avec des étapes optionnelles selon les réponses précédentes.

---

## Routes API

```
# Templates
GET    /api/parcours/templates                        liste (query: q, category, tags, sort)
POST   /api/parcours/templates                        créer
GET    /api/parcours/templates/:id                    fiche
PUT    /api/parcours/templates/:id                    modifier
DELETE /api/parcours/templates/:id                    supprimer
POST   /api/parcours/templates/:id/star               toggle star
GET    /api/parcours/templates/search                 recherche full-text

# Instances
POST   /api/parcours/instances                        démarrer depuis un template
GET    /api/parcours/instances                        mes instances (filtres: status, priority, role)
GET    /api/parcours/instances/:id                    état + steps + historique
POST   /api/parcours/instances/:id/steps/:idx         compléter / approuver / rejeter une étape
GET    /api/parcours/instances/:id/export/pdf         rapport PDF (Phase 2)

# Documents
POST   /api/parcours/instances/:id/documents/upload-url   signed URL GCS en écriture
POST   /api/parcours/instances/:id/documents              enregistrer après upload
GET    /api/parcours/documents/:docId/url                 signed URL lecture (ou stream C3)
DELETE /api/parcours/documents/:docId                     supprimer
```

Partage via `ModuleShare` (module = `'parcours'`), pattern identique à Scrum, Daily, Roadmap.

---

## UI — Pages

| Route | Contenu |
|-------|---------|
| `/parcours` | Dashboard : mes instances en cours (filtrables par priorité/statut) + mes templates |
| `/parcours/templates` | Marketplace : recherche, filtres (catégorie, classification, stars), tri |
| `/parcours/templates/new` | Builder : liste d'étapes drag & drop, config par étape (assignation, SLA, skipIf) |
| `/parcours/templates/:id` | Fiche : aperçu des étapes, bouton star, compteur, bouton "Démarrer" |
| `/parcours/run/:id` | Cockpit : progression, étape courante, documents, journal métier (`ParcourHistory`) |

---

## Fichiers existants à modifier

| Fichier | Modification |
|---------|-------------|
| `apps/api/src/lib/notify.ts` | Ajouter `PARCOURS_STEP_ASSIGNED \| PARCOURS_STEP_COMPLETED \| PARCOURS_STEP_OVERDUE \| PARCOURS_INSTANCE_COMPLETED` à `NotificationType` |
| `apps/api/src/routes/webhooks.ts` | Ajouter `'parcours.instance.completed' \| 'parcours.step.completed'` à `WEBHOOK_EVENTS` |
| `apps/api/src/lib/mailer.ts` | Ajouter `sendParcourStepEmail({ to, subject, body, vars })` avec substitution `{{var}}` |
| `apps/api/src/routes/shares.ts` | Ajouter `parcourTemplate` et `parcourInstance` dans `RESOLVERS` |
| `apps/api/src/routes/hub.ts` | Ajouter compteurs et items récents pour les parcours |
| `packages/shared/src/types/flags.ts` | Ajouter `{ key: 'module.parcours', defaultEnabled: false }` |
| `packages/shared/src/forge/modules.ts` | Ajouter `PARCOURS_MODULE` manifest |
| `apps/api/src/modules/registry.ts` | Ajouter le module dans `API_MODULES` |

---

## Impact architectural

### Verdict : additif, pas de risque structurel

Le module suit exactement les patterns existants (roadmap, daily, scrum). Il n'introduit pas de nouveau paradigme dans le code.

### Ce qui est purement additif

- **Prisma** — 7 nouvelles tables, aucune modification des tables existantes. Migration additive.
- **Module API** — un nouveau dossier `apps/api/src/modules/parcours/`, même structure que `roadmap/`. Un fichier de routes, enregistré dans le registry.
- **8 fichiers modifiés** — tous par ajout (nouveaux types dans des enums, nouvelle entrée dans des dicts). Rien de cassant.
- **Feature flag** `module.parcours` désactivé par défaut — rollout contrôlé, sans impact sur les utilisateurs existants.

### Un seul vrai nouveau composant : GCS

C'est la seule dépendance qui n'existe pas encore. Ça ajoute :
- Le package `@google-cloud/storage`
- Un bucket GCS à créer
- Une identité IAM (Workload Identity sur Cloud Run — pas de clé à gérer, déjà sur GCP)

### Deux points à surveiller

**Streaming C3** — AES-256-GCM nécessite le fichier complet en mémoire pour vérifier le tag d'authentification avant de déchiffrer. La limite pratique = mémoire Cloud Run configurée. Avec 1 GB de RAM sur l'instance (configurable sur GCP), 500 Mo est confortable pour des rapports d'audit ou livrables archi. À définir selon la configuration de l'instance.

**Job SLA en-process** — Tourne en-process comme `retention.ts`. Pour une app B2B avec trafic en heures de bureau, Cloud Run ne scale pas à 0 en journée — le job tournera. Pas besoin de Cloud Scheduler.

### Ce qui n'est pas un problème

- **`steps` en JSON** — même pattern que `Activity.config`, `Board.enabledActivities`. OK pour la volumétrie actuelle.
- **`starCount` dénormalisé** — à implémenter avec `prisma.$transaction` + `increment` pour éviter les race conditions (ou compté à la volée depuis `ParcourStar`).
- **Pas de Socket.io** — le module n'en a pas besoin pour le MVP.

---

## Phasage

### Phase 1 — Moteur (MVP)

- Migration Prisma (tous les modèles ci-dessus)
- Steps : `info`, `form`, `document`
- Assignation simple (`assignedTo` visible dans le cockpit)
- `ParcourHistory` (journal métier)
- Numéro de référence automatique (`refNumber`)
- API CRUD templates + instances + steps
- GCS : upload signé + accès signé (C0/C1)
- UI : builder template, dashboard, cockpit instance

### Phase 2 — Interactions et conformité

- Steps `approval` + `email` (avec `sendParcourStepEmail`)
- Branchements conditionnels (`skipIf`)
- SLA + relances automatiques (job 24h)
- Classification C2 (audit log à chaque accès) + C3 (chiffrement + rétention via `ParcourHistory`)
- Notifications Pivot (nouveaux types)
- Rôle observateur (`defaultObservers`)
- Priorité + filtres dashboard
- Partage d'instance via ModuleShare

### Phase 3 — Marketplace et analytics

- `isPublic` + stars + recherche full-text
- Export PDF d'instance complétée (rapport formel)
- Métriques : temps moyen par étape, taux de rejet, backlog
- Étapes parallèles (N valideurs simultanés, continuer quand M/N ont approuvé)
- Webhooks `parcours.*` (intégration SI externe : JIRA, ServiceNow…)
- Commentaires / demandes de clarification sur une étape
- Sous-workflows (un parcours en déclenche un autre via le bus)
