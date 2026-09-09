import { defineConfig } from 'vitest/config';

// No jsdom yet: Phase 1 only tests pure functions in src/core.
// Coverage thresholds are scoped to src/core until Phase 3 adds component tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/**/*.test.ts'],
      thresholds: {
        lines: 85,
        functions: 85,
        statements: 85,
        branches: 85,
      },
    },
  },
});
