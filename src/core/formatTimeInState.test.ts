import { describe, expect, it } from 'vitest';

import { formatTimeInState } from './formatTimeInState';
import { aSession } from './testing/aSession';
import type { Session } from './types';

const NOW = Date.parse('2026-09-10T12:00:00.000Z');

const session = (overrides: Partial<Session>): Session => aSession({ ...overrides });

describe('formatTimeInState', () => {
  it('measures how long the current state has held', () => {
    expect(formatTimeInState(session({ stateSince: NOW - 240_000 }), NOW)).toBe('4m');
    expect(formatTimeInState(session({ stateSince: NOW - 12_000 }), NOW)).toBe('12s');
  });

  it('gives every session an age, whatever its kind', () => {
    // The old two-source pipeline had a class of row whose timestamp was the sweep that found
    // it, so it showed nothing at all. There is one source now (ADR-0018).
    expect(formatTimeInState(session({ kind: 'background' }), NOW)).not.toBeNull();
    expect(formatTimeInState(session({ kind: 'interactive' }), NOW)).not.toBeNull();
  });

  it('reads zero as a number rather than as nothing', () => {
    expect(formatTimeInState(session({ stateSince: NOW }), NOW)).toBe('0s');
  });

  it('says nothing rather than a negative age when the clock has gone backwards', () => {
    // A machine waking from sleep can hand us a stateSince in the future; "-3s" is worse.
    expect(formatTimeInState(session({ stateSince: NOW + 5_000 }), NOW)).toBeNull();
  });
});
