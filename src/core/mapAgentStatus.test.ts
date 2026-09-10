import { describe, expect, it } from 'vitest';

import { mapAgentStatus } from './mapAgentStatus';

describe('mapAgentStatus', () => {
  it('reads a live interactive session from its status', () => {
    const state = (status: string) => mapAgentStatus({ kind: 'interactive', status, state: null });

    expect(state('busy')).toBe('working');
    expect(state('waiting')).toBe('needs_input');
    expect(state('idle')).toBe('done_idle');
  });

  it('reads a background job from its state when the process has exited', () => {
    const state = (recorded: string) =>
      mapAgentStatus({ kind: 'background', status: null, state: recorded });

    expect(state('working')).toBe('working');
    expect(state('blocked')).toBe('needs_input');
    expect(state('done')).toBe('done_idle');
    expect(state('stopped')).toBe('ended');
  });

  it('lets a live status outrank the recorded state', () => {
    // `status` only exists while the process is alive, so it is the more specific answer: the
    // supervisor may still record the job as working while the process sits at a prompt.
    expect(mapAgentStatus({ kind: 'background', status: 'waiting', state: 'working' })).toBe(
      'needs_input',
    );
  });

  it('treats a failed run as finished work rather than as a state of its own', () => {
    // The panel's question is "is this mine to deal with", and a failed run is something to
    // read, exactly like a successful one.
    expect(mapAgentStatus({ kind: 'background', status: null, state: 'failed' })).toBe('done_idle');
  });

  it('claims the least when it recognises nothing', () => {
    // A future status must not invent activity, or a question that may not exist.
    expect(mapAgentStatus({ kind: 'interactive', status: 'thinking-hard', state: null })).toBe(
      'done_idle',
    );
    expect(mapAgentStatus({ kind: 'background', status: null, state: 'quantum' })).toBe(
      'done_idle',
    );
  });

  it('treats a background job with nothing said about it as gone', () => {
    // No status means no process; no state means the supervisor is not tracking it either.
    expect(mapAgentStatus({ kind: 'background', status: null, state: null })).toBe('ended');
  });

  it('keeps an interactive session with nothing said about it, as idle', () => {
    // An interactive session only appears in the list while it exists, so "no idea" is not a
    // reason to drop the row — it is a reason not to claim it is busy.
    expect(mapAgentStatus({ kind: 'interactive', status: null, state: null })).toBe('done_idle');
  });
});
