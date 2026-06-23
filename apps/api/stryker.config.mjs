/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner', '@stryker-mutator/typescript-checker'],
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  vitest: { configFile: 'vitest.config.ts' },
  mutate: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.integration.test.ts',
    '!src/index.ts',
  ],
  coverageAnalysis: 'perTest',
  timeoutMS: 30000,
  thresholds: { high: 70, low: 50, break: null },
  reporters: ['html', 'clear-text', 'progress'],
}
