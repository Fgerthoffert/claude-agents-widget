import { describe, expect, it } from 'vitest';

import { visibleSessions } from './visibleSessions';
import type { Session, SessionState } from './types';

const session = (sessionId: string, state: SessionState): Session => ({
  sessionId,
  title: sessionId,
  cwd: null,
  transcriptPath: null,
  state,
  source: 'hook',
  notificationType: null,
  notificationMessage: null,
  updatedAt: '2026-09-09T12:00:00.000Z',
  claudePid: null,
  ancestors: [],
});

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

  it('passes an empty list through', () => {
    expect(visibleSessions([])).toEqual([]);
  });
});
