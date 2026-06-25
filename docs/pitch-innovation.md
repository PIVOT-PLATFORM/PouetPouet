---
marp: true
theme: default
paginate: true
style: |
  section {
    font-family: 'Segoe UI', sans-serif;
    font-size: 22px;
    padding: 40px 50px;
    background: #ffffff;
    color: #1a1a2e;
  }
  section.lead {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%);
    color: #ffffff;
    text-align: center;
  }
  section.lead h1 { color: #e94560; font-size: 2.4em; margin-bottom: 0.2em; }
  section.lead h2 { color: #a8dadc; font-size: 1em; font-weight: 400; }
  section.problem { background: #fff8f0; }
  section.problem h2 { color: #e94560; }
  section.solution { background: #f0f9ff; }
  section.roi { background: #f0fdf4; }
  section.roi h2 { color: #166534; }
  section.vision { background: linear-gradient(135deg, #0f3460 0%, #16213e 100%); color: #fff; }
  section.vision h2, section.vision h3 { color: #a8dadc; }
  section.vision li { color: #e0e0e0; }
  h2 { color: #0f3460; border-bottom: 3px solid #e94560; padding-bottom: 6px; margin-bottom: 0.6em; }
  h3 { font-size: 0.95em; margin: 0.5em 0 0.3em; }
  ul { margin: 0.2em 0; padding-left: 1.3em; }
  li { margin-bottom: 0.25em; line-height: 1.4; }
  p { margin: 0.4em 0; }
  .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 2em; }
  .columns3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5em; }
  blockquote {
    border-left: 4px solid #e94560;
    background: #fff3f3;
    padding: 0.4em 0.8em;
    margin: 0.8em 0 0;
    font-style: italic;
    font-size: 0.9em;
    color: #333;
  }
  section.vision blockquote { background: rgba(255,255,255,0.1); color: #e0e0e0; }
  section.vision td { color: #e0e0e0; border-color: rgba(255,255,255,0.15); }
  section.vision tr:nth-child(even) { background: rgba(255,255,255,0.08); }
  section.vision th { background: #e94560; color: #fff; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
  th { background: #0f3460; color: white; padding: 6px 10px; }
  td { padding: 6px 10px; border: 1px solid #ddd; }
  tr:nth-child(even) { background: #f5f5f5; }
  code { font-size: 0.82em; }
  pre { font-size: 0.78em; margin: 0.5em 0; }
  .highlight { color: #e94560; font-weight: bold; font-size: 1.15em; }
  .tag { background: #0f3460; color: white; padding: 3px 12px; border-radius: 12px; font-size: 0.8em; margin: 3px; display: inline-block; line-height: 2; }
  .big { font-size: 1.8em; font-weight: bold; color: #e94560; display: block; margin: 0.2em 0; }
  .label { font-size: 0.75em; color: #666; }
---

<!-- _class: lead -->

# Pivot
## La suite collaborative souveraine pour les équipes modernes

**Challenge Innovation — Juin 2026**

---

## Le problème : l'explosion des outils SaaS

Les équipes agiles jonglent entre **6 à 9 outils distincts** pour collaborer.

| Besoin | Outil typique | Coût / 10 users |
|--------|--------------|-----------------|
| Whiteboard collaboratif | Miro, Mural | ~120 €/mois |
| Rétrospectives / Daily | Retrium, EasyRetro | ~80 €/mois |
| Planning Poker | Scrumpy, PlanITPoker | ~40 €/mois |
| Capacité d'équipe | Excel, Smartsheet | ~60 €/mois |
| Facilitation live | Mentimeter, Klaxoon | ~150 €/mois |
| Roadmap / Planification | Monday.com, Airfocus | ~100 €/mois |

> **Total pour 10 personnes : 550 €/mois — 6 600 €/an** · données chez 6 prestataires différents

---
<!-- _class: problem -->

## Le vrai problème derrière les outils

<div class="columns">
<div>

### Fragmentation
- Contexte perdu entre les outils
- Résultats d'ateliers non reliés aux boards
- Historique éparpillé, onboarding multiplié

</div>
<div>

### Souveraineté
- Données d'équipe chez des tiers
- Conformité RGPD complexe et coûteuse
- Dépendance aux prix et aux SaaS

</div>
</div>

<br>

> **La question n'est pas "quel outil ?" — c'est "pourquoi autant d'outils ?"**

---
<!-- _class: solution -->

## Pivot — Une seule suite, vos données

**Pivot** est une suite collaborative **auto-hébergée** et **open-source** (AGPL-3.0), conçue autour d'un graphe de données partagé dont chaque module est une vue.

### 8 modules disponibles aujourd'hui

<span class="tag">Whiteboard</span>
<span class="tag">Scrum Poker</span>
<span class="tag">Daily Standup</span>
<span class="tag">La Roue</span>
<span class="tag">Sessions live</span>
<span class="tag">Capacité d'équipe</span>
<span class="tag">MeetOps</span>
<span class="tag">Roadmap</span>

<br>

**Un espace unifié · Temps réel · Données sur votre infra**

---

## Modules — Collaboration & Agilité

<div class="columns">
<div>

### Whiteboard collaboratif
- Post-its, formes, dessins, nuage de mots
- Temps réel · zoom adaptatif · export

### Scrum Poker
- Estimations en temps réel
- Participants anonymes, résultats agrégés

</div>
<div>

### Daily Standup
- Structure 3 questions agiles
- Suivi des blockers, historique des sessions

### La Roue
- Facilitation de décisions de groupe
- Animation interactive en session live

</div>
</div>

---

## Modules — Organisation & Facilitation

<div class="columns">
<div>

### Capacité d'équipe
- Roster, FTE, disponibilités
- Planification de sprint
- Partage par rôle (Viewer / Éditeur / Owner)

</div>
<div>

### Sessions live & MeetOps
- Facilitation guidée pas à pas
- Timer intégré, roue des décisions
- Export du compte-rendu

### Roadmap Gantt
- Timeline interactive (5 échelles)
- Jalons, dépendances, drag & drop
- Export PDF vectoriel · partage par rôle

</div>
</div>

> **Ce n'est pas un prototype — v0.22.0 en production, 22 releases livrées.**

---
<!-- _class: roi -->

## ROI — Le calcul qui change tout

### Scénario : équipe de 15 personnes

| | SaaS classique | **Pivot auto-hébergé** |
|--|--|--|
| Licences outils (×6) | ~9 900 €/an | **0 €** |
| Infra hébergement | 0 € | **~360 €/an** |
| Conformité RGPD | ~500 €/an | **0 €** |
| **Total annuel** | **~10 400 €** | **~360 €** |

<br>

<span class="highlight">Économie : ~10 040 €/an pour 15 personnes → ROI positif dès le 1er mois</span>

---
<!-- _class: roi -->

## À l'échelle — 300 personnes

<div class="columns3" style="text-align:center; margin: 0.8em 0;">
<div>
<span class="big">~200 000 €</span>
<span class="label">SaaS classique / an</span>
</div>
<div>
<span class="big">~2 400 €</span>
<span class="label">Pivot auto-hébergé / an</span>
</div>
<div>
<span class="big">~197 000 €</span>
<span class="label">Économie annuelle</span>
</div>
</div>

| | 15 personnes | **300 personnes** |
|--|--|--|
| SaaS (licences + conformité) | ~10 400 €/an | **~200 000 €/an** |
| Pivot (infra dédiée) | ~360 €/an | **~2 400 €/an** |
| **Économie** | **~10 040 €** | **~197 600 €** |

> ~197 000 € économisés = 2 développeurs recrutés pour innover en interne

---
<!-- _class: roi -->

## Gains qualitatifs

<div class="columns">
<div>

### Productivité
- **–40%** de temps de setup par atelier
- **–60%** de friction à l'onboarding
- Résultats d'ateliers liés aux boards → zéro double-saisie

</div>
<div>

### Souveraineté & extensibilité
- Données sur **votre infra** — RGPD trivial
- Pas de risque de shutdown ou rachat SaaS
- Code source AGPL-3.0 — personnalisable & auditable

</div>
</div>

---

## Architecture — solide et mainstream

```
Next.js 15 + React 19      →  Frontend, App Router, SSR
Fastify 5 + Socket.io v4   →  API temps réel, WebSockets
PostgreSQL + Prisma ORM    →  Données relationnelles
Redis                      →  Cache, sessions, rate-limiting
Docker + GCP Cloud Run     →  Déployable partout, CI/CD intégré
```

- **Open-source AGPL-3.0** — transparent, auditable, communauté possible
- Stack mainstream → recrutement facile, zéro vendor lock-in

---

## Développement assisté par IA — une vitesse inédite

La stack TypeScript / Next.js / Fastify est **parfaitement lisible par les LLM de code** (Claude Code, GitHub Copilot, Cursor).

<div class="columns">
<div>

### Pourquoi ça marche si bien
- Types partagés end-to-end → l'IA comprend le contrat instantanément
- Architecture documentée (ADR, monorepo) → contexte disponible en secondes
- Pas d'abstraction propriétaire → zéro friction IA

</div>
<div>

### Ce que ça change concrètement
- **Pivot lui-même** est développé en AI-assist
- 22 releases livrées en ~18 mois · équipe réduite
- Nouvelle feature : **1–3 jours** au lieu de 1–2 semaines
- Correction de bug complexe : **quelques heures**

</div>
</div>

> L'IA ne remplace pas le développeur — elle multiplie sa vélocité par 3 à 5×

---

## Extensible à volonté — vos modules, vos règles

Pivot est conçu pour s'étendre. Ajouter un module ou une feature interne ne dépend **que de vous**.

<div class="columns">
<div>

### Nouveaux modules possibles
- Suivi OKR / KPI d'équipe
- Matrice RACI
- Baromètre d'ambiance / mood check
- Tableau de bord projet sur mesure
- Intégration Jira, Slack, Confluence…

</div>
<div>

### Features internes
- Règles métier spécifiques à votre organisation
- Workflows sur mesure (approbation, escalade…)
- Branding et thème propre
- Connexion à vos systèmes existants (SSO, LDAP, API interne)

</div>
</div>

> Avec AI-assist : un nouveau module de A à Z en **1 à 2 semaines** de dev

---
<!-- _class: roi -->

## ROI Développement — le vrai levier de différenciation

| | Feature via éditeur SaaS | **Feature en interne + IA** |
|--|--|--|
| Délai | 6 à 18 mois (si acceptée) | **1 à 4 semaines** |
| Coût | Inclus licence OU devis custom €€€ | **800 – 3 000 €** (temps dev) |
| Résultat | Compromis roadmap généralisée | **Exactement ce que vous vouliez** |
| Propriété | Aucune — dépend du prestataire | **Permanente** |
| Roadmap | Subie | **Choisie** |

<br>

<span class="highlight">Coût d'opportunité d'une feature refusée par un SaaS : 0 chez Pivot</span>

---
<!-- _class: vision -->

## Vision — Pivot comme graphe de données

Aujourd'hui : 8 modules indépendants partageant une même identité.

Demain : **des objets pivots partagés** entre tous les modules.

- Une **équipe** vit dans le Board, le Scrum, le Daily et la Capacité à la fois
- Les **stories** estimées en Scrum alimentent la Capacité automatiquement
- Les **blockers** du Daily remontent dans le Board

> Un seul graphe de données collaboratif · les modules en sont les vues

---
<!-- _class: vision -->

## Roadmap — Ce qui arrive

| Phase | Contenu | Statut |
|-------|---------|--------|
| v0.22 | Roadmap Gantt · Jalons · Drag & PDF | ✅ Livré |
| v1.0 | Hardening · SSO · auth fédérée | Planifié |
| F2 | Objets pivots partagés entre modules | Roadmap |
| F3 | Assistant IA **Pouet** (Ollama, auto-hébergé) | Roadmap |
| F4+ | Composeur · marketplace de modules | Vision |

---

## Comparatif positionnel

| Critère | Miro / Mural | Klaxoon | **Pivot** |
|---------|-------------|---------|-----------|
| Multi-modules intégrés | Partiel | ✅ | ✅ |
| Auto-hébergeable | ❌ | ❌ | **✅** |
| Open-source | ❌ | ❌ | **✅ AGPL** |
| Données souveraines | ❌ | ❌ | **✅** |
| Coût / 15 users / an | ~5 400 € | ~7 200 € | **~360 €** |
| Personnalisable / API | Partiel | Partiel | **✅** |

---

## Déploiement — 3 modes, 0 lock-in

<div class="columns3">
<div>

### ☁️ Cloud Run
Docker image · CI/CD auto
~30 €/mois · en ligne en 15 min

</div>
<div>

### 🏠 On-premise
`docker-compose.yml` fourni
Serveur interne ou VPS
Données **jamais hors périmètre**

</div>
<div>

### 🚀 Managé *(roadmap)*
Pivot-as-a-Service
Pour les équipes sans ops

</div>
</div>

<!--
_class: lead

## Ce qu'on demande

### Pas de capital — une opportunité de pilote

1. Un sponsor pour un pilote sur 1 équipe · 8 semaines
2. Feedback structuré pour prioriser la roadmap
3. Visibilité pour recruter des contributeurs

### En échange

- Déploiement + accompagnement onboarding offerts
- Co-construction de la roadmap · early adopter IA Pouet
-->

---
<!-- _class: lead -->

# Pivot

**La seule suite collaborative qui met les données de votre équipe là où elles doivent être : chez vous.**

**Open-source · Auto-hébergée · Temps réel · 8 modules · ROI positif M+1**

`github.com/0bno/PouetPouet` · `v0.22.0`

`pouetpouet-web-118355313911.europe-west1.run.app`

> *Prêt à faire le pivot ?*
