import { defineConfig } from '@playwright/test'

// Prérequis local : PostgreSQL + Redis lancés (docker compose up -d à la racine).
// Les deux serveurs dev (api:4000, web:3000) sont démarrés automatiquement si absents.
//
// En CI (process.env.CI) : l'API tourne via `tsx` (comme en dev mais sans --watch) —
// `@pouetpouet/shared` est consommé en TS source, que `node dist` ne sait pas résoudre.
// Le web tourne en mode production (`next start`), car `next build` bundle déjà shared.
// Playwright gère le cycle de vie des serveurs (démarrage avant les tests, arrêt après).
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  // Série uniquement : les parcours partagent la même DB, et le premier run
  // déclenche les compilations à froid de next dev (lentes en parallèle).
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: isCI ? 'npx tsx src/index.ts' : 'npm run dev',
      cwd: '../api',
      url: 'http://localhost:4000/health',
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: isCI ? 'npm run start' : 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
})
