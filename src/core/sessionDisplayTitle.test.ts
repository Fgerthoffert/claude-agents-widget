import { describe, expect, it } from 'vitest';

import { sessionDisplayTitle } from './sessionDisplayTitle';
import type { Session } from './types';

const session = (overrides: Partial<Session>): Session => ({
  sessionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  title: null,
  cwd: null,
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

describe('sessionDisplayTitle', () => {
  it('prefers the session title', () => {
    expect(
      sessionDisplayTitle(session({ title: 'Refactor the scanner', cwd: '/Users/test/api' })),
    ).toBe('Refactor the scanner');
  });

  it('trims surrounding whitespace from the title', () => {
    expect(sessionDisplayTitle(session({ title: '  Fix the tray  ' }))).toBe('Fix the tray');
  });

  it('preserves unicode titles', () => {
    expect(sessionDisplayTitle(session({ title: 'Réparer le café ☕' }))).toBe(
      'Réparer le café ☕',
    );
  });

  it('falls back to the cwd basename when there is no title', () => {
    expect(sessionDisplayTitle(session({ cwd: '/Users/test/code/api' }))).toBe('api');
  });

  it('treats an empty or whitespace-only title as absent', () => {
    expect(sessionDisplayTitle(session({ title: '', cwd: '/Users/test/api' }))).toBe('api');
    expect(sessionDisplayTitle(session({ title: '   ', cwd: '/Users/test/api' }))).toBe('api');
  });

  it('ignores a trailing slash on the cwd', () => {
    expect(sessionDisplayTitle(session({ cwd: '/Users/test/api/' }))).toBe('api');
  });

  it('falls back to a short session id when there is no title and no usable cwd', () => {
    expect(sessionDisplayTitle(session({ cwd: null }))).toBe('aaaaaaaa');
    expect(sessionDisplayTitle(session({ cwd: '/' }))).toBe('aaaaaaaa');
    expect(sessionDisplayTitle(session({ cwd: '' }))).toBe('aaaaaaaa');
  });

  it('never renders an empty row', () => {
    expect(sessionDisplayTitle(session({ sessionId: '', cwd: null }))).toBe('unknown session');
  });
});
