import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    // Integration tests need a real DB — run separately via npm run test:integration
    exclude: ['**/node_modules/**', 'src/**/*.integration.test.ts'],
  },
})
