import { describe, expect, it } from 'vitest';

import { countSessionStates } from './countSessionStates';
import type { Session, SessionState } from './types';

const session = (sessionId: string, state: SessionState): Session => ({
  sessionId,
  title: null,
  cwd: '/Users/test/proj',
  transcriptPath: null,
  state,
  source: 'hook',
  notificationType: null,
  notificationMessage: null,
  updatedAt: '2026-09-09T12:00:00.000Z',
  claudePid: null,
  ancestors: [],
});

describe('countSessionStates', () => {
  it('buckets sessions by state', () => {
    const counts = countSessionStates([
      session('a', 'working'),
      session('b', 'working'),
      session('c', 'needs_input'),
      session('d', 'done_idle'),
    ]);

    expect(counts).toEqual({ working: 2, needsInput: 1, doneIdle: 1 });
  });

  it('leaves ended sessions out of the aggregate', () => {
    const counts = countSessionStates([session('a', 'ended'), session('b', 'working')]);
    expect(counts).toEqual({ working: 1, needsInput: 0, doneIdle: 0 });
  });

  it('returns zeroes for an empty store', () => {
    expect(countSessionStates([])).toEqual({ working: 0, needsInput: 0, doneIdle: 0 });
  });
});
