import { describe, expect, it } from 'vitest';

import { evaluateSetupState } from './evaluateSetupState';
import { aSession } from './testing/aSession';
import type { LastFocusOutcome, SetupProbe } from './evaluateSetupState';

const probe = (overrides: Partial<SetupProbe> = {}): SetupProbe => ({
  sessions: [],
  lastFocus: null,
  ...overrides,
});

const focus = (overrides: Partial<LastFocusOutcome> = {}): LastFocusOutcome => ({
  ok: true,
  method: 'window',
  permissionDenied: false,
  degraded: false,
  detail: 'window',
  ...overrides,
});

describe('evaluateSetupState', () => {
  it('knows nothing about the permission until a click has been tried', () => {
    // macOS does not expose the Accessibility grant to the app that needs it, so `unknown` is
    // the honest answer and a green tick on faith would make the checklist lie (ADR-0009).
    expect(evaluateSetupState(probe()).permissions.status).toBe('unknown');
  });

  it('marks the permission granted only when a click reached a window or a tab', () => {
    const statusFor = (method: 'window' | 'tab' | 'app') =>
      evaluateSetupState(probe({ lastFocus: focus({ method, detail: method }) })).permissions
        .status;

    expect(statusFor('window')).toBe('done');
    expect(statusFor('tab')).toBe('done');
    // App-level focus needs no consent, so it proves nothing either way.
    expect(statusFor('app')).toBe('unknown');
  });

  it('does not read precision reached by a fallback as proof of consent', () => {
    const state = evaluateSetupState(probe({ lastFocus: focus({ degraded: true }) }));

    expect(state.permissions.status).toBe('unknown');
  });

  it('marks it blocked when macOS refused a click, even if a fallback then worked', () => {
    const state = evaluateSetupState(
      probe({ lastFocus: focus({ method: 'app', permissionDenied: true, degraded: true }) }),
    );

    expect(state.permissions.status).toBe('blocked');
    expect(state.permissions.lastFocus?.detail).toBe('window');
  });

  it('counts the sessions, and how many of them the supervisor is running', () => {
    const state = evaluateSetupState(
      probe({
        sessions: [
          aSession({ sessionId: 'a' }),
          aSession({ sessionId: 'b', kind: 'background' }),
          aSession({ sessionId: 'c', kind: 'background' }),
        ],
      }),
    );

    expect(state.sessions).toEqual({ total: 3, background: 2 });
  });

  it('reports an empty machine as empty rather than as a problem', () => {
    expect(evaluateSetupState(probe()).sessions).toEqual({ total: 0, background: 0 });
  });
});
