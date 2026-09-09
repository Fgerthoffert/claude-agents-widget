import { describe, expect, it } from 'vitest';

import { evaluateSetupState } from './evaluateSetupState';
import type { SetupProbe } from './evaluateSetupState';
import type { ClaudeSettings, Session, SessionSource } from './types';

const HOOK = '/Users/test/.claude-agents-widget/hook.mjs';
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'Stop', 'Notification', 'SessionEnd'];

const ourSettings = (events: readonly string[]): ClaudeSettings => ({
  hooks: Object.fromEntries(
    events.map((event) => [event, [{ hooks: [{ type: 'command', command: `node ${HOOK}` }] }]]),
  ),
});

const session = (sessionId: string, source: SessionSource): Session => ({
  sessionId,
  title: sessionId,
  cwd: '/Users/test/code/api',
  transcriptPath: null,
  state: 'working',
  source,
  notificationType: null,
  notificationMessage: null,
  updatedAt: '2026-09-09T12:00:00.000Z',
  claudePid: 1,
  ancestors: [],
});

const probe = (overrides: Partial<SetupProbe> = {}): SetupProbe => ({
  settings: null,
  settingsUnreadable: false,
  hookPath: HOOK,
  hookScriptInstalled: false,
  sessions: [],
  lastFocus: null,
  ...overrides,
});

describe('evaluateSetupState', () => {
  it('reports a fresh machine as needing setup, naming every missing event', () => {
    const state = evaluateSetupState(probe());

    expect(state.hooks.status).toBe('todo');
    expect(state.hooks.missingEvents).toEqual(EVENTS);
    expect(state.hooks.registeredEvents).toEqual([]);
    expect(state.needsSetup).toBe(true);
  });

  it('reports a fully installed machine as done', () => {
    const state = evaluateSetupState(
      probe({ settings: ourSettings(EVENTS), hookScriptInstalled: true }),
    );

    expect(state.hooks.status).toBe('done');
    expect(state.hooks.missingEvents).toEqual([]);
    expect(state.needsSetup).toBe(false);
  });

  it('treats a partial install as todo and lists only what is missing', () => {
    const state = evaluateSetupState(
      probe({ settings: ourSettings(['SessionStart', 'Stop']), hookScriptInstalled: true }),
    );

    expect(state.hooks.status).toBe('todo');
    expect(state.hooks.registeredEvents).toEqual(['SessionStart', 'Stop']);
    expect(state.hooks.missingEvents).toEqual(['UserPromptSubmit', 'Notification', 'SessionEnd']);
  });

  it('is not done when the settings are wired up but the script is gone', () => {
    const state = evaluateSetupState(
      probe({ settings: ourSettings(EVENTS), hookScriptInstalled: false }),
    );

    expect(state.hooks.status).toBe('todo');
    expect(state.hooks.scriptInstalled).toBe(false);
    expect(state.needsSetup).toBe(true);
  });

  it('ignores the user’s own hooks on the same events', () => {
    const state = evaluateSetupState(
      probe({
        settings: {
          hooks: {
            SessionStart: [{ hooks: [{ type: 'command', command: 'python session-title.py' }] }],
          },
        },
        hookScriptInstalled: true,
      }),
    );

    expect(state.hooks.registeredEvents).toEqual([]);
    expect(state.hooks.missingEvents).toEqual(EVENTS);
  });

  it('blocks on a settings file it cannot parse', () => {
    const state = evaluateSetupState(
      probe({ settingsUnreadable: true, hookScriptInstalled: true }),
    );

    expect(state.hooks.status).toBe('blocked');
    expect(state.needsSetup).toBe(true);
  });

  it('counts hook-owned and scanner-only sessions separately', () => {
    const state = evaluateSetupState(
      probe({
        settings: ourSettings(EVENTS),
        hookScriptInstalled: true,
        sessions: [session('a', 'hook'), session('b', 'scanner'), session('c', 'scanner')],
      }),
    );

    expect(state.sessions).toEqual({ status: 'done', total: 3, hookOwned: 1, scannerOnly: 2 });
  });

  it('asks for a restart when sessions exist but none came from a hook', () => {
    const state = evaluateSetupState(probe({ sessions: [session('b', 'scanner')] }));

    expect(state.sessions.status).toBe('todo');
  });

  it('says nothing about sessions when there are none', () => {
    expect(evaluateSetupState(probe()).sessions.status).toBe('unknown');
  });

  it('leaves the permission step unknown until a click has been attempted', () => {
    expect(evaluateSetupState(probe()).permissions.status).toBe('unknown');
  });

  it('marks permissions granted only when a click reached a window or tab', () => {
    const focused = (method: 'window' | 'tab' | 'app') =>
      evaluateSetupState(
        probe({
          lastFocus: { ok: true, method, permissionDenied: false, degraded: false, detail: method },
        }),
      ).permissions.status;

    expect(focused('window')).toBe('done');
    expect(focused('tab')).toBe('done');
    // App-level focus needs no consent, so it proves nothing either way.
    expect(focused('app')).toBe('unknown');
  });

  it('does not read window precision reached by a fallback as proof of consent', () => {
    // `open -b <bundle> <path>` can land on the exact window without any Accessibility grant,
    // so claiming the step is done would hide the reason later clicks are imprecise.
    const state = evaluateSetupState(
      probe({
        lastFocus: {
          ok: true,
          method: 'window',
          permissionDenied: false,
          degraded: true,
          detail: 'window',
        },
      }),
    );

    expect(state.permissions.status).toBe('unknown');
  });

  it('marks permissions blocked when macOS refused a click, even if it degraded to success', () => {
    const state = evaluateSetupState(
      probe({
        lastFocus: {
          ok: true,
          method: 'app',
          permissionDenied: true,
          degraded: true,
          detail: 'app',
        },
      }),
    );

    expect(state.permissions.status).toBe('blocked');
    expect(state.permissions.lastFocus?.detail).toBe('app');
  });
});
