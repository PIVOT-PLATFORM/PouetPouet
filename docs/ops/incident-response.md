# Runbook — Réponse à incident

> Quoi faire **quand ça casse en prod** : qualifier la gravité, mitiger vite,
> communiquer, puis apprendre. Ce document est le **point d'entrée** ; il ne
> duplique pas les gestes techniques — il renvoie aux runbooks existants :
>
> - alertes & réaction par type : [observabilité, SLO & alertes](./observability-slo-alerting.md)
> - rollback déploiement / restauration / rollback migration : [backups, restauration & rollback](./backup-restore-rollback.md)
> - activation infra : [checklist go-live](./go-live-checklist.md)

---

## 1. Niveaux de gravité

| Niveau | Définition | Exemples | Délai de prise en charge |
|--------|------------|----------|--------------------------|
| **SEV1** | Service inutilisable ou perte/corruption de données | API/Web down, base inaccessible, fuite de données | Immédiat, tout le reste s'arrête |
| **SEV2** | Fonction majeure dégradée, contournement possible | Un module en erreur, latence ≫ p95, temps réel KO | Dans l'heure |
| **SEV3** | Impact mineur ou cosmétique | Bug isolé, erreur non bloquante | Backlog priorisé |

> En cas de doute, **sur-classer** : il est moins coûteux de déclasser un SEV1 que
> de découvrir trop tard qu'un SEV2 était un SEV1.

## 2. Boucle de réponse

```
Détecter → Déclarer → Trier → Mitiger → Communiquer → Résoudre → Post-mortem
```

### 2.1 Détecter & déclarer
- Source : alerte Monitoring/Sentry (cf. [observabilité §2](./observability-slo-alerting.md#2-alertes)),
  rapport utilisateur, ou échec de déploiement.
- Vérifier d'abord la réalité de l'incident : `GET /health` (DB + Redis + version),
  logs Cloud Run, état Cloud SQL.
- Déclarer : noter **heure de début**, **symptôme**, **gravité estimée**. À partir
  de là, on tient un **journal horodaté** des actions (sert au post-mortem).

### 2.2 Trier — rôles
Même à une personne, séparer les casquettes :
- **Pilote d'incident** : décide, priorise, tient le journal, communique.
- **Intervenant** : investigue et applique les correctifs.
- (SEV1 prolongé) **Communication** : tient les utilisateurs informés.

### 2.3 Mitiger — restaurer le service d'abord, comprendre ensuite
Objectif immédiat : **réduire l'impact**, pas trouver la cause racine. Arbre de
décision (les gestes détaillés sont dans les runbooks liés) :

| Symptôme dominant | Premier geste | Référence |
|-------------------|---------------|-----------|
| Apparu juste après un déploiement | **Rollback** vers la révision précédente | [rollback Cloud Run](./backup-restore-rollback.md#4-rollback-de-déploiement-cloud-run) |
| Pic d'erreurs (5xx) | Identifier la release fautive dans Sentry → forward-fix ou rollback | [réaction aux alertes](./observability-slo-alerting.md#4-réaction-aux-alertes-runbook) |
| Migration récente suspecte | Forward-fix ; si données corrompues → restauration | [rollback migration](./backup-restore-rollback.md#3-rollback-dune-migration-prisma) |
| Perte / corruption de données | **Restauration** (backup quotidien ou PITR) | [restauration](./backup-restore-rollback.md#2-restauration) |
| Latence seule | Vérifier charge / slow queries / pooling DB | [réaction aux alertes](./observability-slo-alerting.md#4-réaction-aux-alertes-runbook) |

> Règle : ne jamais lancer une **migration destructive** ou un correctif risqué en
> pleine mitigation sans backup vérifié au préalable.

### 2.4 Communiquer
- **SEV1/SEV2** : informer les utilisateurs concernés dès la mitigation engagée
  (incident reconnu + prochain point), puis à la résolution.
- Tenir le journal à jour : chaque action et son effet (a aidé / sans effet / a aggravé).

### 2.5 Résoudre
- Service rétabli **et** confirmé : `/health` à 200, taux d'erreur Sentry retombé,
  symptôme initial reproduit puis disparu.
- Noter **heure de fin**. Calculer la durée d'indisponibilité (impact sur l'error
  budget, cf. [SLO §1](./observability-slo-alerting.md#1-slo--sla-internes)).

## 3. Post-mortem (sans blâme)

Obligatoire après tout **SEV1** et tout **SEV2** récurrent. **Sans blâme** : on
cherche les défaillances du système (process, garde-fous manquants), pas un
coupable. À rédiger **sous 48 h**, tant que les faits sont frais.

```markdown
# Post-mortem — <titre court> (AAAA-MM-JJ)

- **Gravité** : SEVx
- **Durée** : début HH:MM → fin HH:MM (Xh Ymin d'impact)
- **Impact** : qui/quoi a été affecté, ampleur

## Chronologie
HH:MM — détection / action / effet (depuis le journal d'incident)

## Cause racine
Le « pourquoi » réel, pas seulement le symptôme (5 pourquoi).

## Ce qui a aidé / nui
- A bien marché :
- A manqué (détection tardive, garde-fou absent, runbook flou) :

## Actions correctives
- [ ] Action — responsable — échéance — (issue GitHub liée)
```

L'action corrective la plus utile est souvent **préventive** : une alerte
manquante, un check CI absent, un garde-fou de migration. Tracer chaque action en
**issue GitHub** pour qu'elle soit suivie comme le reste de la roadmap.

## 4. Après l'incident
- Si l'**error budget** mensuel est consommé : geler les évolutions non critiques,
  prioriser la fiabilité (cf. [SLO §1](./observability-slo-alerting.md#1-slo--sla-internes)).
- Vérifier que les actions correctives sont ouvertes en issues et priorisées.
- Mettre à jour le runbook concerné si un geste a manqué ou s'est révélé faux.
