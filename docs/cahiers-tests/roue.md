# Cahier de tests — La Roue

---

**Version testée :** 0.3.0
**Date du test :** ___________________________
**Testeur :** ___________________________
**Environnement :** ___________________________
**Navigateur :** ___________________________

**Prérequis :** Au moins une équipe avec 3 membres minimum doit exister dans *Mes Dailys*. Être connecté à un compte valide.

---

## Légende

| Symbole | Signification |
|---|---|
| ☐ OK | Comportement conforme au résultat attendu |
| ☐ KO | Comportement non conforme — remplir la colonne Commentaire |

---

## 1. Chargement de la page

| N° | Action | Résultat attendu | OK | KO | Commentaire |
|---|---|---|:---:|:---:|---|
| 1.1 | Naviguer vers `/wheel` | La page se charge. Le titre "La roue" est visible. | ☐ | ☐ | |
| 1.2 | Observer la sélection initiale | La première équipe disponible est automatiquement sélectionnée (fond indigo). | ☐ | ☐ | |
| 1.3 | Se rendre sur `/wheel` sans aucune équipe créée | Un message s'affiche : "Aucune équipe. Créez-en une dans Mes dailys." avec un lien cliquable. | ☐ | ☐ | |

---

## 2. Sélection de l'équipe

| N° | Action | Résultat attendu | OK | KO | Commentaire |
|---|---|---|:---:|:---:|---|
| 2.1 | Cliquer sur une autre équipe | La sélection bascule (fond indigo se déplace). La grille des membres se met à jour. | ☐ | ☐ | |
| 2.2 | Changer d'équipe alors que des membres étaient exclus | Les exclusions sont réinitialisées. Le compteur "disponibles" correspond au total de la nouvelle équipe. | ☐ | ☐ | |
| 2.3 | Observer le compteur de membres | Le format "(N membres)" s'affiche sur chaque bouton d'équipe. | ☐ | ☐ | |

---

## 3. Configuration du tirage

| N° | Action | Résultat attendu | OK | KO | Commentaire |
|---|---|---|:---:|:---:|---|
| 3.1 | Cliquer sur le bouton "1" dans "Nombre à tirer" | Le bouton passe en fond indigo. Le bouton Tirer affiche "Tirer 1 personne". | ☐ | ☐ | |
| 3.2 | Cliquer sur "2", "3", "4", "5" successivement | Le bouton sélectionné passe en indigo, les autres en blanc. Le bouton Tirer se met à jour. | ☐ | ☐ | |
| 3.3 | Cliquer sur un chiffre supérieur au nombre de membres disponibles | Le bouton est grisé et non cliquable. | ☐ | ☐ | |
| 3.4 | Sélectionner le mode "Equilbre" | Le toggle bascule en violet. La description "Réduit la probabilité des personnes récemment tirées" s'affiche. | ☐ | ☐ | |
| 3.5 | Sélectionner le mode "Aleatoire pur" | Le toggle bascule en orange. La description "Chaque personne a exactement la même probabilité" s'affiche. Le bouton Tirer devient orange. | ☐ | ☐ | |

---

## 4. Exclusion de membres

| N° | Action | Résultat attendu | OK | KO | Commentaire |
|---|---|---|:---:|:---:|---|
| 4.1 | Cliquer sur un membre dans la grille | Le membre passe en grisé avec texte barré. Le compteur "disponibles" décrémente de 1. | ☐ | ☐ | |
| 4.2 | Vérifier la section "Exclus du prochain tirage" | Le nom apparaît dans un pill grisé avec un bouton ✕. | ☐ | ☐ | |
| 4.3 | Cliquer à nouveau sur le même membre dans la grille | Le membre redevient indigo (réinclus). Le compteur "disponibles" s'incrémente. | ☐ | ☐ | |
| 4.4 | Cliquer sur le ✕ d'un pill d'exclusion | Le membre disparaît des exclus et redevient disponible dans la grille. | ☐ | ☐ | |
| 4.5 | Cliquer sur "Réinitialiser" | Tous les membres redeviennent disponibles. La section "Exclus" disparaît. | ☐ | ☐ | |
| 4.6 | Exclure tous les membres | Le bouton Tirer affiche "Tous exclus · Réinitialisez !" et est désactivé. | ☐ | ☐ | |

---

## 5. Lancement du tirage

