import { describe, expect, it } from 'vitest';

import { formatDiagnostics } from './formatDiagnostics';
import type { SetupState } from './evaluateSetupState';

const setup = (overrides: Partial<SetupState> = {}): SetupState => ({
  hooks: {
    status: 'done',
    registeredEvents: ['SessionStart', 'Stop'],
    missingEvents: [],
    scriptInstalled: true,
  },
  permissions: { status: 'unknown', lastFocus: null },
  sessions: { status: 'done', total: 3, hookOwned: 2, scannerOnly: 1 },
  needsSetup: false,
  ...overrides,
});

const dump = (state = setup()): string =>
  formatDiagnostics({
    appVersion: '0.1.0',
    platform: 'macOS 26.3 (arm64)',
    hookPath: '/Users/test/.claude-agents-widget/hook.mjs',
    settingsPath: '/Users/test/.claude/settings.json',
    setup: state,
    generatedAt: '2026-09-09T12:00:00.000Z',
  });

describe('formatDiagnostics', () => {
  it('reports versions, paths, statuses and counts', () => {
    const text = dump();

    expect(text).toContain('app version     0.1.0');
    expect(text).toContain('macOS 26.3 (arm64)');
    expect(text).toContain('/Users/test/.claude-agents-widget/hook.mjs');
    expect(text).toContain('hook status     done');
    expect(text).toContain('sessions        3 (2 via hooks, 1 via scanner)');
  });

  it('writes an em dash rather than an empty list', () => {
    expect(dump()).toContain('missing       —');
  });

  it('says plainly when no click has been made yet', () => {
    expect(dump()).toContain('last focus      no click yet');
  });

  it('names the refusal when macOS blocked the last click', () => {
    const text = dump(
      setup({
        permissions: {
          status: 'blocked',
          lastFocus: {
            ok: false,
            method: null,
            permissionDenied: true,
            detail: 'permission-denied',
          },
        },
      }),
    );

    expect(text).toContain('failed · permission-denied · macOS refused it');
  });

  it('carries no session titles or project paths', () => {
    // The dump is the one thing here meant to be pasted in public: it must stay anonymous.
    expect(dump()).not.toContain('/code/');
  });
});
