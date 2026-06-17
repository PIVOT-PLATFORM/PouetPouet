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

## Confidentialité

Nous maintenons la confidentialité du rapport jusqu'à la publication du patch. Nous ne partagerons pas vos coordonnées sans votre permission.

---

Merci de nous aider à garder Pivot sécurisé pour tous. 🔒
