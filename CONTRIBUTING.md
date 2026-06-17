# Contribuer à Pivot / PouetPouet

Merci de l'intérêt que vous portez au projet ! Ce guide explique comment proposer des changements.

## Avant de commencer

- **Bug ou faille de sécurité ?** Ne l'ouvrez pas en issue publique → suivez [SECURITY.md](SECURITY.md).
- **Idée ou bug fonctionnel ?** Ouvrez d'abord une [issue](https://github.com/0bno/PouetPouet/issues) pour en discuter avant de coder une grosse fonctionnalité.
- **Décision structurante** (choix d'archi, dépendance majeure, modèle de données) ? Elle doit être tracée par une ADR dans [`docs/adr/`](docs/adr/) — voir le [gabarit](docs/adr/0000-template.md).

## Mise en route

L'installation locale (Node 20+, npm 11+, Docker) est décrite dans le [README](README.md#installation-locale). En résumé :

```bash
npm ci
docker compose up -d postgres redis
cp .env.example apps/api/.env
npm --workspace apps/api run db:generate
npm --workspace apps/api run db:migrate
npm run dev
```

## Modèle de branches

```
feature/fix  →  develop  →  master
```

- Partez **toujours** de `develop`, jamais de `master`.
- `develop` : branche d'intégration (pas de déploiement).
- `master` : déployée automatiquement sur Cloud Run à chaque push — ne ciblez jamais `master` directement.
- **Une contribution = une branche = une PR** vers `develop`.

Nommage : `feat/...`, `fix/...`, `docs/...`, `chore/...`, `ci/...`.

## Convention de commits

Le dépôt suit [Conventional Commits](https://www.conventionalcommits.org/) :

```
feat(scrum): ajoute le vote à mi-parcours
fix(deps): npm audit fix sans casse
docs(adr): décision sur l'épinglage de Prisma
```

Types courants : `feat`, `fix`, `docs`, `chore`, `ci`, `refactor`, `test`. Le scope (entre parenthèses) cible un module ou une couche.

## Avant d'ouvrir une PR

Vérifiez localement que tout passe :

```bash
npm run lint        # typecheck API + lint web
npm run test        # tests unitaires Vitest
```

Pour les changements touchant l'API ou le temps réel, faites tourner les tests d'intégration :

```bash
docker compose up -d postgres redis
npm --workspace apps/api run test:integration
```

Pour les changements d'UI, pensez aux E2E :

```bash
npm --workspace apps/web run test:e2e
```

La CI rejoue tout cela (lint, tests, intégration Postgres, E2E + a11y Playwright, scans sécurité). Une PR ne peut être mergée que si la CI est verte.

## Règles de code

- **TypeScript strict** des deux côtés ; pas de `any` non justifié.
- **Isolation des modules** : un module n'importe que son propre dossier, `../../lib` et `@pouetpouet/shared`. Les modules communiquent par le bus d'événements, pas par import direct.
- **Changements chirurgicaux** : ne touchez que ce que votre contribution exige, gardez le style existant.
- Formatage : `npm run format` (Prettier).

## Périmètre d'une PR

- Une PR = un sujet. Évitez de mélanger refactor et fonctionnalité.
- Décrivez le *quoi* et le *pourquoi*, liez l'issue concernée.
- Ajoutez/adaptez les tests qui prouvent le changement.

## Licence

En contribuant, vous acceptez que votre code soit distribué sous la licence [AGPL-3.0](LICENSE) du projet.

---

Des questions ? Ouvrez une issue ou écrivez à pouetpouetsupport@gmail.com.
