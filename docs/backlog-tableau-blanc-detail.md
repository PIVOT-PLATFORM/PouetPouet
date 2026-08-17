# Tableau blanc collaboratif — Spécification technique détaillée & critères d'acceptation

> **Objet** : document compagnon de [`backlog-tableau-blanc.md`](./backlog-tableau-blanc.md), à la maille la plus fine. Là où le premier document répond à « qu'est-ce que l'utilisateur peut faire ? » (Épics/Features/US), celui-ci répond à « **comment exactement** » : contrats de données exacts, contrats d'API (REST + temps réel) champ par champ, formules et constantes numériques exactes, et critères d'acceptation Gherkin pour les mécaniques à logique métier non triviale.
>
> **Usage recommandé** : ce document sert de **spécification de réimplémentation** — tout ce qu'il faudrait savoir pour reconstruire le module à l'identique ailleurs, y compris ses comportements non documentés, ses incohérences internes et ses garanties manquantes (listées explicitement en §6, pas cachées).
>
> **Méthode** : extraction verbatim depuis le code source (pas de reformulation sur les valeurs numériques/noms de champs), organisée selon les mêmes 10 Épics que le document parent pour traçabilité croisée.
>
> **Convention Gherkin** : `Étant donné` (Given) / `Quand` (When) / `Alors` (Then). Les scénarios documentent aussi bien le chemin nominal que les cas limites et les refus **silencieux** (le module board ne renvoie quasiment aucune erreur explicite côté temps réel — un refus se traduit le plus souvent par « rien ne se passe », ce qui est documenté comme comportement attendu, pas comme un manque).

---

## Table des matières

