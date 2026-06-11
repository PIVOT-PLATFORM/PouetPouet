import { defineConfig } from 'vitest/config'
import { readDevDatabaseUrl, toTestDatabaseUrl } from './src/test/db-url.js'

const devUrl = readDevDatabaseUrl()

// Integration tests hit a real PostgreSQL database (pouetpouet_test, created by
// global-setup). Run with: npm run test:integration — requires docker-compose up.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    globalSetup: ['./src/test/global-setup.ts'],
    // Sequential files: tests share the test DB; parallel files would race on cleanup.
    fileParallelism: false,
    env: {
      DATABASE_URL: devUrl ? toTestDatabaseUrl(devUrl) : '',
      ALLOW_EMAIL_BYPASS: 'true',
    },
  },
})
