import { defineConfig } from '@playwright/test'

// Prérequis local : PostgreSQL + Redis lancés (docker compose up -d à la racine).
// Les deux serveurs dev (api:4000, web:3000) sont démarrés automatiquement si absents.
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  // Série uniquement : les parcours partagent la même DB de dev, et le premier run
  // déclenche les compilations à froid de next dev (lentes en parallèle).
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../api',
      url: 'http://localhost:4000/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
})
