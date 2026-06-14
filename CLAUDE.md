# PouetPouet — Claude Code

## Projet
Clone Klaxoon auto-hébergé : whiteboard collaboratif temps réel + ateliers d'équipe (Scrum Poker, Daily, Roue, Sessions live, Capacité).

**Vision :** ce repo est le POC de **FORGE** — suite collaborative data-centric : un graphe de données partagé dont les applications sont des vues, communiquant via bus d'événements et objets pivots. Nommage : la suite = FORGE ; le tableau blanc = PouetPouet ; les autres modules gardent leur nom (Scrum Poker, Daily, La Roue, Capacité). Le repo évoluera vers FORGE par restructuration incrémentale. Roadmaps : memories `project-roadmap` (module) et `project-forge-roadmap` (plateforme).

## Stack
| Couche | Techno |
|--------|--------|
| Frontend | Next.js 15 · React 19 · App Router · Tailwind CSS v4 · Zustand |
| Backend | Fastify 5 · Socket.io v4 · TypeScript |
| BDD | PostgreSQL · Prisma ORM |
| Cache | Redis (ioredis) |
| Monorepo | Turborepo · npm workspaces |
| Deploy | Docker · GCP Cloud Run · CI via GitHub Actions (trigger : push `master`) |

## Structure
```
apps/web/          → Next.js (port 3000)
apps/api/          → Fastify + Socket.io (port 4000)
packages/shared/   → Types TypeScript partagés
docker-compose.yml → PostgreSQL + Redis locaux
```

## Commandes dev
```bash
npm run dev                        # depuis la racine (turbo : api + web en parallèle)
cd apps/api && npm run dev         # tsx watch --env-file=.env src/index.ts
cd apps/web && npm run dev         # next dev --port 3000
cd apps/api && npx prisma migrate dev   # nouvelle migration
cd apps/api && npx tsc --noEmit        # typecheck API
cd apps/web && npx tsc --noEmit        # typecheck web
```

## Patterns architecturaux clés

### Socket.io auth optionnel
Les participants anonymes doivent pouvoir rejoindre les sessions sans compte.
Le middleware `io.use()` dans `apps/api/src/index.ts` set `socket.data.userId` **seulement si le token est valide** — il n'appelle jamais `next(new Error(...))`.
**Conséquence :** chaque handler socket qui nécessite un utilisateur authentifié doit vérifier `socket.data.userId` lui-même.

### Race condition React Strict Mode + socket.io
En dev, React monte → démonte → remonte. Si un emit socket arrive pendant le démontage, le listener est absent et la réponse est perdue.
**Fix canonique :** stocker les params dans un `ref`, émettre uniquement dans le handler `socket.on('connect', ...)` (garanti après que tous les listeners sont réenregistrés).
Implémenté dans `useScrumParticipant.ts` et `useParticipantSession.ts`.

### sessionStorage — clés participant
- Session live : `klx_p_${code}` → `{ participantId }`
- Scrum Poker : `klx_scrum_${code}` → `{ participantName }`

### Next.js standalone Docker
Le mode standalone ne copie pas `public/` automatiquement.
`apps/web/Dockerfile` doit inclure : `COPY --from=builder /app/apps/web/public ./apps/web/public`

## Workflow git
```
feature/fix → develop → master (sur demande explicite uniquement)
```
- `develop` : intégration continue, pas de CI/deploy
- `master` : déploiement auto GCP Cloud Run sur push
- Toujours merger `develop → master`, jamais une branche feature directement

## Checklist release
1. Ajouter une entrée EN HAUT de `apps/api/src/lib/patch-notes.ts`
2. Bumper `version` dans : `package.json` (racine) + `apps/api/package.json` + `apps/web/package.json`
3. Commit sur `develop` → merge `develop → master` → push `master`

## Gotchas importants
- **Ne jamais committer** les fichiers `apps/web/src/lib/klx-import/samples/` (données Klaxoon, gitignorées)
- `DATABASE_URL` n'est pas chargé automatiquement par `tsx` — toujours utiliser `--env-file=.env` (déjà en place dans `apps/api/package.json`)
- En prod GCP : le SMTP n'est pas configuré dans le workflow CI → les emails de vérification sont seulement loggés. Voir les variables d'env à ajouter dans la memory `project-email-verification`.

# Guideline

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.