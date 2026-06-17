# ADR-0003 — Authentification Socket.io optionnelle

> Statut : `Accepté` · Date : 2026-06-17 · Remplace : — · Remplacé par : —

> ADR rétroactive : fige une décision déjà en vigueur dans le repo.

## Contexte

Les sessions live et les ateliers (Scrum Poker, Daily, sessions `/session/[code]`)
doivent pouvoir accueillir des **participants anonymes** : un facilitateur partage
un code, les participants rejoignent sans créer de compte. Or Socket.io permet de
refuser une connexion dans le middleware `io.use()`. Refuser les connexions sans
token interdirait le cas d'usage principal.

## Options envisagées

- **Auth obligatoire au handshake** (`next(new Error())` si pas de token valide) —
  simple à raisonner côté handler (toujours un user), mais **casse** le parcours
  participant anonyme.
- **Deux serveurs / namespaces** (un authentifié, un anonyme) — surface et
  complexité doublées pour un bénéfice faible.
- **Auth optionnelle** : le middleware valide le token *s'il existe et est valide*,
  sinon laisse passer en anonyme ; chaque handler privilégié vérifie lui-même.

## Décision

**Auth Socket.io optionnelle.** Le middleware `io.use()` dans
`apps/api/src/index.ts` set `socket.data.userId` **uniquement si** le token est
présent et valide ; il n'appelle **jamais** `next(new Error(...))`. Un token
expiré/invalide → on poursuit en anonyme plutôt que de bloquer le participant.

## Conséquences

- Les participants anonymes rejoignent les sessions sans friction.
- **Contrainte transverse forte** : chaque handler socket qui exige un utilisateur
  authentifié (`host_join`, `member_join`, `activity:launch`, mutations…) **doit
  vérifier `socket.data.userId` / le rôle lui-même**. Un oubli = faille
  d'autorisation silencieuse.
- Un token périmé ne bloque jamais le flux participant (dégradation en anonyme).
- Cette décision est le socle sur lequel s'appuie l'enforcement de rôles côté
  socket de [ADR-0005](./0005-permissions-moduleshare-polymorphe.md).
