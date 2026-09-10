import { describe, expect, it } from 'vitest';

import { loudSessionId } from './loudSessionId';
import { aSession } from './testing/aSession';
import type { Session, SessionState } from './types';

const NOW = Date.parse('2026-09-10T12:00:00.000Z');

const session = (sessionId: string, state: SessionState, stateSince = NOW): Session =>
  aSession({ sessionId, title: sessionId, state, stateSince });

describe('loudSessionId', () => {
  it('shouts about the first blocked session, which is the most recent', () => {
    const sessions = [session('newest', 'needs_input', NOW), session('older', 'needs_input', NOW)];
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
    const acknowledged = new Map([['seen', NOW]]);
    expect(loudSessionId(sessions, acknowledged)).toBe('unseen');
  });

  it('shouts again when the same session changes state again', () => {
    // The user saw the state that began five minutes ago; this session has moved on since.
    const acknowledged = new Map([['a', NOW - 300_000]]);
    const sessions = [session('a', 'needs_input', NOW)];
    expect(loudSessionId(sessions, acknowledged)).toBe('a');
  });

  it('stays silent when every blocked session has been seen', () => {
    const sessions = [session('a', 'needs_input'), session('b', 'needs_input')];
    const acknowledged = new Map([
      ['a', NOW],
      ['b', NOW],
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
