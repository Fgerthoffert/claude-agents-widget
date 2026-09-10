import { describe, expect, it } from 'vitest';

import { countSessionStates } from './countSessionStates';
import { aSession } from './testing/aSession';
import type { Session, SessionState } from './types';

const session = (sessionId: string, state: SessionState): Session =>
  aSession({ sessionId, title: null, cwd: '/Users/test/proj', state, claudePid: null });

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
