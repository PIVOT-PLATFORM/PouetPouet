import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Reads DATABASE_URL from apps/api/.env (vitest does not load it like tsx does)
// and derives the integration-test database URL from it.
const TEST_DB_NAME = 'pouetpouet_test'

export function readDevDatabaseUrl(): string | null {
  try {
    const envPath = join(dirname(fileURLToPath(import.meta.url)), '../../.env')
    const line = readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('DATABASE_URL='))
    if (!line) return null
    return line.slice('DATABASE_URL='.length).trim().replace(/^"|"$/g, '')
  } catch {
    return null
  }
}

export function toTestDatabaseUrl(devUrl: string): string {
  const url = new URL(devUrl)
  url.pathname = `/${TEST_DB_NAME}`
  return url.toString()
}

export { TEST_DB_NAME }
