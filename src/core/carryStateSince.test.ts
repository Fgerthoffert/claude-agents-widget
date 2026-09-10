import { describe, expect, it } from 'vitest';

import { carryStateSince } from './carryStateSince';
import type { Session, SessionSnapshot } from './types';

const NOW = Date.parse('2026-09-10T12:00:00.000Z');

const snapshot = (
  sessionId: string,
  state: Session['state'],
  overrides: Partial<SessionSnapshot> = {},
): SessionSnapshot => ({
  sessionId,
  title: sessionId,
  cwd: '/Users/test/proj',
  state,
  kind: 'interactive',
  waitingFor: null,
  claudePid: 1,
  startedAtMs: NOW - 3_600_000,
  ...overrides,
});

describe('carryStateSince', () => {
  it('stamps a session it has never seen with now', () => {
    const [session] = carryStateSince([], [snapshot('a', 'working')], NOW);

    expect(session?.stateSince).toBe(NOW);
  });

  it('keeps the stamp while the state holds, so the age counts up', () => {
    // The bug this prevents: re-stamping every sweep, which pinned the age at a few seconds
    // however long the agent had really been stuck (ADR-0018).
    const first = carryStateSince([], [snapshot('a', 'working')], NOW - 60_000);
    const later = carryStateSince(first, [snapshot('a', 'working')], NOW);

    expect(later[0]?.stateSince).toBe(NOW - 60_000);
  });

  it('re-stamps when the state changes', () => {
    const first = carryStateSince([], [snapshot('a', 'working')], NOW - 60_000);
    const later = carryStateSince(first, [snapshot('a', 'needs_input')], NOW);

    expect(later[0]?.stateSince).toBe(NOW);
  });

  it('re-stamps a session that came back after disappearing', () => {
    const first = carryStateSince([], [snapshot('a', 'working')], NOW - 60_000);
    const gone = carryStateSince(first, [], NOW - 30_000);
    const back = carryStateSince(gone, [snapshot('a', 'working')], NOW);

    expect(gone).toEqual([]);
    expect(back[0]?.stateSince).toBe(NOW);
  });

  it('orders blocked first, then working, then finished', () => {
    const sessions = carryStateSince(
      [],
      [
        snapshot('idle', 'done_idle'),
        snapshot('gone', 'ended'),
        snapshot('busy', 'working'),
        snapshot('blocked', 'needs_input'),
      ],
      NOW,
    );

    expect(sessions.map((session) => session.sessionId)).toEqual([
      'blocked',
      'busy',
      'idle',
      'gone',
    ]);
  });

  it('puts the most recent change first within a state', () => {
    const earlier = carryStateSince(
      [],
      [snapshot('older', 'needs_input'), snapshot('newer', 'needs_input')],
      NOW - 60_000,
    );
    const sessions = carryStateSince(
      earlier,
      [
        snapshot('older', 'needs_input'),
        snapshot('newer', 'done_idle'),
        snapshot('newer2', 'needs_input'),
      ],
      NOW,
    );

    expect(sessions.map((session) => session.sessionId)).toEqual(['newer2', 'older', 'newer']);
  });

  it('breaks a tie on session id, so the order never flickers', () => {
    const sessions = carryStateSince([], [snapshot('b', 'working'), snapshot('a', 'working')], NOW);

    expect(sessions.map((session) => session.sessionId)).toEqual(['a', 'b']);
  });

  it('passes everything else through untouched', () => {
    const [session] = carryStateSince(
      [],
      [snapshot('a', 'needs_input', { waitingFor: 'input needed', claudePid: 42 })],
      NOW,
    );

    expect(session).toMatchObject({ waitingFor: 'input needed', claudePid: 42, title: 'a' });
  });
});