| N° | Action | Résultat attendu | OK | KO | Commentaire |
|---|---|---|:---:|:---:|---|
| 5.1 | Cliquer sur le bouton "Tirer" | L'animation de slot démarre : les noms défilent rapidement dans les cartes. Le texte "Tirage en cours…" s'affiche. | ☐ | ☐ | |
| 5.2 | Observer le bouton pendant l'animation | Le bouton est désactivé avec le texte "Tirage en cours…". Impossible de relancer. | ☐ | ☐ | |
| 5.3 | Attendre la fin de l'animation (~1.5 s) | Les cartes se figent avec les noms tirés et une animation pop. Le résultat correspond au nombre demandé. | ☐ | ☐ | |
| 5.4 | Vérifier que les résultats respectent les exclusions | Aucun membre exclu ne figure dans les résultats. | ☐ | ☐ | |
| 5.5 | Lancer un tirage en mode "Equilbre" plusieurs fois | Les personnes récemment tirées apparaissent moins souvent sur 5 tirages consécutifs (tendance, pas une règle absolue). | ☐ | ☐ | |
| 5.6 | Lancer un tirage en mode "Aleatoire pur" plusieurs fois | Les mêmes personnes peuvent être tirées consécutivement (aucune pondération). | ☐ | ☐ | |

---

## 6. Panneau de résultats

| N° | Action | Résultat attendu | OK | KO | Commentaire |
|---|---|---|:---:|:---:|---|
| 6.1 | Observer le panneau après le tirage | Un panneau apparaît sous les cartes avec : résumé du tirage, options d'action. | ☐ | ☐ | |
| 6.2 | Cliquer sur "Retirer et relancer" (ou équivalent) | Les personnes tirées sont automatiquement ajoutées aux exclusions. Un nouveau tirage démarre. | ☐ | ☐ | |
| 6.3 | Saisir une note dans le champ prévu | La note est sauvegardée et visible dans l'historique pour ce tirage. | ☐ | ☐ | |
| 6.4 | Associer le tirage à un événement existant | Le tirage se déplace dans la section de l'événement dans l'historique. | ☐ | ☐ | |
| 6.5 | Créer un nouvel événement depuis le panneau résultats | L'événement est créé et le tirage y est associé. L'événement apparaît dans l'historique. | ☐ | ☐ | |

---

## 7. Historique des tirages

| N° | Action | Résultat attendu | OK | KO | Commentaire |
|---|---|---|:---:|:---:|---|
| 7.1 | Observer la colonne droite après un tirage | Le tirage apparaît dans "Tirages isolés" avec : date, équipe, mode, résultats. | ☐ | ☐ | |
| 7.2 | Rafraîchir la page (F5) | L'historique est toujours présent. Les tirages ne sont pas perdus. | ☐ | ☐ | |
| 7.3 | Supprimer un tirage | Une confirmation s'affiche (ou suppression directe). Le tirage disparaît de l'historique. | ☐ | ☐ | |
| 7.4 | Effectuer 3 tirages sans événement | Ils apparaissent tous dans la section "Tirages isolés", du plus récent au plus ancien. | ☐ | ☐ | |

---

## 8. Gestion des événements

| N° | Action | Résultat attendu | OK | KO | Commentaire |
|---|---|---|:---:|:---:|---|
| 8.1 | Utiliser le champ "Créer un événement" (bas droit) et valider | L'événement apparaît dans la colonne historique avec son nom et une liste vide. | ☐ | ☐ | |
| 8.2 | Renommer un événement | Le nom est mis à jour dans l'historique. | ☐ | ☐ | |
| 8.3 | Supprimer un événement | L'événement disparaît. Les tirages qui lui étaient associés passent en "Tirages isolés". | ☐ | ☐ | |
| 8.4 | Effectuer un tirage et l'associer à un événement depuis le panneau résultats | Le tirage apparaît sous l'événement dans l'historique (et non dans les tirages isolés). | ☐ | ☐ | |
| 8.5 | Rafraîchir la page après création d'un événement | L'événement et ses tirages sont toujours présents. | ☐ | ☐ | |

---

## 9. Thème sombre

| N° | Action | Résultat attendu | OK | KO | Commentaire |
|---|---|---|:---:|:---:|---|
| 9.1 | Basculer en thème sombre (profil) et recharger `/wheel` | Tous les éléments (fond, texte, bordures, boutons) respectent le thème sombre. Aucun texte illisible. | ☐ | ☐ | |

---

## Bilan

| Statut | Nombre |
|---|---|
| Tests OK | ___ / 38 |
| Tests KO | ___ / 38 |
| Tests non exécutés | ___ / 38 |

**Observations générales :**

&nbsp;

&nbsp;

&nbsp;

**Signature :** ___________________________
