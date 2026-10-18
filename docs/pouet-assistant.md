# Pouet — Assistant IA de la suite Pivot (plan, en attente)

> **Statut : planifié, différé.** On reprend ce chantier **une fois tous les bugs de l'app
> corrigés**. Ce document fige les décisions et le plan pour ne rien perdre.
>
> Décision principale prise : **LLM auto-hébergé via Ollama** (gratuit, privé), derrière une
> abstraction `LLMProvider` pour pouvoir basculer plus tard (Claude, Gemini…) sans refonte.

## 1. Objectif

Un petit agent nommé **Pouet**, intégré à l'application, qui sert d'assistant :
- répond aux questions des utilisateurs,
- oriente dans l'application,
- propose des usages des modules face à un problème exposé,
- « maîtrise l'appli par cœur » et accompagne l'utilisateur.

Contraintes explicites de l'utilisateur :
- **Gratuit pour l'instant** (→ écarte l'API Claude, payante ; voir §3).
- **Brider les réponses** : périmètre strict, éviter toute révélation de sujets sensibles,
  de la structure interne de l'application, du code, de l'infra, des secrets, etc.

## 2. Cadrage : quel « niveau » d'IA

Pouet = **Q&A + conseil ancré dans la connaissance de l'app**, pas un agent autonome qui
exécute des actions. Donc : **un appel LLM unique en streaming**, avec une **base de
connaissances rédigée à la main** injectée dans le system prompt.

