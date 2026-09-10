import { describe, expect, it } from 'vitest';

import { groupSessions } from './groupSessions';
import { aSession } from './testing/aSession';
import type { Session, SessionState } from './types';

const session = (sessionId: string, state: SessionState): Session =>
  aSession({ sessionId, title: sessionId, state });

describe('groupSessions', () => {
  it('splits running, blocked and finished into three sections', () => {
    const groups = groupSessions([
      session('blocked', 'needs_input'),
      session('busy', 'working'),
      session('finished', 'done_idle'),
    ]);

    expect(groups.running.map((s) => s.sessionId)).toEqual(['busy']);
    expect(groups.waiting.map((s) => s.sessionId)).toEqual(['blocked']);
    expect(groups.done.map((s) => s.sessionId)).toEqual(['finished']);
  });

  it('keeps a finished agent out of "waiting for you"', () => {
    // The user's definition: waiting means the agent asked a question and cannot proceed
    // without an answer. A finished turn is not that (ADR-0014).
    const groups = groupSessions([session('finished', 'done_idle')]);

    expect(groups.waiting).toEqual([]);
    expect(groups.done.map((s) => s.sessionId)).toEqual(['finished']);
  });

  it('drops ended sessions from every group', () => {
    const groups = groupSessions([session('gone', 'ended'), session('busy', 'working')]);

    expect(groups.running.map((s) => s.sessionId)).toEqual(['busy']);
    expect(groups.waiting).toEqual([]);
    expect(groups.done).toEqual([]);
  });

  it('keeps store order inside each group so rows do not move', () => {
    const groups = groupSessions([
      session('first-blocked', 'needs_input'),
      session('second-blocked', 'needs_input'),
      session('first-done', 'done_idle'),
      session('second-done', 'done_idle'),
    ]);

    expect(groups.waiting.map((s) => s.sessionId)).toEqual(['first-blocked', 'second-blocked']);
    expect(groups.done.map((s) => s.sessionId)).toEqual(['first-done', 'second-done']);
  });

  it('has empty groups when there is nothing to show', () => {
    expect(groupSessions([])).toEqual({ running: [], waiting: [], done: [] });
  });
});
