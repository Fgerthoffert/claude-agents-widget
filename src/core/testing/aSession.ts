import type { Session } from '../types';

/** A fixed point in time, so a test that cares about durations can do arithmetic on it. */
export const TEST_NOW = Date.parse('2026-09-10T12:00:00.000Z');

/**
 * A session, with every field already plausible, for tests that only care about one of them.
 *
 * Shared rather than redeclared per test file: nine files carried a near-identical factory, and
 * when `Session` changed shape all nine broke in the same way for no useful reason. A test that
 * needs a blocked session should say `aSession({ state: 'needs_input' })` and nothing else.
 *
 * Excluded from coverage in `vite.config.ts` — it is test scaffolding that happens to live under
 * `src/core`, and counting it would flatter the number it is measured by.
 */
export const aSession = (overrides: Partial<Session> = {}): Session => ({
  sessionId: 'sess-1',
  title: 'Refactor the scanner',
  cwd: '/Users/test/code/api',
  state: 'working',
  kind: 'interactive',
  waitingFor: null,
  claudePid: 1234,
  startedAtMs: TEST_NOW - 600_000,
  stateSince: TEST_NOW - 1_000,
  ...overrides,
});
