import { describe, expect, it } from 'vitest';

import { loudSessionId } from './loudSessionId';
import type { Session, SessionState } from './types';

const session = (
  sessionId: string,
  state: SessionState,
  updatedAt = '2026-09-09T12:00:00.000Z',
): Session => ({
  sessionId,
  title: sessionId,
  cwd: '/Users/test/proj',
  transcriptPath: null,
  state,
  source: 'hook',
  notificationType: null,
  notificationMessage: null,
  updatedAt,
  claudePid: 411,
  ancestors: [],
});

describe('loudSessionId', () => {
  it('shouts about the first blocked session, which is the most recent', () => {
    const sessions = [
      session('newest', 'needs_input', '2026-09-09T12:00:00.000Z'),
      session('older', 'needs_input', '2026-09-09T11:00:00.000Z'),
    ];
    expect(loudSessionId(sessions, new Map())).toBe('newest');
  });

  it('shouts about at most one, however many are blocked', () => {
    const sessions = Array.from({ length: 6 }, (_, index) =>
      session(`s${String(index)}`, 'needs_input'),
    );
    expect(loudSessionId(sessions, new Map())).toBe('s0');
  });

  it('goes quiet once the user has been to that session', () => {
    const sessions = [session('seen', 'needs_input'), session('unseen', 'needs_input')];
    const acknowledged = new Map([['seen', '2026-09-09T12:00:00.000Z']]);
    expect(loudSessionId(sessions, acknowledged)).toBe('unseen');
  });

  it('shouts again when the same session does something new', () => {
    // The user saw the 12:00 prompt; this is the 12:05 one, which they have not.
    const acknowledged = new Map([['a', '2026-09-09T12:00:00.000Z']]);
    const sessions = [session('a', 'needs_input', '2026-09-09T12:05:00.000Z')];
    expect(loudSessionId(sessions, acknowledged)).toBe('a');
  });

  it('stays silent when every blocked session has been seen', () => {
    const sessions = [session('a', 'needs_input'), session('b', 'needs_input')];
    const acknowledged = new Map([
      ['a', '2026-09-09T12:00:00.000Z'],
      ['b', '2026-09-09T12:00:00.000Z'],
    ]);
    expect(loudSessionId(sessions, acknowledged)).toBeNull();
  });

  it('never shouts about a state that is not blocked', () => {
    const sessions = [
      session('done', 'done_idle'),
      session('busy', 'working'),
      session('gone', 'ended'),
    ];
    expect(loudSessionId(sessions, new Map())).toBeNull();
  });

  it('has nothing to shout about in an empty panel', () => {
    expect(loudSessionId([], new Map())).toBeNull();
  });
});
