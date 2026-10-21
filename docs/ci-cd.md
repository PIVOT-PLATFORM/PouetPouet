# CI/CD PouetPouet

> Socle mis a jour le 2026-06-13. Les workflows sont volontairement separes pour garder une lecture simple: qualite applicative, securite, puis deploiement.

## Vue d'ensemble

```mermaid
graph TB
    DEV["Developpeur"] --> PR["Pull Request<br>master / develop"]
    DEV --> PUSH["Push<br>master / develop"]
    PUSH_MASTER["Push master"] --> RELEASE["Release<br>tag vX.Y.Z"]

    subgraph "CI - .github/workflows/ci.yml"
        QUALITY["quality<br>npm ci<br>Prisma generate<br>lint/typecheck<br>tests coverage<br>build<br>SonarCloud"]
        INTEGRATION["integration<br>PostgreSQL 16<br>Vitest integration"]
    end

    subgraph "Security - .github/workflows/security.yml"
        AUDIT["dependency-audit<br>npm audit critical runtime"]
        TRIVY_API["container-scan api<br>Trivy critical"]
        TRIVY_WEB["container-scan web<br>Trivy critical"]
    end

    subgraph "CD - .github/workflows/publish-images.yml"
        PUB_CI["ci.yml (workflow_call)<br>sur le commit tague"]
        PUB_BUILD["Build & push api + web<br>GHCR :vX.Y.Z :X.Y.Z :sha :stable"]
    end
    COOLIFY["Coolify<br>pull :stable au Restart / 7h"]

    PR --> QUALITY
    PR --> INTEGRATION
    PR --> AUDIT
    PR --> TRIVY_API
    PR --> TRIVY_WEB
    PUSH --> QUALITY
    PUSH --> INTEGRATION
    PUSH --> AUDIT
    PUSH --> TRIVY_API
    PUSH --> TRIVY_WEB
    RELEASE --> PUB_CI --> PUB_BUILD -.-> COOLIFY
```

## Workflows

| Workflow         | Declencheurs                        | Role                                                                            | Bloquant                              |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------- |
| `ci.yml`         | PR, push `master`/`develop`, manuel | Feedback developpeur: lint, typecheck, tests, build, integration DB, SonarCloud | Oui                                   |
| `security.yml`   | PR, push, lundi 03:18 UTC, manuel   | Audit dependances runtime et scan d'images Docker                               | Oui pour les vulnerabilites critiques |
| `release.yml`    | push `master`, manuel               | Tag `vX.Y.Z` + GitHub Release, puis appel de `publish-images.yml`               | Oui                                   |
| `publish-images.yml` | appel par `release.yml`, push tag `v*`, manuel (`rollback` / `test-build`) | CI complete puis build/push images api et web sur GHCR ; rollback = repointe `stable` | Oui (CI verte requise) |
| `dependabot.yml` | planifie par GitHub                 | PRs de mise a jour npm et GitHub Actions                                        | N/A                                   |

## Liaisons et dependances

| Liaison                       | Source                   | Cible                              | Detail                                                                  |
| ----------------------------- | ------------------------ | ---------------------------------- | ----------------------------------------------------------------------- |
| Coverage Vitest -> SonarCloud | job `quality`            | `sonar-project.properties`         | Rapports `apps/api/coverage/lcov.info` et `apps/web/coverage/lcov.info` |
| API -> PostgreSQL CI          | job `integration`        | service `postgres:16-alpine`       | `DATABASE_URL` locale au job GitHub Actions                             |
| Vars de depot -> Web build    | `vars.PUBLIC_API_URL` / `vars.PUBLIC_SOCKET_URL` | build args Next.js | Defaut `https://pivot-api.jvmg.fr`                              |
| Images -> Coolify             | GHCR `ghcr.io/pivot-platform/pouetpouet-{api,web}` | serveur Coolify | Tag `stable` tire a chaque demarrage ; label `coolify.managed=true` |
| Security -> GitHub            | Trivy                    | table de resultat dans le job      | Seuil initial: `CRITICAL`, `ignore-unfixed: true`                       |

## Configuration GitHub requise

### Secrets

| Secret               | Utilise par             | Role                                          |
| -------------------- | ----------------------- | --------------------------------------------- |
| `SONAR_TOKEN`        | `ci.yml` / `quality`    | Authentifie le scan SonarCloud                |
| `SENTRY_DSN_WEB`     | `publish-images.yml`    | DSN Sentry Web injecte au build Next.js       |

GHCR utilise le `GITHUB_TOKEN` (`packages: write`), aucun secret dedie.

### Variables

| Variable             | Utilise par             | Exemple                                       |
| -------------------- | ----------------------- | --------------------------------------------- |
| `SONAR_PROJECT_KEY`  | `ci.yml` / `quality`    | `pouetpouet` ou la cle fournie par SonarCloud |
| `SONAR_ORGANIZATION` | `ci.yml` / `quality`    | Organisation SonarCloud publique              |
| `PUBLIC_API_URL`     | `publish-images.yml`    | `https://pivot-api.jvmg.fr` (defaut)          |
| `PUBLIC_SOCKET_URL`  | `publish-images.yml`    | defaut : `PUBLIC_API_URL`                     |

## Garde-fous DevSecOps en place

- `permissions: {}` par defaut sur les workflows, puis permissions minimales par job.
- `concurrency` sur CI, securite et deploy pour eviter les runs obsoletes ou deploys paralleles.
- `npm ci` pour les jobs qui installent les dependances; `npm audit` lit le lockfile sans installation prealable.
- Quality gate SonarCloud active via `sonar.qualitygate.wait=true`.
- Audit runtime bloque uniquement les vulnerabilites critiques pour ne pas rendre la CI rouge tant que `xlsx` n'a pas de correctif npm disponible.
- Trivy scanne les images API et Web en local avant deploiement.
- Aucune image n'est publiee si la CI du commit tague echoue.

## Points de vigilance

- `npm audit --omit=dev` remonte actuellement `xlsx` en haute severite sans correctif disponible. A traiter par remplacement de librairie ou mitigation applicative avant de rendre le seuil `high` bloquant.
- Les actions GitHub sont referencees par version majeure ou tag public lisible. Un durcissement ulterieur peut pinner les actions par SHA complet.
- SonarCloud ne scanne que si `SONAR_TOKEN`, `SONAR_PROJECT_KEY` et `SONAR_ORGANIZATION` sont configures.
- Les E2E Playwright ne sont pas encore branches dans la CI: ils necessitent une stack applicative complete et doivent etre ajoutes dans un workflow dedie pour rester lisibles.
