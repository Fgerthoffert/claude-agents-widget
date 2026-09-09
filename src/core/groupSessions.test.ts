import { describe, expect, it } from 'vitest';

import { groupSessions } from './groupSessions';
import type { Session, SessionState } from './types';

const session = (sessionId: string, state: SessionState): Session => ({
  sessionId,
  title: sessionId,
  cwd: '/Users/test/code/api',
  transcriptPath: null,
  state,
  source: 'hook',
  notificationType: null,
  notificationMessage: null,
  updatedAt: '2026-09-09T12:00:00.000Z',
  claudePid: 1,
  ancestors: [],
});

describe('groupSessions', () => {
  it('separates what is running from what is on the user', () => {
    const groups = groupSessions([
      session('blocked', 'needs_input'),
      session('busy', 'working'),
      session('finished', 'done_idle'),
    ]);

    expect(groups.running.map((s) => s.sessionId)).toEqual(['busy']);
    expect(groups.waiting.map((s) => s.sessionId)).toEqual(['blocked', 'finished']);
  });

  it('drops ended sessions from both groups', () => {
    const groups = groupSessions([session('gone', 'ended'), session('busy', 'working')]);

    expect(groups.running.map((s) => s.sessionId)).toEqual(['busy']);
    expect(groups.waiting).toEqual([]);
  });

  it('keeps store order inside each group so rows do not move', () => {
    const groups = groupSessions([
      session('first-blocked', 'needs_input'),
      session('second-blocked', 'needs_input'),
      session('done', 'done_idle'),
    ]);

    expect(groups.waiting.map((s) => s.sessionId)).toEqual([
      'first-blocked',
      'second-blocked',
      'done',
    ]);
  });

  it('has empty groups when there is nothing to show', () => {
    expect(groupSessions([])).toEqual({ running: [], waiting: [] });
  });
});
