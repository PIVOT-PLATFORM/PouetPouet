# Politique de divulgation de vulnérabilités

Nous prenons la sécurité de Pivot / PouetPouet très au sérieux. Si vous découvrez une vulnérabilité de sécurité, merci de nous l'annoncer de façon responsable — **pas en issue GitHub publique**.

## Signaler une vulnérabilité

**Email** : [pouetpouetsupport@gmail.com](mailto:pouetpouetsupport@gmail.com)

Incluez dans votre rapport :
- Description de la vulnérabilité
- Étapes pour la reproduire (ou preuve de concept si possible)
- Impact estimé (authentification, données, disponibilité…)
- Votre nom et contact (optionnel)

**Quoi ne PAS faire** :
- ❌ Ouvrir une issue ou une PR GitHub décrivant la vulnérabilité
- ❌ Publier en blog ou réseaux sociaux avant que nous ayons un patch
- ❌ Tester sur des instances en production sans permission

## Réponse attendue

- **Accusé de réception** : sous 48h
- **Patch** : généralement sous 7 jours pour les vulnérabilités sérieuses
- **Divulgation** : coordination avec vous pour la publication (après patch)
- **Crédits** : vous serez crédité dans la release si vous le souhaitez

## Domaine de couverture

Nous considérons comme vulnerabilités de sécurité :
- Injection SQL, XSS, CSRF ou autres exploits OWASP Top 10
- Authentification / autorisation cassée
- Exposition de données sensibles (secrets, données utilisateur)
- Attaques DoS contre l'infrastructure
- Bypasss de restrictions d'accès

**Hors couverture** (non des failles, plutôt des améliorations) :
- Recommandations de refactoring ou de nettoyage de code
- Demandes de features
- Vulnérabilités dans les dépendances tierces (signalez à l'upstream directement, puis npm audit/Snyk)

## Vulnérabilités connues et acceptées

Le gate CI `npm run security:audit` bloque les vulnérabilités **critical** sur les dépendances de **production** (`npm audit --audit-level=critical --omit=dev`). Certaines alertes `high`/`moderate` restantes sont **conscientes et acceptées** :

| Paquet | Alerte | Pourquoi accepté |
|--------|--------|------------------|
| `xlsx` | Prototype pollution + ReDoS (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) | Utilisé pour l'export (`json_to_sheet` + `writeFile`) **et** pour un import Excel dans Scrum Poker (`read()` sur un fichier déposé par l'utilisateur, exécuté côté navigateur). Risque **borné au navigateur de la personne qui dépose le fichier** — aucune exécution serveur, aucun autre utilisateur affecté. Pas de fix npm (paquet figé à 0.18.5) ; migration vers `exceljs` à évaluer si la surface d'usage s'étend. |
| `prisma` | Bypass de middleware statique via `@prisma/dev`→`@hono/node-server` (repeated slashes in serveStatic) | Dépendance du **CLI de dev** de Prisma (tooling `prisma studio`), jamais invoquée par notre code en production (`prisma migrate deploy` ne sert aucun fichier statique). Non atteignable. En attente d'un bump upstream de Prisma. |
| `next` / `postcss` | XSS stringify CSS (GHSA-qx2v-qp2m-jg93) | Faille **build-time** (génération CSS), pas runtime. Le correctif naïf rétrograde Next à 9.3.3. Sera résolu au prochain patch de Next. |
| `@google-cloud/storage` (chaîne `gaxios`/`retry-request`/`teeny-request`/`uuid`) | Vulnérabilités moderate transitives sur des versions internes du SDK | Déjà à la dernière version compatible (`7.21.0`) ; les paquets vulnérables sont épinglés par les dépendances internes du SDK Google Cloud lui-même. Se résorbera au prochain bump upstream de `@google-cloud/storage`. |

Cette liste est revue à chaque `npm audit`. Toute nouvelle alerte **critical** ou toute alerte atteignable en production doit être corrigée, pas ajoutée ici.

## Confidentialité

Nous maintenons la confidentialité du rapport jusqu'à la publication du patch. Nous ne partagerons pas vos coordonnées sans votre permission.

---

Merci de nous aider à garder Pivot sécurisé pour tous. 🔒
