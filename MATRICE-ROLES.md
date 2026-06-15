# PouetPouet — Matrice des rôles sur un board

> En vigueur depuis la v0.11.0. Trois rôles : **Propriétaire**, **Éditeur**, **Lecteur**.
> Le créateur du board est propriétaire d'office ; il peut nommer des **co-propriétaires** (mêmes droits). Le créateur ne peut être ni rétrogradé ni retiré.

## Consultation

| Action | Propriétaire | Éditeur | Lecteur |
|---|:-:|:-:|:-:|
| Voir le board (cartes, cadres, connexions, dessins) | ✅ | ✅ | ✅ |
| Voir qui est connecté + curseurs en temps réel | ✅ | ✅ | ✅ |
| Voir les résultats de votes | ✅ | ✅ | ✅ |
| Exporter le board (image, PDF…) | ✅ | ✅ | ✅ |
| Mettre le board en favori | ✅ | ✅ | ✅ |

## Contenu du board

| Action | Propriétaire | Éditeur | Lecteur |
|---|:-:|:-:|:-:|
| Créer / modifier / déplacer / supprimer des cartes | ✅ | ✅ | ❌ |
| Dessiner, formes, connexions, étiquettes | ✅ | ✅ | ❌ |
| Créer / déplacer des cadres (max 2 par board) | ✅ | ✅ | ❌ |
| Grouper, verrouiller une carte, changer les couches | ✅ | ✅ | ❌ |
| Gérer les champs personnalisés | ✅ | ✅ | ❌ |
| Importer un board Klaxoon | ✅ | ✅ | ❌ |
| Réinitialiser le board (annulable Ctrl+Z) | ✅ | ❌ | ❌ |

## Animation (votes, timer, sessions)

| Action | Propriétaire | Éditeur | Lecteur |
|---|:-:|:-:|:-:|
| Lancer / clôturer / prolonger un vote | ✅ | ✅ | ❌ |
| Voter | ✅ si désigné votant | ✅ si désigné votant | ✅ si désigné votant |
| Démarrer / arrêter le timer du board | ✅ | ✅ | ❌ |
| Démarrer, animer et fermer une session live | ✅ | ✅ | ❌ |

## Administration du board

| Action | Propriétaire | Éditeur | Lecteur |
|---|:-:|:-:|:-:|
| Renommer le board, changer les paramètres | ✅ | ❌ | ❌ |
| Gérer le lien de partage (rôle max : Éditeur) | ✅ | ❌ | ❌ |
| Inviter un membre (Lecteur, Éditeur ou Propriétaire) | ✅ | ❌ | ❌ |
| Changer le rôle d'un membre, retirer un membre | ✅ | ❌ | ❌ |
| Supprimer le board | ✅ | ❌ | ❌ |

## Règles de sécurité

- **Le lien de partage ne peut jamais conférer la propriété** — rôle maximum : Éditeur.
- **Le créateur est protégé** : un co-propriétaire ne peut ni le rétrograder ni le retirer.
- Toutes ces règles sont appliquées **côté serveur** (l'interface ne fait que refléter les droits).
