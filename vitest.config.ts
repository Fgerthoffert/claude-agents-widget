import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Two projects, because Phase 3 added component tests that need a DOM while the pure core, the
// hook script and the installer CLI all want plain Node.
//
// Coverage thresholds stay scoped to src/core, which is where the judgement lives. src/ui is
// tested (see the *.test.tsx files) but not gated: most of what is left there is Tauri window
// and tray plumbing that only a real window exercises — see docs/ui-smoke-checklist.md — and a
// threshold would reward testing the wrong half. src/detection is the imperative shell and is
// excluded for the same reason.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core',
          environment: 'node',
          include: [
            'src/core/**/*.test.ts',
            'src/detection/**/*.test.ts',
            'hooks/**/*.test.ts',
            'scripts/**/*.test.ts',
          ],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/ui/**/*.test.ts', 'src/ui/**/*.test.tsx'],
          setupFiles: ['src/ui/testSetup.ts'],
        },
      },
    ],
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
