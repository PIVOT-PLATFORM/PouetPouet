# Post-mortem — Clé P12 de dev committée dans le repo public (2026-07-02)

- **Gravité** : SEV3 (aucun impact utilisateur ni prod ; fuite d'un secret de développement sans valeur exploitable)
- **Durée** : commit `e2604b6` (2026-07-01, merge signdoc → develop) → retrait `666ec8d` / master `f33cdee` (2026-07-02). ~1 jour d'exposition dans l'historique public.
- **Impact** : la clé de scellage PAdES **de développement** (`apps/api/uploads/signdoc/server.p12`, certificat auto-signé auto-généré, passphrase par défaut lisible dans le code) a été poussée dans le repo public. Aucun document utilisateur, aucun secret de production.

## Chronologie
- 2026-07-01 — Merge local `feat/signdoc-scheduler → develop`. Le staging `git add -A -- apps/api apps/web packages` embarque le dossier non suivi `apps/api/uploads/` (dont `server.p12` généré par le serveur de dev). Personne ne le remarque : le fichier est noyé dans un diff de ~3 900 lignes.
- 2026-07-02 — Release v0.26.0 : merge `develop → master`. Le récapitulatif du merge affiche `server.p12 | Bin 0 -> 2353 bytes` → **détection**.
- 2026-07-02 — Mitigation : `git rm --cached`, ajout de `apps/api/uploads/` au `.gitignore` (`666ec8d`), rotation de la clé locale (fichier supprimé, regénération auto au prochain démarrage), CI+Security verts, propagation sur master (`f33cdee`).
- 2026-07-02 — Décision : **pas de réécriture d'historique** (voir cause racine / justification).

## Cause racine
`apps/api/uploads/` n'a **jamais été dans le `.gitignore`** — la doc projet (CLAUDE.md, memories) affirmait le contraire, et le dossier n'existait pas quand le module PDF a été livré, donc l'écart est passé inaperçu. Le `git add -A` scopé sur `apps/api` a fait le reste. Deux garde-fous absents : ignore-rule manquante + pas de scan de secrets bloquant sur les fichiers binaires.

## Ce qui a aidé / nui
- A bien marché : la détection à la lecture du diff de merge ; la séparation clé dev / clé prod (Secret Manager, jamais dans le repo, prioritaire dans `getServerP12()`) ; la rotation triviale (clé dev regénérable).
- A manqué : l'ignore-rule `uploads/` ; une revue du `git status` avant `git add -A` ; un secret-scanner qui bloque les `.p12`/`.pem` en pre-commit ou CI.

## Justification de l'absence de réécriture d'historique
La clé exposée est un certificat auto-signé de dev, dont la passphrase par défaut (`pivot-signdoc-dev`) figure en clair dans le code source public : sa confidentialité était déjà nulle par conception. Après rotation, elle ne scelle plus rien. Une réécriture (`git filter-repo` + force-push) invaliderait clones, tags et releases pour un gain de sécurité nul. Décision : documenter (ce fichier) et corriger en avant.

## Actions correctives
- [x] `apps/api/uploads/` gitignoré (`666ec8d`)
- [x] Rotation de la clé dev locale (suppression, regénération auto)
- [ ] Ajouter un scan de secrets bloquant les clés/binaires sensibles (`.p12`, `.pem`, `.key`) dans le workflow Security
