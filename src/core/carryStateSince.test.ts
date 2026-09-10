import { describe, expect, it } from 'vitest';

import { carryStateSince } from './carryStateSince';
import { SETTLE_AFTER_MS } from './settleSession';
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

  it('settles a finished session once it has been finished long enough', () => {
    const fresh = carryStateSince([], [snapshot('a', 'done_idle')], NOW - SETTLE_AFTER_MS);

    expect(fresh[0]?.state).toBe('done_idle');
    expect(carryStateSince(fresh, [snapshot('a', 'done_idle')], NOW)[0]?.state).toBe('dormant');
  });

  it('settles a nameless session on sight', () => {
    const [session] = carryStateSince([], [snapshot('a', 'done_idle', { title: null })], NOW);

    expect(session?.state).toBe('dormant');
  });

  it('keeps a settled session settled, poll after poll', () => {
    // The trap: `dormant` is derived from `done_idle`, so comparing a stored `dormant` against a
    // fresh `done_idle` snapshot looks like a state *change*, re-stamps the clock, puts the
    // session back under thirty minutes and un-settles it — flipping it between two sections on
    // every poll. `asReported` is what stops that (ADR-0019).
    let sessions = carryStateSince([], [snapshot('a', 'done_idle')], NOW - SETTLE_AFTER_MS);
    const settledAt = sessions[0]?.stateSince;

    for (let poll = 1; poll <= 5; poll += 1) {
      sessions = carryStateSince(sessions, [snapshot('a', 'done_idle')], NOW + poll * 3_000);
      expect(sessions[0]?.state).toBe('dormant');
      expect(sessions[0]?.stateSince).toBe(settledAt);
    }
  });

  it('un-settles a session that goes back to work', () => {
    const settled = carryStateSince([], [snapshot('a', 'done_idle', { title: null })], NOW);
    const busy = carryStateSince(settled, [snapshot('a', 'working')], NOW + 1_000);

    expect(busy[0]?.state).toBe('working');
    expect(busy[0]?.stateSince).toBe(NOW + 1_000);
  });

  it('orders settled sessions last, below the ones just finished', () => {
    const sessions = carryStateSince(
      [],
      [
        snapshot('settled', 'done_idle', { title: null }),
        snapshot('recent', 'done_idle'),
        snapshot('blocked', 'needs_input'),
        snapshot('busy', 'working'),
      ],
      NOW,
    );

    expect(sessions.map((session) => session.sessionId)).toEqual([
      'blocked',
      'busy',
      'recent',
      'settled',
    ]);
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
