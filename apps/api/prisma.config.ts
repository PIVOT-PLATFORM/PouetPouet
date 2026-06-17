import { defineConfig } from 'prisma/config'

// Prisma 7 : l'URL de connexion ne vit plus dans schema.prisma.
// Elle est fournie ici pour les commandes CLI (migrate, db push…).
// Le client runtime, lui, reçoit son adapter dans src/lib/prisma.ts.
//
// Prisma 7 ne charge plus .env automatiquement : on le fait via l'API native
// de Node (>=20.6), sans dépendance dotenv. En local, charge apps/api/.env
// (cwd) ; en CI/prod (Cloud Run) le fichier est absent → on ignore et
// DATABASE_URL vient déjà de l'environnement. loadEnvFile n'écrase pas une
// variable déjà définie (ex. DATABASE_URL passé par les tests d'intégration).
try {
  process.loadEnvFile()
} catch {
  // pas de fichier .env : variables déjà dans l'environnement
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // `url` est optionnel (requis seulement pour migrate/introspection, pas pour
  // generate). On lit directement process.env : absent → undefined (generate OK
  // sans DB, ex. build Docker / CI) ; présent → utilisé par migrate.
  // NB : le helper strict `env()` de prisma/config lèverait une erreur si la
  // variable manque, ce qui casserait `prisma generate` en CI.
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
