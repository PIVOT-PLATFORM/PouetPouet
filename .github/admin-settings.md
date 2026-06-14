# GitHub Admin Settings

Ces reglages doivent etre appliques par un compte admin du depot.

## Repository Settings

- Activer `Automatically delete head branches`.
- Garder `master` comme branche par defaut.
- Garder `Squash merge` active comme strategie recommandee.
- Activer `Allow auto-merge` (requis par le workflow `dependabot-auto-merge.yml` ; l'auto-merge n'est sur que combine aux required checks de la branch protection ci-dessous).

## Branch Protection: master

- Require a pull request before merging: active.
- Required approvals: `1`.
- Require conversation resolution before merging: active.
- Require status checks to pass before merging: active.
- Require branches to be up to date before merging: active.
- Required checks:
  - `Quality gates`
  - `API integration tests`
  - `Runtime dependency audit`
  - `Container scan (api)`
  - `Container scan (web)`
- Include administrators: active.
- Allow force pushes: desactive.
- Allow deletions: desactive.

## Branch Protection: develop

- Require a pull request before merging: active.
- Required approvals: `0` si disponible, sinon ne pas rendre la review bloquante.
- Require conversation resolution before merging: active.
- Require status checks to pass before merging: active.
- Require branches to be up to date before merging: active.
- Required checks:
  - `Quality gates`
  - `API integration tests`
  - `Runtime dependency audit`
  - `Container scan (api)`
  - `Container scan (web)`
- Include administrators: active.
- Allow force pushes: desactive.
- Allow deletions: desactive.

## Limite Connue

Les repository rulesets ne sont pas utilises ici: GitHub les refuse sur ce depot prive sans plan compatible ou depot public.
