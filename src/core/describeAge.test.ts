import { describe, expect, it } from 'vitest';

import { describeAge } from './describeAge';
import { aSession } from './testing/aSession';
import type { Session, SessionState } from './types';

const NOW = Date.parse('2026-09-09T12:00:00.000Z');

const session = (state: SessionState, stateSince = NOW - 240_000): Session =>
  aSession({ sessionId: 'a', title: 'Session', state, stateSince });

describe('describeAge', () => {
  it('reads a working session as elapsed processing time', () => {
    expect(describeAge(session('working'), NOW)).toEqual({
      kind: 'active',
      icon: '▶',
      text: '4m',
      label: 'processing for 4m',
    });
  });

  it('reads a blocked session as time spent waiting for the user', () => {
    expect(describeAge(session('needs_input'), NOW)).toMatchObject({
      kind: 'inactive',
      icon: '⏸',
      label: 'waiting for you for 4m',
    });
  });

  it.each<SessionState>(['done_idle', 'ended'])('reads %s as time spent inactive', (state) => {
    expect(describeAge(session(state), NOW)).toMatchObject({
      kind: 'inactive',
      icon: '⏸',
      label: 'inactive for 4m',
    });
  });

  it('uses different icons for the two kinds, so a glance tells them apart', () => {
    const active = describeAge(session('working'), NOW);
    const inactive = describeAge(session('done_idle'), NOW);

    expect(active?.icon).not.toBe(inactive?.icon);
    expect(active?.text).toBe(inactive?.text);
  });

  it('has nothing to show when the clock has gone backwards', () => {
    // Every session has a real state-transition timestamp now (ADR-0018), so the only way to
    // get no age is a stateSince in the future — a machine that just woke from sleep.
    expect(describeAge(session('working', NOW + 5_000), NOW)).toBeNull();
  });
});
