import { describe, expect, it } from 'vitest';

import { formatTimeInState } from './formatTimeInState';
import type { Session } from './types';

const NOW = Date.parse('2026-09-09T12:00:00.000Z');

const session = (overrides: Partial<Session>): Session => ({
  sessionId: 'session-1',
  title: 'Titled',
  cwd: '/Users/test/api',
  transcriptPath: null,
  state: 'working',
  source: 'hook',
  notificationType: null,
  notificationMessage: null,
  updatedAt: '2026-09-09T12:00:00.000Z',
  claudePid: 1234,
  ancestors: [],
  ...overrides,
});

describe('formatTimeInState', () => {
  it('formats the age of a hook-owned session', () => {
    expect(formatTimeInState(session({ updatedAt: '2026-09-09T11:56:00.000Z' }), NOW)).toBe('4m');
    expect(formatTimeInState(session({ updatedAt: '2026-09-09T11:59:48.000Z' }), NOW)).toBe('12s');
  });

  it('reads 0s at the instant of the transition', () => {
    expect(formatTimeInState(session({}), NOW)).toBe('0s');
  });

  it('withholds the age of a scanner-only session', () => {
    expect(formatTimeInState(session({ source: 'scanner' }), NOW)).toBeNull();
  });

  it('withholds the age when the timestamp is unparseable', () => {
    expect(formatTimeInState(session({ updatedAt: 'not-a-date' }), NOW)).toBeNull();
  });
});
