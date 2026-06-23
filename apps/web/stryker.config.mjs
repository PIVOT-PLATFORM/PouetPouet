/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner', '@stryker-mutator/typescript-checker'],
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  vitest: { configFile: 'vitest.config.ts' },
  mutate: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/app/**',
  ],
  coverageAnalysis: 'perTest',
  timeoutMS: 30000,
  thresholds: { high: 60, low: 40, break: null },
  reporters: ['html', 'clear-text', 'progress'],
}
