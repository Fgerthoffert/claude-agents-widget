import { defineConfig } from 'vitest/config';

// No jsdom yet: only pure functions in src/core plus the hook integration test.
// Coverage thresholds are scoped to src/core until Phase 3 adds component tests;
// src/detection is the imperative shell (Tauri plugin calls) and is exercised manually.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'hooks/**/*.test.ts', 'scripts/**/*.test.ts'],
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
