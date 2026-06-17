import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Prisma 7 : la connexion passe par un driver adapter (`pg`) et non plus par
// l'`url` du schéma ni `datasourceUrl`.
//
// On borne explicitement le pool de connexions par instance via les options du
// Pool `pg`. Avec plusieurs instances Cloud Run, chaque pool consomme des
// connexions Cloud SQL : il faut garder (nb_instances × max) sous le
// max_connections de Postgres. Le défaut est ici 10/instance, surchargeable via
// DB_CONNECTION_LIMIT. `connectionTimeoutMillis` borne l'attente d'une connexion
// libre avant erreur (équivalent de l'ancien `pool_timeout`, en millisecondes).
//
// Le Pool `pg` n'ouvre aucune connexion tant qu'aucune requête n'est exécutée :
// construire le client sans DATABASE_URL (ex. tests unitaires qui importent ce
// module sans toucher la base) est donc sans danger — seule une vraie requête
// échouerait alors, ce qui est le comportement attendu.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  connectionTimeoutMillis: 10_000,
})

export const prisma = new PrismaClient({ adapter })