1. [Modèle de données — contrat exact](#1-modèle-de-données--contrat-exact)
2. [API REST — contrat exact par route](#2-api-rest--contrat-exact-par-route)
3. [Temps réel (Socket.io) — contrat exact par événement](#3-temps-réel-socketio--contrat-exact-par-événement)
4. [Mécaniques UI — formules et constantes exactes](#4-mécaniques-ui--formules-et-constantes-exactes)
5. [Critères d'acceptation Gherkin — mécaniques à logique métier](#5-critères-dacceptation-gherkin--mécaniques-à-logique-métier)
6. [Registre des incohérences, limites et comportements non garantis](#6-registre-des-incohérences-limites-et-comportements-non-garantis)
7. [Constantes — table de référence unique](#7-constantes--table-de-référence-unique)

---

## 1. Modèle de données — contrat exact

Source : `apps/api/prisma/schema.prisma`. Retranscription verbatim des modèles et enums (noms de champs, types, valeurs par défaut, contraintes, relations `onDelete`).

### 1.1 `Board`

```prisma
model Board {
  id                String    @id @default(cuid())
  name              String
  description       String?
  coverImage        String?
  maxParticipants   Int?
  enabledActivities Json?
  ownerId           String
  shareToken        String?   @unique
  shareLinkRole     BoardRole @default(VIEWER)
  templateDraftOf   String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  owner        User               @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  cards        Card[]
  connections  CardConnection[]
  frames       Frame[]
  fields       BoardField[]
  sessions     Session[]
  shares       BoardShare[]
  voteSessions BoardVoteSession[]
  favorites    BoardFavorite[]
}
```
- Aucun `@@index` ni `@@unique` composite (à part `shareToken` unique champ-à-champ).
- `templateDraftOf` : String libre, **pas de FK Prisma déclarée** vers `BoardTemplate.id` — relation gérée uniquement en code (`findFirst`/`deleteMany`).
- Suppression du `User` propriétaire → cascade sur le `Board` entier (et donc tout son contenu, transitivement).

### 1.2 `BoardShare`

```prisma
model BoardShare {
  id        String    @id @default(cuid())
  boardId   String
  userId    String
  role      BoardRole @default(VIEWER)
  createdAt DateTime  @default(now())

  board Board @relation(fields: [boardId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([boardId, userId])
}
```

### 1.3 `BoardFavorite`

```prisma
model BoardFavorite {
  id        String   @id @default(cuid())
  userId    String
  boardId   String
  createdAt DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  board Board @relation(fields: [boardId], references: [id], onDelete: Cascade)

  @@unique([userId, boardId])
}
```

### 1.4 `BoardTemplate`

```prisma
model BoardTemplate {
  id                String   @id @default(cuid())
  name              String
  description       String?
  coverImage        String?
  maxParticipants   Int?
  enabledActivities Json?
  isFavorite        Boolean  @default(false)
  ownerId           String
  cards             Json
  frames            Json
  connections       Json
  fields            Json
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  owner User @relation(fields: [ownerId], references: [id], onDelete: Cascade)
}
```
- `cards`/`frames`/`connections`/`fields` : blobs `Json` (**snapshot dénormalisé**, aucune FK vers les tables réelles `Card`/`Frame`/`CardConnection`/`BoardField`). Aucun index.

### 1.5 `Card`

```prisma
model Card {
  id         String   @id @default(cuid())
  boardId    String
  type       CardType @default(TEXT)
  content    String
  meta       Json?
  posX       Float    @default(0)
  posY       Float    @default(0)
  width      Float    @default(192)
  height     Float    @default(128)
  color      String   @default("#FFEB3B")
  groupId    String?
  groupColor String?
  locked     Boolean  @default(false)
  layer      Int      @default(1)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  board           Board            @relation(fields: [boardId], references: [id], onDelete: Cascade)
  connectionsFrom CardConnection[] @relation("ConnectionFrom")
  connectionsTo   CardConnection[] @relation("ConnectionTo")
  fieldValues     CardFieldValue[]
}
```
- Aucun `@@index([boardId])` ni sur `groupId`.
- `meta` (Json?) : cache OpenGraph (`title`/`description`/`image`/`siteName`), rempli en asynchrone après création/mise à jour.
- Dimensions par défaut : **192 × 128**. Couleur par défaut : **`#FFEB3B`** (jaune post-it).

### 1.6 `Frame`

```prisma
model Frame {
  id        String   @id @default(cuid())
  boardId   String
  title     String   @default("Cadre")
  posX      Float    @default(0)
  posY      Float    @default(0)
  width     Float    @default(400)
  height    Float    @default(300)
  color     String   @default("#E0E7FF")
  active    Boolean  @default(false)
  layer     Int      @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  board Board @relation(fields: [boardId], references: [id], onDelete: Cascade)
}
```
- Dimensions par défaut : **400 × 300**. Titre par défaut : `"Cadre"`. Couleur par défaut : **`#E0E7FF`**.
- **Aucun champ `locked`** sur `Frame` (contrairement à `Card`) — un cadre n'est jamais verrouillable.

### 1.7 `BoardField` / `CardFieldValue`

```prisma
model BoardField {
  id        String    @id @default(cuid())
  boardId   String
  name      String
  emoji     String?
  type      FieldType @default(TEXT)
  options   Json?
  order     Int       @default(0)
  createdAt DateTime  @default(now())

  board  Board            @relation(fields: [boardId], references: [id], onDelete: Cascade)
  values CardFieldValue[]
}

model CardFieldValue {
  id      String @id @default(cuid())
  cardId  String
  fieldId String
  value   String

  card  Card       @relation(fields: [cardId], references: [id], onDelete: Cascade)
  field BoardField @relation(fields: [fieldId], references: [id], onDelete: Cascade)

  @@unique([cardId, fieldId])
}
```
- Le type Prisma exact est `FieldType` (**pas** `BoardFieldType`).
- Suppression d'une `Card` **ou** d'un `BoardField` → cascade sur `CardFieldValue`.

### 1.8 `CardConnection`

```prisma
model CardConnection {
  id        String   @id @default(cuid())
  boardId   String
  fromId    String
  toId      String
  label     String?
  color     String?
  shape     String   @default("curved")
  arrow     String   @default("none")
  dashed    Boolean  @default(false)
  width     Float    @default(2)
  createdAt DateTime @default(now())

  board Board @relation(fields: [boardId], references: [id], onDelete: Cascade)
  from  Card  @relation("ConnectionFrom", fields: [fromId], references: [id], onDelete: Cascade)
  to    Card  @relation("ConnectionTo", fields: [toId], references: [id], onDelete: Cascade)
}
```
- ⚠️ `shape` et `arrow` sont des **`String` libres** (défauts `"curved"` / `"none"`) — **aucun enum Prisma `ConnectionShape`/`ConnectionArrow` n'existe**. Les valeurs autorisées (droit/courbe/orthogonal, aucune/début/fin/deux) sont une convention purement applicative côté client, non contrainte en base.
- ⚠️ **Aucune contrainte `@@unique`** — l'anti-doublon bidirectionnel n'est garanti qu'en code (voir §3, `connection:create`), pas en base.

### 1.9 `BoardVoteSession` / `BoardVote`

```prisma
model BoardVoteSession {
  id             String     @id @default(cuid())
  boardId        String
  status         VoteStatus @default(ACTIVE)
  votesPerPerson Int        @default(3)
  timerSeconds   Int?
  timerEndsAt    DateTime?
  voterIds       String[]
  createdAt      DateTime   @default(now())
  closedAt       DateTime?

  board Board       @relation(fields: [boardId], references: [id], onDelete: Cascade)
  votes BoardVote[]
}

model BoardVote {
  id        String   @id @default(cuid())
  sessionId String
  cardId    String
  userId    String
  createdAt DateTime @default(now())

  session BoardVoteSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  user    User             @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```
- `voterIds` : `String[]` (pas de table de jointure).
- ⚠️ `BoardVote.cardId` est une **String simple sans `@relation`** vers `Card` — **aucun `onDelete` en cascade** : supprimer une carte votée laisse les lignes `BoardVote` orphelines (contrairement à `CardConnection`/`CardFieldValue` qui, eux, cascadent).
- ⚠️ **Aucun `@@unique([sessionId, cardId, userId])`** — voir §5.3 pour l'implication exacte sur le quota de vote.

### 1.10 Enums (verbatim, exhaustif)

```prisma
enum BoardRole {
  VIEWER
  EDITOR
  OWNER // co-propriétaire via partage ; Board.ownerId reste le créateur (non rétrogradable)
}

enum CardType {
  TEXT
  IMAGE
  LINK
  SHAPE
  DRAW
  LABEL
  TABLE
}

enum FieldType {
  TEXT
  NUMBER
  DATE
  SELECT
}

enum VoteStatus {
  ACTIVE
  CLOSED
}
```
Noms réels à retenir pour une réimplémentation : **`FieldType`** (pas `BoardFieldType`), **`VoteStatus`** (pas `VoteSessionStatus`). Il n'existe **aucun** enum `ConnectionShape`/`ConnectionArrow`.

---

## 2. API REST — contrat exact par route

Fichiers : `apps/api/src/modules/pouetpouet/boards.routes.ts` (prefix `/api/boards`) et `templates.routes.ts` (prefix `/api/templates`).

### 2.1 Règles transversales

- **Auth** (`preHandler: app.authenticate` sur tout le plugin) : JWT (cookie ou `Authorization: Bearer`) **ou** clé API (header `X-API-Key`, hash SHA-256 comparé à `ApiKey.keyHash`, rejetée si `expiresAt < now`). Échec JWT → réponse déléguée à fastify/jwt (401 typique). Échec clé API → 401 explicite (`Clé API invalide ou expirée.` / `Utilisateur introuvable.`).
- **Validation invalide (ZodError)** → handler d'erreur global : **400** `{ error: 'Requête invalide', details: err.issues }`. Aucune route board n'attrape ZodError localement.
- **Rate-limit global** : `@fastify/rate-limit` enregistré **seulement si `NODE_ENV === 'production'`** ; en dev/test les `config: { rateLimit }` déclarés par route sont donc **inertes**. `skipOnError: true` (Redis injoignable → la requête passe). Réponse 429 : `{ statusCode: 429, error: 'Too Many Requests', message: 'Trop de requêtes. Réessayez dans N secondes.' }`.
- **Le créateur du board (`ownerId`) n'a jamais de ligne `BoardShare`** — aucune route ne peut donc le rétrograder ni révoquer son accès (aucune fonction n'écrit sur `board.ownerId` après création).

### 2.2 Board — CRUD & liste

| Route | Payload | Autorisation | Codes | Effets de bord |
|---|---|---|---|---|
| `GET /api/boards/` | — | tout utilisateur | 200 | Fusion `owned` (`ownerId=id AND templateDraftOf:null`) + `shared` (`BoardShare.userId=id`), triés `updatedAt desc`, enrichis `role`/`shareCount`/`isFavorite`. **Brouillons de template invisibles ici même pour leur propriétaire.** |
| `GET /api/boards/presence` | — | tout utilisateur | 200 | `{[boardId]: count}` via `io.in('board:{id}').fetchSockets()`, dédupliqué par `socket.data.userId`. `{}` si `io` non initialisé. |
| `POST /api/boards/` | `boardSchema` : `name:string().min(1)` (requis) ; `description?`, `coverImage?:nullable`, `maxParticipants?:int().positive().nullable()`, `enabledActivities?:array(string()).nullable()`, `templateId?:string()` | si `templateId` : doit appartenir à l'appelant | 404 `Template introuvable` · 403 `Accès refusé` · 201 | Si `templateId` : clone séquentiel des cartes (`for await`, `cardIdMap`), `createMany` frames/champs, connexions remappées+filtrées. Retour enrichi `role:'OWNER', shareCount:0, isFavorite:false`. |
| `PATCH /api/boards/:id` | `boardUpdateSchema` (tous champs optionnels, mêmes contraintes, sans `templateId`) | `isBoardOwner` (créateur **ou** co-owner share) | 404 · 403 · 200 | Update partiel (`!== undefined` seulement). Aucune notif, aucun bus. |
| `DELETE /api/boards/:id` | — | `isBoardOwner` | 403 · 404 · **204** | Capture `BoardShare.userId` avant delete ; cascade Prisma totale ; notifie **chaque ancien membre partagé** (`BOARD_DELETED`, pas le owner). |
| `POST /api/boards/:id/favorite` | — | tout rôle (`getUserBoardRole !== null`) | 403 · 200 `{isFavorite:true}` | `upsert` idempotent. |
| `DELETE /api/boards/:id/favorite` | — | **aucune vérification de rôle** | 200 `{isFavorite:false}` toujours | `deleteMany` (no-op silencieux si absent). |
| `POST /api/boards/join` | `{token:string()}` | — | 404 `Lien invalide ou expiré` · 200 `{boardId, role}` | Si `ownerId===userId` → renvoie `OWNER` sans upsert. Sinon `boardShare.upsert(create.role = board.shareLinkRole, update:{})` — **ne rétrograde/promeut jamais un membre déjà présent.** |
| `GET /api/boards/:id` | — | calcul inline du rôle | 403 · 404 · 200 | Board + `cards` (avec `fieldValues`) + `role`. **Ne charge pas** `frames`/`connections`/`fields` (chargement séparé côté client). |
| `GET /api/boards/:id/members` | — | tout rôle | 403 · 200 | `[{id,name,avatar,role:'OWNER'}, ...shares]` — créateur toujours en tête, rôle forcé `OWNER`. |

### 2.3 Partage

| Route | Payload | Autorisation | Règles fines | Codes | Notif |
|---|---|---|---|---|---|
| `GET /:id/shares` | — | `canManageShares` (OWNER ou EDITOR) | — | 403 (VIEWER) · 200 `{shares, shareToken, shareLinkRole}` | — |
| `POST /:id/shares/link` | `{role: enum(['VIEWER','EDITOR']).default('VIEWER')}` — **`OWNER` rejeté par le zod enum lui-même** | `isBoardOwner` **uniquement** (EDITOR exclu) | Régénère `shareToken = randomBytes(16).toString('hex')` (32 car. hex), **écrase** l'ancien token | 403 · 200 | — |
| `PATCH /:id/shares/link` | `{role: enum(['VIEWER','EDITOR'])}` requis | `isBoardOwner` | Ne change que `shareLinkRole`, token inchangé | 403 · 200 | — |
| `DELETE /:id/shares/link` | — | `isBoardOwner` | `shareToken=null` (désactive, ne révoque pas les accès déjà accordés) | 403 · **204** | — |
| `POST /:id/shares/invite` | `{email:string().email(), role: enum(['VIEWER','EDITOR','OWNER']).default('VIEWER')}` | `canManageShares` | 1) EDITOR+`role='OWNER'` → 403 `Un éditeur ne peut pas attribuer le rôle propriétaire` · 2) 404 si email inconnu · 3) 400 si auto-invitation · 4) 400 si email = créateur du board | 403 · 404 · 400 · 201 | `BOARD_SHARED` si pas de share existant ; `ROLE_CHANGED` si rôle différent d'un share existant ; **rien** si même rôle |
| `PATCH /:id/shares/:shareId` | `{role: enum(['VIEWER','EDITOR','OWNER'])}` requis | `canManageShares` | EDITOR : ne peut ni attribuer `OWNER` ni modifier une cible déjà `OWNER` (403 dans les deux cas) | 403 · 200 | `ROLE_CHANGED` **systématique** (pas de comparaison avec l'ancien rôle, contrairement à `invite`) |
| `DELETE /:id/shares/:shareId` | — | `canManageShares` | EDITOR ne peut pas révoquer une cible `OWNER` (403) | 403 · **204** | `ACCESS_REVOKED` |

⚠️ **`PATCH`/`DELETE /:id/shares/:shareId` ne vérifient pas `targetShare.boardId === id`** — voir §6.1.

Labels FR utilisés dans les corps de notification : `{VIEWER:'lecteur', EDITOR:'éditeur', OWNER:'propriétaire'}`.

### 2.4 Import Klaxoon & undo

**`POST /api/boards/:id/import/klaxoon`**
- `bodyLimit: 50 * 1024 * 1024` (**50 Mo exact**, Fastify natif, actif indépendamment de `NODE_ENV`) → dépassement = **413**.
- Rate-limit : `max:5, timeWindow:'1 minute'` (actif seulement en production, cf. §2.1).
- Autorisation : `role && role !== 'VIEWER'` (OWNER/EDITOR).
- Schéma body (zod, verbatim) :
  ```
  cards: [{
    klxId: string(), type: enum(['TEXT','LABEL','DRAW','IMAGE','SHAPE']),  // pas 'LINK', pas 'TABLE'
    content: string(), color: string(),
    posX/posY/width/height/zIndex: number(), locked: boolean(),
    groupKey: string().nullish(),
    fieldValues?: [{ field: string().min(1).max(120), value: string().max(2000) }]
  }]
  connections: [{ fromKlxId, toKlxId: string(), shape, color, arrow, label: string(), width: number(), dashed: boolean() }]
  frames?: [{ title: string(), posX/posY/width/height: number() }]
  fields?: [{ name: string().min(1).max(120), type: enum(['TEXT','SELECT']), options: array(string().max(200)).nullable() }]
  ```
- **Anti-collision (formule exacte)** :
  - `bottom = max(existing.posY + existing.height)` sur cartes+frames existants confondus.
  - `importTop = min(posY)` sur cartes ET frames du payload.
  - Si board non vide **et** import non vide → `offsetY = round(bottom + 120 - importTop)` (marge fixe **120**), appliqué à `posY` de chaque carte/frame importée (**pas de décalage en X**).
  - Board vide → `offsetY = 0`.
  - *Exemple vérifié* : existant `posY=40,height=96` → `bottom=136` ; import `posY=40` → `offsetY = round(136+120-40) = 216` → carte importée à `posY=256`.
- **Remapping** : cartes créées séquentiellement (`for await`, pas `createMany`, pour récupérer chaque id généré) → `idMap`. Groupes : nouveau `randomUUID()` par `groupKey` Klaxoon distinct (jamais fusionné avec un groupe existant). Connexions filtrées par `idMap.has(from) && idMap.has(to)` (silencieux si absent). Champs : **réutilisation par nom insensible à la casse** (`name.toLowerCase()` matché contre les `BoardField` existants) ; sinon créé avec `order = boardFields.length++`. Valeurs de champs : `createMany({skipDuplicates:true})`.
- Effets de bord : `io.to('board:{id}').emit('board:imported', {cards, connections, frames, fields})` (objets complets) + `bus.publish({type:'pouetpouet.board.imported', ...})` → déclenche `deliverWebhooks('board.imported', ...)`. **Aucune notification `notify()`** envoyée aux autres membres (le type `BOARD_IMPORTED` existe dans l'enum mais n'est utilisé nulle part dans ce fichier).
- Retour **201** : `{cards, connections, frames: <counts>, cardIds, connectionIds, frameIds: <string[]>}` — ce sont ces 3 tableaux qui font foi pour l'undo (aucune table `ImportBatch` persistée).

**`POST /api/boards/:id/import/undo`**
- Autorisation identique à l'import.
- Schéma : `{cardIds: array(string()).max(10000).default([]), connectionIds: array(string()).max(10000).default([]), frameIds: array(string()).max(1000).default([])}` — **limites exactes : 10 000 / 10 000 / 1 000**.
- ⚠️ Aucune vérification de provenance : le serveur fait confiance totale à la liste d'ids fournie par le client, sauf le scoping `id IN (...) AND boardId = :id`.
- Effet : 3 `deleteMany` en `$transaction`. Cascade Prisma (delete Card → cascade CardConnection/CardFieldValue) peut faire que le `deleteMany` explicite sur `connectionIds` compte 0 si déjà supprimées par la cascade.
- **Les `BoardField` créés par l'import ne sont jamais supprimés** (conservation intentionnelle, commentée dans le code).
- Émission : `board:import-undone` avec les ids **demandés** (pas les ids effectivement supprimés).
- Retour **200** (pas 204) : `{cards, connections, frames: <counts réellement supprimés>}`.

### 2.5 Templates & brouillon

| Route | Détail exact |
|---|---|
| `GET /api/templates/` | `ownerId=id`, `orderBy:[{isFavorite:'desc'},{updatedAt:'desc'}]`. Strictement privé (pas de partage de template). |
| `POST /api/templates/` | `templateCreateSchema` (+`fromBoardId?`). Si fourni : `board.ownerId !== userId` → 403 (**vérification stricte sur `Board.ownerId`, pas `isBoardOwner`** — un co-owner par share ne peut pas snapshotter). Snapshot brut (**ids originaux conservés** dans le JSON, contrairement au clonage template→board qui remape). Héritage cascade des métadonnées si `undefined` (vs `null` explicite = pas hérité). |
| `PATCH /api/templates/:id` | `templateUpdateSchema` + `isFavorite?`. Owner uniquement. |
| `DELETE /api/templates/:id` | Owner uniquement. **N'affecte pas** les boards déjà créés depuis ce template (pas de FK persistée). |
| `POST /:id/edit-content` | Cherche un brouillon existant (`ownerId+templateDraftOf`) → réutilisé tel quel si trouvé (**pas de re-sync depuis le template**). Sinon crée `Board{name:'[Template] '+tpl.name, templateDraftOf:id}` + clone (⚠️ omet `frame.active`, contrairement au clone `POST /boards/`). Retour **200** toujours (jamais 201). |
| `POST /:id/save-from-draft` | 404 `Aucun brouillon trouvé` si absent. Relit l'état vivant du brouillon (pas le JSON) → `update` template (name sans préfixe `[Template] `, régen du snapshot JSON avec les ids réels du brouillon) → **`board.delete` du brouillon**. |
| `POST /:id/discard-draft` | `deleteMany({ownerId, templateDraftOf:id})`, idempotent, aucune lecture préalable. **204**. |

### 2.6 Votes (lecture)

- `GET /:id/vote/current` : session `status:'ACTIVE'` la plus récente (`createdAt desc`) + `votes`, ou `null`. Tout rôle.
- `GET /:id/vote/last` : idem `status:'CLOSED'`, `orderBy closedAt desc`.

### 2.7 Image de couverture — pas de route dédiée

- **Aucun endpoint serveur d'upload.** `coverImage` transite en `String?` **sans aucune contrainte zod de taille/format**.
- La limite **1,5 Mo** (`1.5 * 1024 * 1024` octets) n'existe que **côté client** (`board-settings-modal.tsx`), en `data:` URL base64 stockée telle quelle en base.
- Côté serveur, seul le `bodyLimit` par défaut de Fastify (non redéfini sur ces routes) s'applique — ce qui bloquerait probablement un payload dépassant 1,5 Mo avant même la validation applicative, avec un **413 générique** (pas le message métier « Fichier trop volumineux »).

---

## 3. Temps réel (Socket.io) — contrat exact par événement

Fichiers : `apps/api/src/modules/pouetpouet/board.sockets.ts` (namespace de room `board:{boardId}`) et `vote.sockets.ts`. Deux gardes de rôle réutilisées partout : `canWrite` (OWNER ou EDITOR) et `canAccess` (tout rôle présent dans `socket.data.boardRoles`, y compris VIEWER).

**Convention de lecture** : « room entière » = `io.to('board:{id}').emit(...)` (émetteur inclus) ; « room sauf émetteur » = `socket.to('board:{id}').emit(...)`.

### 3.1 Connexion & état initial

| Event (client→serveur) | Payload | Effet |
|---|---|---|
| `board:join` | `{boardId}` | Résout le rôle (`ownerId` ou `BoardShare`). Sans rôle → `board:error` (`'Accès refusé'` ou `'Board introuvable'`) à l'émetteur seul. Sinon : `board:state` `{cards, connections, frames, fields, role}` à l'émetteur ; rejeu de `card:editing` pour chaque édition en cours ; rejeu de `timer:started {endsAt, serverNow}` si un timer est actif ; ajout à la présence Redis (TTL **3600 s**, clé `board:presence:{boardId}`, hash) → broadcast `board:presence` à toute la room. |
| `board:leave` / `disconnect` | — | Retrait de la présence → `board:presence` (room entière) ; libération de toute édition en cours par ce socket → `card:editing {cardId,userId,editing:false}` **sans `name`** (room entière, pas `socket.to`). |

### 3.2 Curseurs (throttlés)

| Event | Payload | Détail |
|---|---|---|
| `board:cursor` (client→serveur) | `{boardId, x, y}` | Écrit dans un buffer serveur par `(boardId,userId)`, **écrase** la position précédente (dernier arrivé gagne, pas de queue). Requiert `userInfo` + un rôle sur ce board, sinon return silencieux. |
| `board:cursors` (serveur→client) | `CursorUpdate[]` | Flush **toutes les 50 ms (20 Hz)** via un `setInterval` **global partagé entre tous les boards**, à toute la room (émetteur inclus). Le timer démarre au premier curseur reçu et **s'auto-arrête** si un tick ne trouve aucun buffer non vide (pas de tourne-à-vide permanent). |

### 3.3 Verrou doux d'édition

| Event | Payload | Détail |
|---|---|---|
| `card:editing` (client→serveur) | `{cardId, boardId, editing:boolean}` | Requiert un rôle (tout rôle, pas `canWrite`). **Aucune écriture DB** — état en mémoire (`socket.data.editingCards`). |
| `card:editing` (serveur→client) | `{cardId,userId,name,editing}` | Room **sauf émetteur**. Libéré au blur explicite, à `board:leave`, ou au `disconnect` (dans ce dernier cas, événement **sans `name`**, room entière). |
| — | — | **Aucune garde serveur n'empêche deux utilisateurs de déclarer `editing:true` simultanément** sur la même carte — verrou purement informatif, pas un lock exclusif. |

### 3.4 Cartes

| Event (C→S) | Payload | Garde | Écriture DB | Broadcast (portée) |
|---|---|---|---|---|
| `card:create` | `{boardId, content, posX, posY, color?, type?, width?, height?, layer?, clientTag?}` | `canWrite` | `card.create` — si `type` fourni hors de `{TEXT,IMAGE,LINK,SHAPE,DRAW,LABEL,TABLE}` → champ retiré, retombe sur défaut `TEXT` | `card:created` (**room entière**), `clientTag` ré-attaché si fourni (non persisté) |
| `card:move` | `{id, boardId, posX, posY}` | `canWrite` | `updateMany({where:{id,boardId,locked:false}})` — garde verrou **dans le `where`**, `count=0` silencieux si verrouillée | `card:moved` **si `count>0`**, room **sauf émetteur** |
| `card:resize` | `{id, boardId, width, height}` | `canWrite` | idem move | `card:resized` si `count>0`, room **sauf émetteur** |
| `card:update` | `{id, boardId, content}` | `canWrite` | idem (garde verrou dans `where`) | `card:updated` si `count>0`, **room entière** (⚠️ incohérent avec move/resize) |
| `card:delete` | `{id, boardId}` | `canWrite` + lecture préalable `locked` (garde **explicite**, pas dans le where) | `delete` tolérant P2025 | `card:deleted` (id brut, room entière) si effectif ; **dissolution de groupe** si `remaining.length===1` après suppression → `cards:ungrouped` |
| `card:recolor` | `{id, boardId, color}` | `canWrite` | `updateMany(...locked:false)` | `card:recolored` room entière si `count>0` |
| `card:lock` | `{ids:string[], boardId, locked}` (**en masse**) | `canWrite` | `updateMany({id:{in:ids},boardId})` — **pas de filtre `locked:false`** (verrouiller doit marcher même sur du déjà-verrouillé) | `cards:locked` **inconditionnel**, room entière (même si 0 lignes affectées) |
| `card:layer` | `{id, boardId, layer}` | `canWrite` | `update` (pas `updateMany`) — **aucune garde `locked`** | `card:layered` room entière si succès |

Effet secondaire asynchrone commun à `card:create`/`card:update` : fetch OpenGraph non bloquant si `type==='LINK'` (content non vide) ou `type==='TEXT'` avec URL détectée (regex `/https?:\/\/[^\s<>"']+/`) → `card:meta_updated {id, meta}` room entière. Sur `card:update`, si le texte n'a plus d'URL, `meta` est explicitement remis à `null` et l'event émis quand même.

### 3.5 Groupes

| Event | Payload | Garde | Détail |
|---|---|---|---|
| `cards:group` | `{boardId, cardIds}` | `canWrite` | `groupId = randomUUID()`, écrase sans vérifier un groupe préexistant. Broadcast **inconditionnel** `cards:grouped {cardIds,groupId}`. |
| `cards:ungroup` | `{boardId, groupId}` | `canWrite` | `updateMany({groupId:null})`. Broadcast inconditionnel `cards:ungrouped` (groupId brut). |
| `cards:group-color` | `{boardId, groupId, color}` | `canWrite` | Broadcast inconditionnel `cards:group-colored {groupId,color}`. |

### 3.6 Connexions

| Event | Payload | Garde/logique | Broadcast |
|---|---|---|---|
| `connection:create` | `{boardId, fromId, toId}` | `canWrite` ; **anti auto-lien** (`fromId===toId` → return) ; **anti-doublon bidirectionnel** (`findFirst` sur `{fromId,toId} OU {toId,fromId}` → return silencieux si trouvé) ; ⚠️ aucune vérification que `fromId`/`toId` existent réellement | `connection:created` (objet complet), room entière |
| `connection:delete` | `{id, boardId}` | `canWrite`, tolérant P2025 | `connection:deleted` (id brut), room entière si effectif |
| `connection:update` | `{id, boardId, label?, color?, shape?, arrow?, dashed?, width?}` (**patch partiel**) | `canWrite` ; champs inclus seulement si `!== undefined` (permet `label:null` explicite = effacement) ; **patch vide → return silencieux, aucune écriture** | `connection:updated` (objet complet), room entière si effectif |

### 3.7 Cadres

| Event | Payload | Garde | Broadcast (portée) |
|---|---|---|---|
| `frame:create` | `{boardId, posX, posY, title?, color?, width?, height?}` | `canWrite` **+ garde dure** `frame.count({boardId}) >= MAX_FRAMES_PER_BOARD` (**= 2**) → return silencieux | `frame:created` room entière |
| `frame:move` | `{id, boardId, posX, posY}` | `canWrite`, **pas de filtre `boardId` dans le where**, pas de notion de verrou (Frame n'a pas `locked`) | `frame:moved` room **sauf émetteur** |
| `frame:resize` | `{id, boardId, width, height}` | idem | `frame:resized` room **sauf émetteur** |
| `frame:update` | `{id, boardId, title?, active?}` | `canWrite`, patch partiel (pas de garde patch-vide, contrairement à `connection:update`) | `frame:updated` **room entière** (⚠️ incohérent avec move/resize) |
| `frame:delete` | `{id, boardId}` | `canWrite` | `frame:deleted` (id brut) room entière |
| `frame:layer` | `{id, boardId, layer}` | `canWrite` | `frame:layered` room entière |

### 3.8 Reset du board

| Event | Garde | Détail |
|---|---|---|
| `board:reset` | ⚠️ **`socket.data.boardRoles?.[boardId] !== 'OWNER'` strict** — ni EDITOR ni VIEWER, contrairement à `canWrite` qui accepte EDITOR ailleurs | Transaction Prisma atomique : `deleteMany` connexions → cartes → cadres (ordre FK). **Ne touche PAS** `BoardField`/`CardFieldValue`/`BoardVoteSession`/`BoardVote` — ces derniers survivent à un reset. Broadcast **inconditionnel** `board:resetted` (aucun payload), room entière. |

### 3.9 Champs personnalisés & valeurs

| Event | Payload | Garde | Détail |
|---|---|---|---|
| `boardfield:create` | `{boardId, name, emoji?, type, options?, order?}` | `canWrite` | ⚠️ **`type` non validé contre l'enum** (`as never`) — un type invalide **lève une exception Prisma non catchée** (pas de `ignoreMissing`, pas de try/catch). |
| `boardfield:update` | `{id, boardId, name, emoji?, options?}` | `canWrite` | `name` toujours réécrit (pas de patch partiel réel) ; `type` **non modifiable** par cet event. |
| `boardfield:delete` | `{id, boardId}` | `canWrite` | Cascade Prisma sur `CardFieldValue`, mais **aucun événement dédié n'est émis pour ces valeurs orphelines côté client** — seul `boardfield:deleted` part. |
| `cardfield:set` | `{boardId, cardId, fieldId, value}` | `canWrite` | `upsert` sur clé composite `(cardId,fieldId)` ; tolère explicitement P2003 (FK violation, ex. carte/champ supprimé entre-temps) via `ignoreMissing`. |
| `cardfield:clear` | `{boardId, cardId, fieldId}` | `canWrite` | `deleteMany`, pas de check de `count`, broadcast inconditionnel. |

### 3.10 Timer

| Event | Payload | Détail |
|---|---|---|
| `timer:start` | `{boardId, duration}` (secondes) | `canWrite`. `endsAt = Date.now() + duration*1000` calculé **côté serveur**. Persisté via Redis (`SET key val PX ms`, expiration auto) si `redis.status==='ready'`, sinon `Map` mémoire locale (non partagée entre instances). Broadcast `timer:started {endsAt, serverNow: Date.now()}` room entière — **`serverNow` explicite pour que le client calcule le décalage d'horloge local vs serveur.** `duration<=0` → no-op silencieux. |
| `timer:stop` | `{boardId}` | `canWrite`. `redis.del`/`Map.delete`. Broadcast `timer:stopped` (aucun payload) room entière. |

### 3.11 Votes (`vote.sockets.ts`)

| Event | Payload | Garde | Détail |
|---|---|---|---|
| `vote:start` | `{boardId, votesPerPerson, timerSeconds, voterIds}` | `canWrite` | Ferme d'abord toute session `ACTIVE` existante (`updateMany→CLOSED`) — **sans émettre `vote:session:closed`** pour cette fermeture implicite. `timerEndsAt = timerSeconds ? now+timerSeconds*1000 : null`. Créée avec `votes:[]`. ⚠️ **Aucune validation** de `votesPerPerson>0` ni que `voterIds` correspondent à des membres réels. Broadcast `vote:session:started` (session complète) room entière. |
| `vote:cast` | `{sessionId, boardId, cardId}` | `canAccess` (VIEWER inclus) | Chaîne de gardes silencieuses : userId requis (anonyme sans compte exclu) → session existe et `ACTIVE` → **`timerEndsAt` non expiré selon l'horloge serveur** → `userId ∈ voterIds`. **Quota en transaction `Serializable`** (voir §5.3 pour le détail exact) : conflit de sérialisation → `catch{return}` silencieux, le vote perdant est abandonné sans retry ni erreur renvoyée. ⚠️ Aucune contrainte DB empêchant plusieurs votes du même user sur la **même** carte (seul le total par personne est gardé). Broadcast `vote:updated` (session complète refetchée) room entière si succès. |
| `vote:uncast` | `{sessionId, boardId, cardId}` | `canAccess` | Mêmes gardes (existence/ACTIVE/horloge). `findFirst` puis `delete` d'**un seul** vote (pas `deleteMany`) même si l'utilisateur a voté plusieurs fois pour cette carte. Broadcast `vote:updated`. |
| `vote:extend` | `{sessionId, boardId, extraSeconds}` | `canWrite` | Requiert `timerEndsAt` non-null (sinon no-op silencieux). Base de calcul = `max(timerEndsAt actuel, now)` — **si le timer est déjà expiré, la base redevient l'instant présent** (garantit que `extraSeconds` de temps utile est toujours réellement ajouté). Broadcast `vote:updated`. |
| `vote:stop` | `{sessionId, boardId}` | `canWrite` | ⚠️ **Aucune vérification `status==='ACTIVE'`** avant update — peut re-clôturer une session déjà fermée. ⚠️ **Aucun `ignoreMissing`** : `sessionId` inexistant → P2025 **non catché** (seul cas de tout le module où une exception remonte non gérée). Broadcast `vote:session:closed` (session complète) room entière. |

### 3.12 Messages d'erreur explicites — exhaustif

Le module n'émet quasiment aucune erreur applicative dédiée. Liste complète des cas où un message est réellement envoyé :

| Event | Payload | Déclencheur |
|---|---|---|
| `board:error` | `'Accès refusé'` | `board:join` sans rôle résolu |
| `board:error` | `'Board introuvable'` | `board:join` sur boardId inexistant |

**Tous les autres refus** (`canWrite`/`canAccess` false, `MAX_FRAMES_PER_BOARD`, garde OWNER de `board:reset`, verrou, quota de vote, timer expiré, doublon de connexion, auto-lien) se traduisent par un `return` silencieux : aucun code d'erreur, aucun `*:error` dédié. **« Rien ne se passe » est le comportement attendu et documenté**, à retranscrire tel quel dans les critères d'acceptation (§5).

---

## 4. Mécaniques UI — formules et constantes exactes

Fichiers principaux : `apps/web/src/components/board/board-canvas.tsx`, `board-canvas-alignment.ts`, `apps/web/src/hooks/useBoard.ts`, `apps/web/src/app/(app)/boards/[id]/page.tsx`, `board-card.tsx`, `lib/table-clipboard.ts`.

### 4.1 Zoom

- Bornes statiques : `MIN_ZOOM = 0.1`, `MAX_ZOOM = 3`.
- Borne basse **dynamique** effective (`computeMinZoom`) :
  ```
  pad = 64
  fitAll = min((rect.width - pad*2)/box.w, (rect.height - pad*2)/box.h)
  minZoom = max(0.01, min(MIN_ZOOM, fitAll * 0.6))
  ```
  Recalculée à chaque changement de `cards`/`frames`. Le zoom molette et les boutons zoom utilisent **cette borne**, jamais `MIN_ZOOM` seul.
- Zoom molette (centré sur le curseur) :
  ```
  base = (ctrlKey || metaKey) ? 0.01 : 0.0008
  damp = zoom > 1 ? 1/sqrt(zoom) : 1
  newZoom = clamp(zoom * exp(-deltaY * base * damp), minZoomDynamique, MAX_ZOOM)
  ```
  `setViewport` React différé de **80 ms** après le dernier événement molette.
- Boutons zoom : facteurs exacts **`1/1.25`** (dézoom) / **`1.25`** (zoom), centrés sur le centre du conteneur. Bouton « % » → reset à `zoom:1`, centré idem.
- « Ajuster au contenu » (`fitBox`) :
  ```
  pad = 64
  fit = min((rect.width-pad*2)/box.w, (rect.height-pad*2)/box.h)
  zoom = clamp(fit, minZoomDynamique, min(maxZoomParam, MAX_ZOOM))
  ```
  `fitToContent()` → `maxZoom=1` (jamais >100 %). `fitToSelection()` → `maxZoom=1.5`.
- Auto-fit à l'ouverture : déclenché **une seule fois** si contenu présent, désarmé après **2000 ms**. Contenu masqué (`opacity:0`) jusqu'à stabilisation puis fade-in `transition: opacity 0.2s`.

### 4.2 Grille d'aimantation

- Pas de grille : **`DOT_SPACING = 24`** (px, coordonnées canvas).
- Snap **dur**, aucun rayon de tolérance : `Math.round(x / 24) * 24` (idem Y) — appliqué systématiquement quand actif, pas seulement à proximité d'une ligne.
- Persistance : `localStorage['klx_board_grid']` (`'1'`/`'0'`), **off par défaut**.
- ⚠️ **Grille et guides d'alignement sont mutuellement exclusifs** : si `snapToGrid` actif, le calcul de guides n'est même pas exécuté (grille prioritaire).
- Rendu : quadrillage (`linear-gradient`) si grille active, points (`radial-gradient`) sinon.

### 4.3 Guides d'alignement

- Tolérance : **`ALIGN_SNAP_PX = 6`** pixels **écran**, convertie en coordonnées canvas via `/ zoom` avant comparaison.
- 3 valeurs comparées par axe (pas seulement les bords) :
  ```
  vSelf = [x, x + w/2, x + w]       // gauche, centre, droite
  hSelf = [y, y + h/2, y + h]       // haut, milieu, bas
  ```
  Comparées aux mêmes 3 valeurs de chaque autre carte du board. Un seul meilleur candidat par axe (distance minimale ≤ seuil) → au plus **une ligne verticale + une ligne horizontale**.
- Activation : `alignGuidesEnabled && selectedIds.size <= 1` — **désactivé en multi-sélection**. Cibles = toutes les cartes sauf celle déplacée et sauf type `DRAW`.
- Persistance : `localStorage['klx_board_align']` (`'0'` = désactivé), **actif par défaut**.
- Rendu : ligne **`#ec4899`** (rose), épaisseur `1/zoom` px écran constante, `zIndex:60`.

### 4.4 Redimensionnement multi-sélection (homothétie)

- Ensemble affecté : cartes sélectionnées **+ tous les membres de leur(s) groupe(s)**, cartes verrouillées **exclues**.
- Point d'ancrage = coin **opposé** au coin tiré :
  ```
  anchorX = (corner ∈ {'se','ne'}) ? box.minX : box.maxX
  anchorY = (corner ∈ {'se','sw'}) ? box.minY : box.maxY
  ```
- Facteur d'échelle, borné :
  ```
  diag = hypot(handleX-anchorX, handleY-anchorY) || 1
  smallestDim = max(1, min(min(c.width,c.height) pour chaque carte))
  minFactor = min(1, 24 / smallestDim)              // empêche le plus petit côté de descendre sous ~24px
  factor = clamp(hypot(p.x-anchorX, p.y-anchorY) / diag, minFactor, 20)   // 20 = facteur max codé en dur
  ```
- Formule appliquée à chaque carte de l'ensemble :
  ```
  posX' = anchorX + (posX - anchorX) * factor
  posY' = anchorY + (posY - anchorY) * factor
  width' = width * factor ;  height' = height * factor
  ```
- Émission live throttlée à **60 ms** pendant le drag ; un seul événement d'historique poussé au commit (relâchement).

### 4.5 Undo / Redo

- Profondeur : **`HISTORY_LIMIT = 30`** (pile FIFO tronquée : `[...stack.slice(-(30-1)), entry]`).
- Toute nouvelle action pousse dans `undoStack` et **vide `redoStack`**.
- **Couvert** : `addCard`, `commitDragCard`, `commitResizeSelection`, `commitResizeCard`, `updateCard` (contenu), `deleteCard`, `recolorCard`, `recolorSelected`, `deleteSelected`, `groupSelected`, `ungroupById`, `recolorGroup`, `addConnection`, `deleteConnection`, `updateConnection`, `addFrame`, `commitDragFrame`, `commitResizeFrame`, `updateFrame` (titre), `setFrameActive`, `deleteFrame`, `resetBoard`, `setCardLayer`, `setFrameLayer`, `setLayerSelected`, `setCardPositions` (nudge/arrange), `lockCards`, `pasteCards`.
- ⚠️ **NON couvert** (aucun appel `pushHistory`) : `createField`/`updateField`/`deleteField`, `setFieldValue`/`clearFieldValue`, tout le module vote (`startVote`/`castVote`/…), `startTimer`/`stopTimer`, `updateBoardInfo` (paramètres du board).
- **Comportement en cas de conflit avec une action distante** : chaque entrée d'historique est une closure fermée sur des **valeurs absolues figées** au moment de l'action (pas de timestamp, version, ni merge). `undo()`/`redo()` ré-émettent l'état figé tel quel, ce qui **écrase silencieusement** toute modification distante survenue entre-temps — dernier écrivain gagne, aucune détection de conflit (pas d'OT/CRDT). Pour les créations, l'ID serveur réel est retracké via des queues FIFO dédiées (`pendingCardHistoryRef`, etc.) pour que l'undo cible le bon objet — ceci résout le problème d'identité, **pas** le problème de conflit de contenu.
- Raccourcis : `Ctrl/Cmd+Z` (sans Shift) = undo ; `Ctrl/Cmd+Y` ou `Ctrl/Cmd+Shift+Z` = redo. **Fonctionnent même si le focus est dans un `<input>`/`<textarea>`** (contrairement à la plupart des autres raccourcis).

### 4.6 Verrouillage — matrice exacte de ce qui est bloqué

| Action | Bloquée si `card.locked` ? |
|---|---|
| Déplacement individuel | ✅ (`if (card.locked) return` dans `handleMouseDown`) |
| Suivi en groupe/sélection déplacée | ✅ (exclue explicitement de `followIds`) |
| Redimensionnement individuel | ✅ (poignées masquées + garde handler) |
| Redimensionnement multi-sélection | ✅ (exclue du calcul d'ensemble) |
| Suppression | ✅ (bouton masqué ; `deleteSelected`/`recolorSelected` filtrent via `unlockedSelectedIds()`) |
| Recoloration | ✅ (color picker masqué ; filtré en sélection) |
| Édition / ouverture détail (double-clic) | ✅ |
| **Changement de calque (z-order)** | ❌ **PAS bloqué** — `setLayerSelected` ne filtre pas les cartes verrouillées |
| **Couleur de contour de groupe** | ❌ **PAS bloquée** par carte (agit sur le groupe entier) |
| **Type `DRAW`** | Structurellement **non verrouillable** — exclu de `lockSelected` lui-même (« Drawings can't be locked ») |

⚠️ Le **verrou doux d'édition distante** (`remoteEditor`, §3.3) est un mécanisme **différent** du verrou (`locked`) : il bloque seulement l'ouverture en édition (double-clic), **pas** le drag.

### 4.7 Raccourcis clavier — table exhaustive

Listener global (`page.tsx`), actif seulement si `!isReadonly` :

| Touche | Modif. | Focus requis | Action |
|---|---|---|---|
| `z` | Ctrl/Cmd | Aucun (marche même dans un champ texte) | `undo()` |
| `y` / `z`+Shift | Ctrl/Cmd | Aucun | `redo()` |
| `c` | Ctrl/Cmd | Aucun | copie la sélection → `localStorage['klx_clipboard']` |
| `a` | Ctrl/Cmd | **Hors champ éditable requis** | sélectionne tout |
| `d` | Ctrl/Cmd | idem | duplique la sélection (offset **+24,+24**) |
| Flèches | (+Shift) | idem, `selectedIds.size>0` requis | nudge **1px**, ou **20px avec Shift** |
| `Delete`/`Backspace` | — | idem | supprime la sélection |
| `Escape` | — | idem | outil `select`, désélection, ferme tous les panneaux |
| `v`/`V` | sans Ctrl/Cmd | idem | force l'outil sélection |

Hors listener global : `Espace` maintenu = pan temporaire (ignoré si focus champ, reset au `blur` fenêtre) ; `Ctrl/Cmd+V` = collage interne au niveau de la position souris courante ; `Escape` en mode « relier » = annule la source sélectionnée ou quitte le mode ; `Escape` avec connexion sélectionnée = désélectionne (ignoré si focus champ) ; `Entrée`/`Escape` dans le popover URL = confirme/annule.

### 4.8 Presse-papiers — logique de détection exacte (ordre de priorité)

1. Cellule `TABLE` focalisée + contenu collé reconnu comme tabulaire (`>1` ligne ou `>1` colonne) → **remplit la grille de la carte existante**.
2. Focus dans un champ éditable (hors cas 1) → **rien ne se passe** (`if (inEditable) return`).
3. Fichier image (`item.kind==='file'`, `type` commence par `image/` **ou** extension via regex `/\.(png|jpe?g|gif|webp|bmp)$/i` en repli si le fichier n'a pas de MIME type, ex. copie depuis l'explorateur OS) → carte `IMAGE`, redimensionnée à **`MAX_W=700, MAX_H=600`** (ratio conservé, `min(700/naturalW, 600/naturalH, 1)`).
4. Tableau (Excel/Sheets/HTML) — priorité `text/html` (recherche d'un `<table>`) puis TSV (`text/plain` contenant au moins une tabulation, sinon rejeté comme texte simple) : si une seule carte `TABLE` est sélectionnée → remplit cette carte ; sinon crée une carte `TABLE` dimensionnée `w = clamp(cols*120, 180, 720)`, `h = clamp(16+rows*30, ., 600)`.
5. Texte brut (fallback) → carte `TEXT` avec le texte trimé.
- Presse-papiers interne (`klx_clipboard`, séparé du presse-papiers système) : sérialisé en `localStorage`, chargé au montage, **vidé après collage** (comportement one-shot, pas un presse-papiers persistant multi-collages).

### 4.9 Sélection au lasso

- Déclenchement : `button===0`, outil `select` actif, `toolMode!=='draw'`, cible du mousedown **strictement égale** à l'élément canvas lui-même (clic direct sur le fond, pas sur une carte).
- Rectangle visuel affiché seulement si `w>3 || h>3` pendant le drag.
- Sélection appliquée au relâchement seulement si `w>5 || h>5` (en dessous = simple clic vide = désélection).
- Critère d'intersection = **chevauchement AABB**, pas containment strict :
  ```
  card.posX < rect.x+rect.w && card.posX+card.width > rect.x &&
  card.posY < rect.y+rect.h && card.posY+card.height > rect.y
  ```
  (comportement « à la Miro/Klaxoon » : une carte touchée par le lasso est prise même partiellement, pas seulement si entièrement englobée).

---

## 5. Critères d'acceptation Gherkin — mécaniques à logique métier

*Sélection des mécaniques présentant une logique métier non triviale (races, quotas, cascades, gouvernance). Les mécaniques CRUD simples ne sont pas reprises ici en Gherkin (déjà couvertes en table §2/§3).*

### 5.1 Import Klaxoon — anti-collision et undo

```gherkin
Fonctionnalité : Import Klaxoon sans écraser le contenu existant

Scénario : Import sur un board vide
  Étant donné un board sans aucune carte ni cadre
  Quand j'importe une archive Klaxoon contenant des cartes à posY=40
  Alors les cartes sont créées à posY=40 exactement (offset nul)

Scénario : Import sur un board déjà occupé
  Étant donné un board avec une carte à posY=40, height=96 (bas réel = 136)
  Et aucune autre carte n'atteint un bas plus bas
  Quand j'importe une archive Klaxoon dont la carte la plus haute est à posY=40
  Alors l'offset vertical appliqué est round(136 + 120 - 40) = 216
  Et cette carte importée se retrouve à posY = 256
  Et aucun décalage n'est appliqué en X

Scénario : Import répété du même champ personnalisé (casse différente)
  Étant donné un board dont un champ personnalisé nommé "Porteur" existe déjà
  Quand j'importe une archive Klaxoon contenant un champ nommé "porteur"
  Alors aucun nouveau BoardField n'est créé (réutilisation insensible à la casse)
  Et une nouvelle CardFieldValue est associée au BoardField existant

Scénario : Annulation d'un import
  Étant donné un import venant de créer 12 cartes, 4 connexions, 1 cadre
  Et le client a mémorisé les 3 listes d'ids renvoyées par l'import
  Quand j'annule l'import avec ces 3 listes d'ids
  Alors les 12 cartes, 4 connexions et 1 cadre sont supprimés
  Mais les BoardField créés pendant l'import restent (jamais supprimés par l'undo)

Scénario : Tentative d'annulation avec des ids d'un autre board
  Étant donné une liste d'ids de cartes appartenant à un autre board que celui ciblé
  Quand j'appelle l'undo sur le board courant avec ces ids
  Alors aucune carte n'est supprimée (scoping strict par boardId)
  Et la réponse renvoie cards: 0 sans erreur
```

### 5.2 Verrou dur (`locked`) — matrice complète

```gherkin
Fonctionnalité : Une carte verrouillée résiste à toute mutation sauf le calque

Scénario : Déplacement bloqué, y compris en groupe
  Étant donné une carte A verrouillée, membre d'un groupe avec B et C non verrouillées
  Quand je déplace le groupe entier
  Alors B et C se déplacent
  Mais A reste immobile à sa position d'origine

Scénario : Suppression en masse ignore les cartes verrouillées
  Étant donné une sélection de 3 cartes dont 1 verrouillée
  Quand je supprime la sélection
  Alors les 2 cartes non verrouillées sont supprimées
  Et la carte verrouillée reste présente

Scénario : Le calque n'est pas protégé par le verrou
  Étant donné une carte verrouillée
  Quand je change le calque de toute la sélection incluant cette carte
  Alors le calque de la carte verrouillée change aussi (seule mutation non bloquée par locked)

Scénario : Un dessin ne peut jamais être verrouillé
  Étant donné une carte de type DRAW sélectionnée
  Quand je déclenche l'action "verrouiller" sur la sélection
  Alors la carte DRAW est exclue de l'opération de verrouillage (reste non verrouillée)
```

### 5.3 Quota de vote — course concurrente

```gherkin
Fonctionnalité : Un votant ne peut jamais dépasser son quota, même en cas de double-clic simultané

Contexte technique : la garde est appliquée en transaction Postgres isolation Serializable
  (count courant < votesPerPerson) puis create, dans la même transaction.

Scénario : Vote nominal
  Étant donné une session active avec votesPerPerson=3 et l'utilisateur U dans voterIds
  Et U a déjà 2 votes dans cette session
  Quand U vote pour une carte
  Alors le vote est enregistré (3ᵉ et dernier vote autorisé)

Scénario : Quota atteint
  Étant donné U a déjà consommé ses 3 votes
  Quand U tente un 4ᵉ vote
  Alors la transaction constate count(3) >= votesPerPerson(3) et n'insère rien
  Et aucun événement vote:updated n'est émis pour cette tentative

Scénario : Double-clic quasi simultané (race)
  Étant donné U a 2 votes sur 3 déjà enregistrés
  Quand U envoie deux vote:cast en même temps pour deux cartes différentes
  Alors une seule des deux transactions gagne la sérialisation Postgres
  Et l'autre lève un conflit de sérialisation, catché silencieusement, sans retry ni erreur au client
  Et U se retrouve avec exactement 3 votes au total (jamais 4)

Scénario : Vote après expiration du timer (dérive d'horloge client)
  Étant donné une session avec timerEndsAt dans le passé selon l'horloge SERVEUR
  Et le client affiche encore un compte à rebours positif (horloge client en retard)
  Quand ce client envoie vote:cast
  Alors le serveur refuse silencieusement (comparaison contre sa propre horloge, pas celle du client)

Scénario : Un même utilisateur peut voter plusieurs fois pour LA MÊME carte
  Étant donné U a un quota de 3 et n'a pas encore voté
  Quand U vote 2 fois pour la carte X
  Alors les 2 votes sont acceptés (aucune contrainte DB @@unique par carte)
  Et U ne peut retirer qu'UN SEUL de ces 2 votes par un vote:uncast (delete du premier trouvé, pas deleteMany)
```

### 5.4 Prolongation de timer de vote après expiration

```gherkin
Fonctionnalité : Prolonger un timer expiré redonne du temps utile, pas du temps négatif

Scénario : Prolongation avant expiration
  Étant donné un timer se terminant dans 30 secondes
  Quand l'animateur prolonge de 60 secondes
  Alors le nouveau timerEndsAt = ancien timerEndsAt + 60s (donc se termine dans 90s)

Scénario : Prolongation après expiration
  Étant donné un timer expiré depuis 5 minutes (timerEndsAt dans le passé)
  Quand l'animateur prolonge de 60 secondes
  Alors la base de calcul devient l'instant présent serveur (pas l'ancien timerEndsAt périmé)
  Et le nouveau timer se termine dans exactement 60 secondes à partir de maintenant
  Et non pas "-4min60s" (ce qui serait immédiatement expiré)
```

### 5.5 Gouvernance des partages — matrice de permissions

```gherkin
Fonctionnalité : Un éditeur peut gérer les partages mais ne peut jamais toucher à un rôle Propriétaire

Contexte : managerRole désigne le rôle de la personne qui effectue l'action

Scénario : Un éditeur invite un nouveau lecteur — autorisé
  Étant donné managerRole = EDITOR
  Quand il invite un utilisateur avec role=VIEWER
  Alors l'invitation réussit (201)

Scénario : Un éditeur tente d'attribuer le rôle propriétaire — refusé
  Étant donné managerRole = EDITOR
  Quand il invite ou modifie un partage avec role=OWNER
  Alors la requête échoue en 403 "Un éditeur ne peut pas attribuer le rôle propriétaire"

Scénario : Un éditeur tente de rétrograder un co-propriétaire existant — refusé
  Étant donné managerRole = EDITOR
  Et un partage existant avec role=OWNER
  Quand il modifie ce partage vers role=VIEWER (rétrogradation, pas promotion)
  Alors la requête échoue en 403 "Un éditeur ne peut pas modifier le rôle d'un propriétaire"
  # Note : le refus porte sur l'état ACTUEL de la cible, pas sur la valeur demandée —
  # un éditeur ne peut interagir avec une ligne OWNER dans AUCUN sens.

Scénario : Le créateur du board n'est jamais rétrogradable
  Étant donné le créateur du board (Board.ownerId), qui n'a aucune ligne BoardShare
  Quand n'importe quel appelant tente une action de gestion des partages le ciblant
  Alors aucune route ne peut l'atteindre (aucune fonction n'écrit sur Board.ownerId après création)

Scénario : Auto-invitation refusée
  Étant donné un manager tentant de s'inviter lui-même
  Quand il envoie une invitation avec son propre email
  Alors la requête échoue en 400 "Vous ne pouvez pas vous inviter vous-même"

Scénario : Invitation du créateur refusée
  Étant donné l'email du créateur du board
  Quand un manager tente de l'inviter via /shares/invite
  Alors la requête échoue en 400 "Cet utilisateur est déjà propriétaire du board"

Scénario : Ré-invitation avec le même rôle — silencieuse
  Étant donné un utilisateur déjà partagé en EDITOR
  Quand on l'invite à nouveau avec role=EDITOR (même rôle)
  Alors le partage est mis à jour (upsert, no-op fonctionnel)
  Mais aucune notification n'est envoyée (seul un changement de rôle réel notifie)

Scénario : Rejoindre via lien ne rétrograde jamais un membre déjà présent
  Étant donné un utilisateur déjà membre EDITOR du board
  Et le lien de partage public est configuré en rôle VIEWER
  Quand cet utilisateur rejoint via le lien de partage
  Alors son rôle reste EDITOR (upsert avec update:{} — le lien n'écrase jamais un rôle existant)
```

### 5.6 Cycle de vie du brouillon de template

```gherkin
Fonctionnalité : Éditer le contenu d'un template passe par un board brouillon jetable

Scénario : Première édition — création du brouillon
  Étant donné un template sans brouillon existant pour cet utilisateur
  Quand il clique "Éditer le contenu"
  Alors un nouveau Board est créé avec templateDraftOf = id du template
  Et son contenu est cloné depuis le snapshot JSON du template (ids remappés)
  Et ce board n'apparaît PAS dans la liste GET /api/boards/ (templateDraftOf non null)

Scénario : Re-ouverture d'un brouillon déjà existant
  Étant donné un brouillon déjà créé pour ce (utilisateur, template)
  Quand il clique à nouveau "Éditer le contenu"
  Alors le brouillon existant est réutilisé tel quel
  Et aucune resynchronisation depuis le template n'est effectuée
  # même si le template a été modifié par un autre chemin entre-temps

Scénario : Enregistrer depuis le brouillon
  Étant donné un brouillon modifié (cartes ajoutées/déplacées)
  Quand l'utilisateur enregistre depuis le brouillon
  Alors le template est mis à jour avec un nouveau snapshot JSON de l'état VIVANT du brouillon
  Et le préfixe "[Template] " est retiré du nom avant sauvegarde
  Et le board brouillon est définitivement supprimé après la sauvegarde

Scénario : Abandonner le brouillon
  Étant donné un brouillon modifié
  Quand l'utilisateur choisit "Annuler" / discard
  Alors le board brouillon est supprimé
  Et le template n'est PAS modifié (aucune lecture préalable de son contenu)
```

### 5.7 Dissolution automatique de groupe

```gherkin
Fonctionnalité : Un groupe réduit à un seul membre se dissout automatiquement

Scénario : Suppression d'une carte laissant un groupe à 1 membre
  Étant donné un groupe de 2 cartes A et B
  Quand la carte A est supprimée
  Alors B a son groupId remis à null automatiquement
  Et un événement cards:ungrouped est émis avec l'ancien groupId

Scénario : Suppression d'une carte dans un groupe de 3+
  Étant donné un groupe de 3 cartes A, B, C
  Quand la carte A est supprimée
  Alors B et C restent groupées ensemble (groupId inchangé)
  Et aucun événement cards:ungrouped n'est émis

Scénario : Course sur le membre survivant
  Étant donné un groupe de 2 cartes A et B, et une suppression groupée en cours des deux
  Quand A est supprimée en premier et que la tentative de mise à jour de B (dissolution)
       coïncide avec la suppression concurrente de B elle-même
  Alors l'échec de cette mise à jour est toléré silencieusement (pas d'exception)
```

### 5.8 Redimensionnement homothétique multi-sélection

```gherkin
Fonctionnalité : Redimensionner une sélection conserve les proportions relatives

Scénario : Redimensionnement standard
  Étant donné 3 cartes sélectionnées formant un cadre englobant de 400×300
  Quand je tire la poignée du coin sud-est vers l'extérieur pour doubler la diagonale
  Alors le facteur d'échelle appliqué est ≈2 à toutes les cartes de la sélection
  Et chaque carte grandit ET s'éloigne du coin nord-ouest (ancrage opposé) proportionnellement
  Et la disposition relative des 3 cartes entre elles est conservée

Scénario : Butée sur la taille minimale
  Étant donné une carte de la sélection ayant sa plus petite dimension à 30px
  Quand je réduis la sélection très fortement
  Alors le facteur est plafonné pour que cette dimension ne descende jamais sous ~24px
  # minFactor = min(1, 24/smallestDim)

Scénario : Cartes verrouillées exclues du redimensionnement de groupe
  Étant donné une sélection de 3 cartes dont 1 verrouillée
  Quand je redimensionne la sélection
  Alors seules les 2 cartes non verrouillées sont incluses dans le calcul du cadre englobant et redimensionnées
  Et la carte verrouillée garde sa taille et sa position d'origine
```

### 5.9 Priorité grille vs guides d'alignement

```gherkin
Fonctionnalité : La grille d'aimantation et les guides d'alignement ne s'appliquent jamais ensemble

Scénario : Grille active
  Étant donné snapToGrid = actif (quel que soit l'état de alignGuidesEnabled)
  Quand je déplace une carte
  Alors sa position est arrondie au multiple de 24px le plus proche
  Et aucun calcul de guide d'alignement n'est effectué (court-circuit avant)

Scénario : Guides actifs seuls
  Étant donné snapToGrid = inactif et alignGuidesEnabled = actif
  Et une seule carte sélectionnée (condition requise pour les guides)
  Quand je déplace cette carte à moins de 6px écran d'un bord/centre d'une autre carte
  Alors une ligne de guide apparaît et la carte s'aimante sur cette valeur

Scénario : Guides désactivés en multi-sélection
  Étant donné 2 cartes ou plus sélectionnées simultanément
  Quand je les déplace ensemble
  Alors aucun guide d'alignement n'apparaît, quel que soit alignGuidesEnabled
```

---

## 6. Registre des incohérences, limites et comportements non garantis

*Section volontairement honnête : comportements réels du système qui s'écartent d'un design "propre", à décider explicitement (reproduire ou corriger) en cas de réimplémentation. Ce ne sont pas nécessairement des bugs — certains sont des choix de simplicité assumés — mais ils doivent être des décisions conscientes, pas des surprises.*

| # | Constat | Fichier | Implication |
|---|---|---|---|
| 1 | `PATCH`/`DELETE /api/boards/:id/shares/:shareId` ne vérifient jamais que `shareId` appartient au `board :id` du chemin — seul `role` de la ligne est lu | `boards.routes.ts` | Un manager du board A pourrait théoriquement altérer un partage du board B s'il en connaît l'id de ligne. À corriger par un `where:{id, boardId}` explicite dans une réimplémentation. |
| 2 | L'historique undo/redo ne couvre pas les champs personnalisés, le vote, le timer, ni les paramètres du board | `useBoard.ts` | Ces actions sont irréversibles côté client une fois effectuées (pas de Ctrl+Z). Assumé ou oubli, à trancher. |
| 3 | Undo/redo n'a aucune détection de conflit avec une action distante concurrente | `useBoard.ts` | En cas d'édition simultanée, un undo peut écraser silencieusement le travail d'un autre participant survenu entre-temps. Dernier écrivain gagne. |
| 4 | `CardConnection.shape`/`arrow` sont des `String` libres, non contraints par un enum en base | `schema.prisma` | Rien n'empêche en théorie une valeur hors du jeu {droit,courbe,orthogonal}×{aucune,début,fin,deux} d'être persistée si une autre voie d'écriture existe. |
| 5 | `connection:create` ne vérifie pas que `fromId`/`toId` référencent des cartes existantes du board avant l'appel Prisma | `board.sockets.ts` | Une FK invalide lèverait une erreur Prisma non catchée sur ce handler précis (contrairement à la quasi-totalité des autres mutations qui tolèrent P2025 via `ignoreMissing`). |
| 6 | `boardfield:create` ne valide pas `type` contre l'enum `FieldType` (`as never`) | `board.sockets.ts` | Un type invalide fait planter le handler par une exception Prisma non gérée — seul point du module où ceci se produit hors `vote:stop`. |
| 7 | `vote:stop` est le seul handler de mutation qui n'utilise pas `ignoreMissing` sur son `update` | `vote.sockets.ts` | Un `sessionId` inexistant provoque une exception P2025 non catchée, contrairement à tous les équivalents `frame:*`/`card:*`/`connection:*`. |
| 8 | Aucune contrainte `@@unique([sessionId, cardId, userId])` sur `BoardVote` | `schema.prisma` | Un utilisateur peut voter plusieurs fois pour la même carte tant qu'il reste sous son quota total — seul le total est gardé, pas la distribution par carte. `vote:uncast` ne retire qu'un seul de ces votes à la fois. |
| 9 | `BoardVote.cardId` n'a pas de relation Prisma formelle vers `Card` (pas de FK, pas de cascade) | `schema.prisma` | Supprimer une carte votée laisse des `BoardVote` orphelins en base, contrairement à `CardConnection`/`CardFieldValue` qui cascadent proprement. |
| 10 | `board:reset` ne purge ni `BoardField`/`CardFieldValue` ni les sessions de vote | `board.sockets.ts` | Un board "réinitialisé" garde ses définitions de champs personnalisés et son historique de vote — comportement à valider comme voulu ou non. |
| 11 | Incohérence de portée de broadcast entre événements structurellement analogues : `card:update`/`frame:update`/`cards:locked` diffusent à toute la room (émetteur inclus) alors que `card:move`/`resize`/`frame:move`/`resize` excluent l'émetteur | `board.sockets.ts` | Reflète vraisemblablement une optimisation (le client applique déjà son propre déplacement en optimiste) mais crée une asymétrie non documentée entre familles d'événements proches. |
| 12 | La limite de 1,5 Mo sur l'image de couverture n'existe que côté client ; côté serveur, seul le `bodyLimit` Fastify par défaut (non redéfini) s'applique, avec un message générique différent | `board-settings-modal.tsx` vs `boards.routes.ts` | Un appel API direct (hors UI) peut dépasser 1,5 Mo jusqu'à la limite par défaut du framework, avec une erreur 413 générique au lieu du message métier. |
| 13 | Le clonage template→board (`POST /boards/`) et le clonage template→brouillon (`edit-content`) dupliquent la même logique avec une différence : le second omet `frame.active` | `boards.routes.ts` vs `templates.routes.ts` | Incohérence mineure entre deux implémentations censées être équivalentes. |
| 14 | Aucune notification (`notify()`) n'est envoyée aux membres du board lors d'un import Klaxoon, bien que le type `BOARD_IMPORTED` existe dans l'enum de notification | `boards.routes.ts` | Type de notification mort dans ce flux, ou branché ailleurs et non retrouvé dans ce fichier — à vérifier avant réimplémentation. |
| 15 | `frame:move`/`frame:resize` n'incluent pas `boardId` dans leur clause `where` Prisma (contrairement aux mutations de carte équivalentes) | `board.sockets.ts` | Fonctionne car `id` est déjà unique globalement, mais rompt la convention défensive appliquée ailleurs (toujours scoper par `boardId` en plus de `id`). |
| 16 | Le rate-limit et une partie de la validation de taille (import Klaxoon 50 Mo) ne sont réellement actifs qu'en production (`NODE_ENV`) | `index.ts`, `boards.routes.ts` | Tout test/dev local contourne silencieusement ces protections — à ne pas prendre pour argent comptant lors de tests de charge en environnement de dev. |
| 17 | Aucune limite serveur sur la longueur de `Board.name`/`Card.content`, ni sur le nombre de cartes par board ou de membres partagés | `boards.routes.ts` (schémas zod) | Seules les routes d'import Klaxoon ont des `.max()` explicites ; la création manuelle de cartes/boards n'a aucun plafond serveur. |

---

## 7. Constantes — table de référence unique

*Récapitulatif de toutes les valeurs numériques en dur trouvées dans le code, avec leur fichier source — pour éviter de les re-choisir arbitrairement lors d'une réimplémentation.*

| Constante | Valeur | Fichier |
|---|---|---|
| Cadres max par board | **2** (`MAX_FRAMES_PER_BOARD`) | `packages/shared/src/types/board.ts` |
| TTL présence Redis | **3600 s** | `board.sockets.ts` |
| Flush curseurs (throttle) | **50 ms** (20 Hz) | `board.sockets.ts` |
| Cap corps HTML og-fetch | **100 000 octets** | `og-fetch.ts` |
| Redirections max og-fetch | **5** | `og-fetch.ts` |
| Timeout fetch OG | **5000 ms** | `og-fetch.ts` |
| Troncature description OG | **300 caractères** | `og-fetch.ts` |
| Taille max import Klaxoon | **50 Mo** (`50*1024*1024`) | `boards.routes.ts` |
| Rate-limit import Klaxoon | **5 / minute** (prod uniquement) | `boards.routes.ts` |
| Marge anti-collision import | **120** (unités canvas) | `boards.routes.ts` |
| Max ids undo import (cards/connections) | **10 000** | `boards.routes.ts` |
| Max ids undo import (frames) | **1 000** | `boards.routes.ts` |
| `maxHttpBufferSize` Socket.io global | **50 Mo** | `index.ts` |
| Taille max image couverture (client uniquement) | **1,5 Mo** | `board-settings-modal.tsx` |
| Dimensions max image collée/uploadée | **700 × 600** px (ratio conservé) | `board-canvas.tsx`, `boards/[id]/page.tsx` |
| Zoom min statique / max | **0,1 / 3** | `board-canvas.tsx` |
| Facteur zoom bouton | **×1,25 / ÷1,25** | `board-canvas.tsx` |
| Pas de grille d'aimantation | **24 px** | `board-canvas.tsx` |
| Tolérance guides d'alignement | **6 px écran** | `board-canvas.tsx` |
| Couleur des guides | **`#ec4899`** | `board-canvas.tsx` |
| Facteur d'échelle max (resize multi-sélection) | **20** | `board-canvas.tsx` |
| Dimension minimale garantie (resize) | **~24 px** | `board-canvas.tsx` |
| Throttle émission resize multi-sélection | **60 ms** | `useBoard.ts` |
| Profondeur undo/redo | **30** entrées | `useBoard.ts` |
| Offset de duplication (Ctrl+D) | **+24, +24** px | `useBoard.ts`/`page.tsx` |
| Nudge clavier | **1 px** (sans modif.) / **20 px** (Shift) | `page.tsx` |
| Dimensions carte par défaut | **192 × 128** | `schema.prisma` |
| Couleur carte par défaut | **`#FFEB3B`** | `schema.prisma` |
| Dimensions cadre par défaut | **400 × 300** | `schema.prisma` |
| Couleur cadre par défaut | **`#E0E7FF`** | `schema.prisma` |
| Épaisseur connexion par défaut | **2** | `schema.prisma` |
| Auto-fit désarmé après | **2000 ms** | `board-canvas.tsx` |
| Debounce viewport molette | **80 ms** | `board-canvas.tsx` |
| Seuil affichage rectangle lasso | **3 px** | `board-canvas.tsx` |
| Seuil application sélection lasso | **5 px** | `board-canvas.tsx` |

---

## Annexe — Traçabilité de ce document

Extraction verbatim via 4 passes d'exploration ciblées sur le code source (juillet 2026), croisées entre elles :
1. `apps/api/prisma/schema.prisma` (modèle de données)
2. `apps/api/src/modules/pouetpouet/board.sockets.ts` + `vote.sockets.ts` (contrats temps réel)
3. `apps/api/src/modules/pouetpouet/boards.routes.ts` + `templates.routes.ts` (contrats REST)
4. `apps/web/src/components/board/*` + `apps/web/src/hooks/useBoard.ts` + `apps/web/src/app/(app)/boards/[id]/page.tsx` (mécaniques UI)

Toute valeur numérique citée est reprise telle quelle du code, pas déduite ou arrondie. En cas de divergence future entre ce document et le code (le code évolue, ce document est un instantané juillet 2026), **le code fait foi**.