Pas de RAG / base vectorielle au départ : la surface de Pivot est bornée (une poignée de
modules), la base de connaissances tient dans le contexte. On ajoutera des outils
(navigation, pré-remplissage) ou du RAG **seulement si le besoin émerge** (simplicité d'abord).

## 3. Pourquoi Ollama (et pas Claude/hébergé payant pour l'instant)

« Gratuit » a toujours une contrepartie. Options étudiées :

| Option | Gratuit | Privé | Ops | Intelligence |
|---|---|---|---|---|
| API Claude (Anthropic) | ❌ payant | — | nul | ★★★ |
| Palier gratuit Gemini Flash / Groq | ✅ (quotas) | ⚠️ données possiblement exploitées | nul | ★★ |
| **Ollama auto-hébergé** (choisi) | ✅ | ✅ total | ⚠️ machine à gérer | ★–★★ (selon modèle) |
| FAQ déterministe (sans IA) | ✅ | ✅ | nul | ✗ (pas de raisonnement) |

**Choix : Ollama auto-hébergé.** Cohérent avec l'ADN « suite auto-hébergée, data-centric » de
Pivot : zéro coût par requête, aucune donnée qui sort. Contrepartie assumée : il faut une
machine qui fait tourner le modèle (cf. §9 hébergement prod).

L'**abstraction `LLMProvider`** garde la porte ouverte : on pourra brancher Claude/Gemini plus
tard via une variable d'env, sans rien refondre. Le `OllamaProvider` parlera à l'endpoint
**compatible OpenAI** d'Ollama (`/v1/chat/completions`, streaming) → format standard, swap trivial.

## 4. Architecture

```
Widget Pouet (apps/web)
   │  POST /api/pouet/chat (SSE, authentifié)
   ▼
apps/api (Fastify)  ──►  LLMProvider (interface)  ──►  OllamaProvider
   │  garde-fous, rate-limit Redis, audit              │  HTTP → Ollama
   ▼                                                    ▼
Réponse streamée                              Ollama (serveur de modèles)
                                              local : docker-compose
                                              prod  : VM dédiée (OLLAMA_BASE_URL)
```

Point de sécurité fondamental : **Pouet ne peut pas révéler ce qu'il n'a pas.** On ne lui donne
que la **base de connaissances publique** (comment utiliser les modules). Jamais de code, de
schéma Prisma, d'`.env`, d'infra, ni de données d'autres utilisateurs.

## 5. Choix du modèle (config `POUET_MODEL`)

Compromis qualité ↔ RAM/vitesse (inférence CPU possible sur le poste Windows ; GPU idéal) :

| Modèle | RAM ~ | Note |
|---|---|---|
| `llama3.2:3b` ou `qwen2.5:3b` | ~3–4 Go | **Démarrer ici** : réactif en dev, FR correct |
| `llama3.1:8b` ou `qwen2.5:7b` | ~8 Go | Meilleure qualité de conseil si le matériel suit |

On démarre petit (réactif), on monte si besoin — réglable sans redéploiement via `POUET_MODEL`.

## 6. Backend (`apps/api/src/modules/pouet/`)

- Route `POST /api/pouet/chat` en **SSE**, protégée par `app.authenticate`.
- `OllamaProvider` : `OLLAMA_BASE_URL` (défaut `http://localhost:11434`), `POUET_MODEL`,
  streaming relayé en SSE token par token.
- Entrée : `{ messages: [...], context?: { route, module } }` — le `context` (page/module
  courant) permet des réponses situées.
- **System prompt** = règles de périmètre + **base de connaissances** (`pouet-knowledge.md` :
  modules, comment-faire, FAQ). Stable, rédigé à la main.
- **Historique** court, gardé côté client (ou Redis TTL court si reprise voulue). Pas de
  persistance lourde au départ.
- `temperature` basse pour des réponses stables/snappy.

## 7. Garde-fous (défense en profondeur)

Du moins coûteux au plus coûteux :

1. **Périmètre strict dans le system prompt** : « Tu es Pouet, assistant de la suite Pivot. Tu
   n'aides qu'à utiliser l'application et ses modules. Tu refuses poliment le hors-sujet. Tu ne
   révèles jamais : code source, architecture interne, base de données, variables
   d'environnement, infrastructure, ni données d'autres utilisateurs. Tu ne donnes pas
   d'instructions de contournement de sécurité. » + exemples de refus.
2. **Aucune donnée sensible dans le contexte** : seule la base de connaissances publique est
   injectée. Rien d'autre n'est accessible au modèle → rien à fuiter. **C'est le garde-fou le
   plus fort**, plus robuste qu'un filtrage de sortie.
3. **Résistance à l'injection de prompt** : le contenu utilisateur arrive uniquement dans les
   messages `user`, jamais fusionné aux instructions système. Aucune action déclenchée par le
   texte utilisateur (lecture seule au départ).
4. **Auth + rate-limiting** : route authentifiée ; quota par utilisateur via Redis (ioredis déjà
   présent), ex. N msg/min + plafond/jour ; limite de longueur d'entrée.
5. **Audit & supervision** : journaliser via `audit.ts` (qui, quand, refus) sans stocker de
   contenu sensible ; surveiller les abus.
6. **(Option) Pré-filtre de périmètre déterministe** : rejeter d'emblée le hors-sujet évident
   avant l'appel modèle.

> ⚠️ Un petit modèle ouvert suit les instructions **moins fidèlement** que Claude → le refus
> « hors-sujet » sera moins robuste. Mitigations : prompt ferme + pré-filtre optionnel. En
> revanche la protection des **sujets sensibles** tient par construction (on ne lui donne rien de
> sensible — garde-fou n°2).

## 8. Frontend (`apps/web`)

- **Widget « Pouet »** : bulle flottante dans le shell de l'app, panneau de chat, réponses
  **streamées**, quelques *prompts suggérés* (« Comment lancer un Scrum Poker ? », « Quel module
  pour une rétro ? »).
- **Contextuel** : transmettre la route/module courant pour des réponses situées.
- **Branding** : reprendre la palette de marque (memory `project-brand-palette`) ; re-skin final
  aligné sur la fin de roadmap.

## 9. Local / Dev & Prod

**Local (dev/démo)** : ajouter un service **`ollama`** au `docker-compose.yml` (à côté de
Postgres/Redis), avec volume pour les modèles, puis `ollama pull <modèle>`. Suffisant pour
développer et démontrer le flux de bout en bout.

**Prod (seule vraie décision d'ops, différable)** : **Cloud Run ne convient pas** pour héberger
Ollama (pas de GPU simple, conteneurs éphémères, cold starts, taille du modèle). Il faudra une
**machine toujours allumée** avec assez de RAM (VM GCP, ou VPS) faisant tourner Ollama ; l'app
Cloud Run l'appelle via `OLLAMA_BASE_URL`. **Pas bloquant maintenant** — on tranche
l'hébergement prod au moment du déploiement (phase F3).

## 10. Phasage

| Phase | Contenu | Critère de succès |
|---|---|---|
| **F0 – Spike** | service `ollama` (docker-compose) + `LLMProvider`/`OllamaProvider` + route SSE `/api/pouet/chat` + base de connaissances minimale | une question → réponse streamée en local |
| **F1 – MVP** | Widget, base de connaissances complète, garde-fous (périmètre, auth, rate-limit, audit) | Pouet répond/oriente, refuse le hors-sujet |
| **F2 – Contextuel** | Réponses situées (route/module) + liens profonds vers les modules + prompts suggérés | « Emmène-moi sur… » propose le bon module |
| **F3 – Prod** | Hébergement Ollama (VM/VPS) + `OLLAMA_BASE_URL` + déploiement | Pouet dispo en prod |

## 11. Traçabilité projet

- **ADR** à rédiger dans `docs/adr/` : « Assistant Pouet — LLM auto-hébergé via Ollama,
  abstraction provider, garde-fous » (décision + alternatives + confidentialité + hébergement
  prod). Décision structurante (cf. memory `reference-adr-journal`).
- Entrée dans `ROADMAP.md` ; s'inscrit dans la vision Pivot (l'assistant qui « maîtrise l'appli »).
- À la sortie : patch-note (`apps/api/src/lib/patch-notes.ts`) + bump de version (checklist release).

## 12. Décisions ouvertes (à trancher à la reprise)

1. **Modèle de départ** : `llama3.2:3b` (réactif) vs `qwen2.5:7b`/`llama3.1:8b` (meilleur conseil)
   — dépend du matériel.
2. **Hébergement prod** d'Ollama (VM GCP vs VPS) — phase F3.
3. **Pré-filtre de périmètre** déterministe : nécessaire ou non selon la robustesse observée du
   prompt seul.
4. **Transport** : SSE (retenu, simple/stateless) vs Socket.io (déjà présent) — confirmer.

## 13. Prochains pas à la reprise

1. Rédiger l'**ADR** Pouet/Ollama.
2. Lancer le **spike F0** sur une branche `feat/pouet-spike`.
