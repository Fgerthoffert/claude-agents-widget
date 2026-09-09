import { describe, expect, it } from 'vitest';

import { formatDiagnostics } from './formatDiagnostics';
import type { SetupState } from './evaluateSetupState';
import type { DetectionHealth } from './types';

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

const dump = (state = setup(), health: DetectionHealth = { failure: null, degraded: [] }): string =>
  formatDiagnostics({
    appVersion: 'v0.1.0 (abc1234)',
    platform: 'macOS 26.3 (arm64)',
    hookPath: '/Users/test/.claude-agents-widget/hook.mjs',
    settingsPath: '/Users/test/.claude/settings.json',
    logPath: '/Users/test/Library/Logs/app/claude-agents-widget.log',
    setup: state,
    health,
    generatedAt: '2026-09-09T12:00:00.000Z',
  });

describe('formatDiagnostics', () => {
  it('reports versions, paths, statuses and counts', () => {
    const text = dump();

    expect(text).toContain('app version     v0.1.0 (abc1234)');
    expect(text).toContain('macOS 26.3 (arm64)');
    expect(text).toContain('/Users/test/.claude-agents-widget/hook.mjs');
    expect(text).toContain('hook status     done');
    expect(text).toContain('sessions        3 (2 via hooks, 1 via scanner)');
  });

  it('names the log file, which is where the real error text lives', () => {
    expect(dump()).toContain(
      'log file        /Users/test/Library/Logs/app/claude-agents-widget.log',
    );
  });

  it('says the pipeline is healthy without adding noise', () => {
    const text = dump();

    expect(text).toContain('detection       ok');
    expect(text).not.toContain('failure');
    expect(text).not.toContain('degraded');
  });

  // The whole point of ADR-0011: a report about an empty panel has to carry the reason.
  it('leads with a failing pipeline and names the reason', () => {
    const text = dump(setup(), {
      failure: 'Watching the hook state directory failed: fs.watch not allowed',
      degraded: [],
    });

    expect(text).toContain('detection       FAILING');
    expect(text).toContain('failure       Watching the hook state directory failed');
  });

  it('lists every degraded step, one per line', () => {
    const text = dump(setup(), {
      failure: null,
      degraded: ['Scanning running Claude Code processes failed: EPERM', 'Reading transcripts: x'],
    });

    expect(text).toContain('detection       ok');
    expect(text).toContain('degraded      Scanning running Claude Code processes failed: EPERM');
    expect(text).toContain('degraded      Reading transcripts: x');
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
