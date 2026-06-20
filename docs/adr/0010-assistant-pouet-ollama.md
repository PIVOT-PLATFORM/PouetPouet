# ADR-0010 — Assistant Pouet : LLM auto-hébergé via Ollama, abstraction provider, garde-fous

**Statut :** Acceptée — 2026-06-20
**Décision :** Assistant IA in-app « Pouet » basé sur Ollama auto-hébergé, derrière une abstraction `LLMProvider`.

---

## Contexte

La suite Pivot manquait d'un point d'entrée conversationnel pour orienter les utilisateurs dans l'application, répondre à leurs questions d'usage et suggérer les bons modules face à un problème exposé. L'objectif est un **assistant léger, gratuit, privé**, cohérent avec l'ADN auto-hébergé de Pivot.

Contraintes explicites :
- Gratuit à l'usage (pas de coût par requête).
- Données privées (aucune donnée utilisateur ne sort de l'infra).
- Périmètre strict (Q&A sur l'application), pas d'agent autonome.
- Brider les réponses : refus poli du hors-sujet, jamais de fuite de code source / infra / secrets.

## Options étudiées

| Option | Gratuit | Privé | Intelligence |
|---|---|---|---|
| API Claude (Anthropic) | ❌ payant | — | ★★★ |
| Palier gratuit Gemini Flash / Groq | ✅ quotas | ⚠️ données exploitables | ★★ |
| **Ollama auto-hébergé** (**choisi**) | ✅ | ✅ total | ★–★★ |
| FAQ déterministe (sans IA) | ✅ | ✅ | ✗ |

## Décision

### LLM : Ollama auto-hébergé

Ollama expose un **endpoint compatible OpenAI** (`/v1/chat/completions`, SSE). Zéro coût par requête, aucune donnée externe. Contrepartie : machine toujours allumée pour la prod.

**Modèle de départ :** `llama3.2:3b` (CPU, ~3–4 Go RAM). Configurable sans redéploiement via `POUET_MODEL`. Montée en gamme possible vers `llama3.1:8b` / `qwen2.5:7b` si le matériel le permet.

### Abstraction `LLMProvider`

Interface TypeScript minimale (`chat(messages, onToken, signal)`) isolant le transport. Permet un swap futur vers Claude/Gemini via une variable d'env `LLM_PROVIDER`, sans refonte du reste.

### Route : `POST /api/pouet/chat` en SSE

Fastify + Server-Sent Events (stateless, simple). `EventSource` standard côté client n'acceptant que GET, le frontend utilise `fetch` + `ReadableStream`. Rejeté : Socket.io (déjà présent mais overhead de session non justifié pour un simple stream de tokens).

### Garde-fous (défense en profondeur)

1. **Périmètre strict dans le system prompt** — « Tu es Pouet, assistant de Pivot. Tu refuses poliment le hors-sujet. Tu ne révèles jamais le code source, l'architecture, les secrets, les données d'autres utilisateurs. »
2. **Aucune donnée sensible dans le contexte injecté** — seule la base de connaissances publique (`pouet-knowledge.md`) est passée au modèle. Garde-fou le plus robuste : il ne peut pas fuiter ce qu'il n'a pas.
3. **Auth obligatoire** — route derrière `app.authenticate`.
4. **Rate-limiting Redis** — quota par utilisateur (clé `pouet:rl:{userId}`, 20 requêtes / heure).
5. **Audit** — via `audit.ts` (userId, action `pouet.chat`, IP), sans stockage du contenu.
6. **Limite de longueur d'entrée** — messages tronqués avant l'appel modèle.

### Hébergement

- **Dev / local** : service `ollama` dans `docker-compose.yml` (profil `ollama` opt-in).
- **Prod** : Cloud Run ne convient pas (pas de GPU simple, conteneurs éphémères). Décision différée à phase F3 : VM GCP ou VPS avec Ollama, appelé via `OLLAMA_BASE_URL`.

## Conséquences

- La qualité de conseil d'un 3b est inférieure à Claude. Atténuée par un prompt ferme et la base de connaissances.
- Le suivi de consigne hors-sujet est moins robuste sur un petit modèle ouvert. Le garde-fou n°2 (pas de données sensibles) reste le plus fort.
- Ajouter un provider (Claude, Gemini) = implémenter `LLMProvider` + changer `LLM_PROVIDER` env.
- La VM Ollama en prod est un nouveau point de maintenance (sizing, uptime, mises à jour modèle).

## Traçabilité

- Implémentation : `apps/api/src/modules/pouet/` + widget `apps/web/src/components/pouet/`
- Spec complète : `docs/pouet-assistant.md`
