import { describe, expect, it } from 'vitest';

import { describeAge } from './describeAge';
import type { Session, SessionState } from './types';

const NOW = Date.parse('2026-09-09T12:00:00.000Z');

const session = (state: SessionState, updatedAt = '2026-09-09T11:56:00.000Z'): Session => ({
  sessionId: 'a',
  title: 'Session',
  cwd: '/Users/test/code/api',
  transcriptPath: null,
  state,
  source: 'hook',
  notificationType: null,
  notificationMessage: null,
  updatedAt,
  claudePid: 1,
  ancestors: [],
});

describe('describeAge', () => {
  it('reads a working session as elapsed processing time', () => {
    expect(describeAge(session('working'), NOW)).toEqual({
      kind: 'active',
      icon: '⏱',
      text: '4m',
      label: 'working for 4m',
    });
  });

  it('reads a blocked session as time spent waiting for the user', () => {
    expect(describeAge(session('needs_input'), NOW)).toMatchObject({
      kind: 'inactive',
      icon: '⏳',
      label: 'waiting for 4m',
    });
  });

  it.each<SessionState>(['done_idle', 'ended'])('reads %s as time spent inactive', (state) => {
    expect(describeAge(session(state), NOW)).toMatchObject({
      kind: 'inactive',
      icon: '⏳',
      label: 'inactive for 4m',
    });
  });

  it('uses different icons for the two kinds, so a glance tells them apart', () => {
    const active = describeAge(session('working'), NOW);
    const inactive = describeAge(session('done_idle'), NOW);

    expect(active?.icon).not.toBe(inactive?.icon);
    expect(active?.text).toBe(inactive?.text);
  });

  it('has nothing to show when the timestamp is not a state transition', () => {
    expect(describeAge({ ...session('working'), source: 'scanner' }, NOW)).toBeNull();
    expect(describeAge(session('working', 'not-a-date'), NOW)).toBeNull();
  });
});
