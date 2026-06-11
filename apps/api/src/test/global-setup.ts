import { execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { readDevDatabaseUrl, toTestDatabaseUrl, TEST_DB_NAME } from './db-url.js'

// vitest globalSetup: creates the integration-test database if needed and
// applies all migrations to it. Runs once before the test suite.
export default async function setup() {
  const devUrl = readDevDatabaseUrl()
  if (!devUrl) {
    throw new Error('DATABASE_URL introuvable dans apps/api/.env — les tests d\'intégration nécessitent la DB locale (docker-compose up).')
  }

  const admin = new PrismaClient({ datasourceUrl: devUrl })
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${TEST_DB_NAME}"`)
  } catch (err) {
    const msg = (err as Error).message
    if (!msg.includes('already exists') && !msg.includes('existe déjà')) throw err
  } finally {
    await admin.$disconnect()
  }

  const testUrl = toTestDatabaseUrl(devUrl)
  execSync('npx prisma migrate deploy', {
    cwd: new URL('../../', import.meta.url),
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'pipe',
  })
}
