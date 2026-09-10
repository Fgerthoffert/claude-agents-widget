import { describe, expect, it } from 'vitest';

import { visibleSessions } from './visibleSessions';
import { aSession } from './testing/aSession';
import type { Session, SessionState } from './types';

const session = (sessionId: string, state: SessionState): Session =>
  aSession({ sessionId, title: sessionId, cwd: null, state, claudePid: null });

describe('visibleSessions', () => {
  it('leaves out sessions whose process is gone', () => {
    const kept = visibleSessions([
      session('gone', 'ended'),
      session('busy', 'working'),
      session('blocked', 'needs_input'),
      session('done', 'done_idle'),
    ]);

    expect(kept.map((s) => s.sessionId)).toEqual(['busy', 'blocked', 'done']);
  });

  it('hides an `ended` session the instant it is ended, with no grace period', () => {
    // There is no grace period to wait out: a stopped background session is dropped on the
    // sweep that reports it, and an interactive one simply stops being reported (ADR-0018).
    const justEnded = { ...session('cleared', 'ended'), updatedAt: new Date().toISOString() };

    expect(visibleSessions([justEnded])).toEqual([]);
  });

  it('passes an empty list through', () => {
    expect(visibleSessions([])).toEqual([]);
  });
});
