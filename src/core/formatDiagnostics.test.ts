import { describe, expect, it } from 'vitest';

import { formatDiagnostics } from './formatDiagnostics';
import type { SetupState } from './evaluateSetupState';
import type { DetectionHealth } from './types';

const setup = (overrides: Partial<SetupState> = {}): SetupState => ({
  permissions: { status: 'unknown', lastFocus: null },
  sessions: { total: 3, background: 1 },
  ...overrides,
});

const dump = (state = setup(), health: DetectionHealth = { failure: null, degraded: [] }): string =>
  formatDiagnostics({
    appVersion: 'v0.1.0 (abc1234)',
    platform: 'macOS 26.3 (arm64)',
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
    expect(text).toContain('source          claude agents --json');
    expect(text).toContain('sessions        3 (1 background)');
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
      failure: 'Asking Claude Code for its sessions failed: command not allowed',
      degraded: [],
    });

    expect(text).toContain('detection       FAILING');
    expect(text).toContain('failure       Asking Claude Code for its sessions failed');
  });

  it('lists every degraded step, one per line', () => {
    const text = dump(setup(), {
      failure: null,
      degraded: ['Something was reduced: EPERM', 'And another thing: x'],
    });

    expect(text).toContain('detection       ok');
    expect(text).toContain('degraded      Something was reduced: EPERM');
    expect(text).toContain('degraded      And another thing: x');
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
            degraded: false,
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
