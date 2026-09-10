import { describe, expect, it } from 'vitest';

import { SETTLE_AFTER_MS, settleSession } from './settleSession';
import type { SessionState } from './types';

const settle = (overrides: Partial<Parameters<typeof settleSession>[0]> = {}): SessionState =>
  settleSession({ state: 'done_idle', title: 'a-real-session', heldMs: 0, ...overrides });

describe('settleSession', () => {
  it('leaves a session that has just finished alone', () => {
    expect(settle({ heldMs: 60_000 })).toBe('done_idle');
  });

  it('settles a finished session once it has been finished a while', () => {
    expect(settle({ heldMs: SETTLE_AFTER_MS })).toBe('dormant');
    expect(settle({ heldMs: SETTLE_AFTER_MS + 1 })).toBe('dormant');
    expect(settle({ heldMs: SETTLE_AFTER_MS - 1 })).toBe('done_idle');
  });

  it('settles a nameless session at once, whatever the clock says', () => {
    // Claude Code names a session from its first prompt, so no name means nothing was asked:
    // freshly started, or cleared. There is nothing in it to read (ADR-0019).
    expect(settle({ title: null, heldMs: 0 })).toBe('dormant');
  });

  it('never dims a session that is working', () => {
    expect(settle({ state: 'working', heldMs: SETTLE_AFTER_MS * 10 })).toBe('working');
    expect(settle({ state: 'working', title: null })).toBe('working');
  });

  it('never dims a session that is blocked, however long it has waited', () => {
    // An agent stuck on a question for two hours is the last thing to push out of the way.
    expect(settle({ state: 'needs_input', heldMs: SETTLE_AFTER_MS * 4 })).toBe('needs_input');
    expect(settle({ state: 'needs_input', title: null })).toBe('needs_input');
  });

  it('leaves an ended session ended', () => {
    expect(settle({ state: 'ended', heldMs: 0 })).toBe('ended');
  });

  it('is idempotent, so a settled session does not settle again into something else', () => {
    expect(settle({ state: 'dormant', title: null, heldMs: 0 })).toBe('dormant');
  });
});
