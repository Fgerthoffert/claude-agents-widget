import { describe, expect, it } from 'vitest';

import type { Ancestor, Session } from '../types';

import { focusSessionWithRunner } from './focusSessionWithRunner';
import type { FocusCommandName, FocusRunOutcome, FocusRunner } from './types';

const chain = (...args: readonly string[]): readonly Ancestor[] =>
  args.map((value, index) => ({ pid: 100 + index, comm: '', args: value }));

const VSCODE_CHAIN = chain('/bin/zsh', '/Applications/Visual Studio Code.app/Contents/MacOS/Code');
const TERMINAL_CHAIN = chain(
  '/bin/zsh',
  '/System/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal',
);

const session = (overrides: Partial<Session> = {}): Session => ({
  sessionId: 'a1',
  title: 'Refactor the parser',
  cwd: '/Users/test/proj',
  transcriptPath: null,
  state: 'needs_input',
  source: 'hook',
  notificationType: null,
  notificationMessage: null,
  updatedAt: '2026-09-09T10:00:00.000Z',
  claudePid: 50500,
  ancestors: VSCODE_CHAIN,
  ...overrides,
});

const ok = (stdout = ''): FocusRunOutcome => ({ code: 0, stdout, stderr: '' });
const fail = (stderr: string, code = 1): FocusRunOutcome => ({ code, stdout: '', stderr });

/** Records every command the orchestration issued, answering from a scripted table. */
const runnerFor = (
  answers: Partial<Record<FocusCommandName, FocusRunOutcome>>,
): { readonly run: FocusRunner; readonly calls: FocusCommandName[] } => {
  const calls: FocusCommandName[] = [];
  const run: FocusRunner = (command) => {
    calls.push(command);
    return Promise.resolve(answers[command] ?? fail(`no answer for ${command}`));
  };
  return { run, calls };
};

describe('focusSessionWithRunner', () => {
  it('reports a window when the VS Code script raised one', async () => {
    const { run, calls } = runnerFor({ osascript: ok('window\n') });
    await expect(focusSessionWithRunner(session(), run)).resolves.toEqual({
      ok: true,
      host: 'vscode',
      method: 'window',
      degradedFrom: null,
      detail: null,
    });
    // No tty lookup for an editor, and no fallback once the script succeeded.
    expect(calls).toEqual(['osascript']);
  });

  it('falls back to activation, not to opening a folder, when consent is missing', async () => {
    // The folder step is gone (ADR-0016): reached blind it opens a *new* editor window, which
    // is what the user reported. Activation is the honest degradation.
    const { run, calls } = runnerFor({
      osascript: fail('execution error: osascript is not allowed assistive access. (-1728)'),
      'open-bundle': ok(),
    });
    await expect(focusSessionWithRunner(session(), run)).resolves.toEqual({
      ok: true,
      host: 'vscode',
      method: 'app',
      // The first-run guide reads this even though the click worked.
      degradedFrom: 'permission-denied',
      detail: null,
    });
    expect(calls).toEqual(['osascript', 'open-bundle']);
  });

  it('never runs a command that could open a window, whatever the precise attempt did', async () => {
    const outcomes = [
      ['no such window', ok('none')],
      ['a refused grant', fail('not allowed assistive access')],
      ['a timeout', { code: null, stdout: '', stderr: 'timed out' }],
      ['a broken script', fail('-1728')],
    ] as const;

    for (const [, osascript] of outcomes) {
      const { run, calls } = runnerFor({ osascript, 'open-bundle': ok() });
      await focusSessionWithRunner(session(), run);

      expect(calls).toEqual(['osascript', 'open-bundle']);
    }
  });

  it('degrades all the way to app activation rather than doing nothing', async () => {
    const { run, calls } = runnerFor({
      osascript: ok('none'),
      'open-bundle': ok(),
    });
    await expect(focusSessionWithRunner(session(), run)).resolves.toEqual({
      ok: true,
      host: 'vscode',
      method: 'app',
      degradedFrom: 'window-not-found',
      detail: null,
    });
    // Activation is the honest degradation: there is no folder-opening step left to reach for
    // (ADR-0016), so a missing window means the app comes forward and the notice says so.
    expect(calls).toEqual(['osascript', 'open-bundle']);
  });

  it('looks up the tty for a terminal host and reports the tab', async () => {
    const { run, calls } = runnerFor({ 'ps-tty': ok('ttys003\n'), osascript: ok('tab') });
    await expect(
      focusSessionWithRunner(session({ ancestors: TERMINAL_CHAIN }), run),
    ).resolves.toMatchObject({ ok: true, host: 'terminal', method: 'tab' });
    expect(calls).toEqual(['ps-tty', 'osascript']);
  });

  it('activates the terminal when its tty can no longer be read', async () => {
    // A session whose process has exited: ps prints nothing, so no tab can be matched.
    const { run, calls } = runnerFor({ 'ps-tty': ok(''), 'open-bundle': ok() });
    await expect(
      focusSessionWithRunner(session({ ancestors: TERMINAL_CHAIN }), run),
    ).resolves.toMatchObject({ ok: true, method: 'app', degradedFrom: null });
    expect(calls).toEqual(['ps-tty', 'open-bundle']);
  });

  it('tolerates a failing tty lookup', async () => {
    const { run } = runnerFor({ 'ps-tty': fail('ps: bad pid', 1), 'open-bundle': ok() });
    await expect(
      focusSessionWithRunner(session({ ancestors: TERMINAL_CHAIN }), run),
    ).resolves.toMatchObject({ ok: true, method: 'app' });
  });

  it('walks the live process tree for a scanner session, which has no ancestors', async () => {
    const psOutput = [
      '    1     0 /sbin/launchd',
      ' 1199     1 /Applications/Visual Studio Code.app/Contents/MacOS/Code',
      '50410  1199 /bin/zsh -l',
      '50500 50410 claude',
    ].join('\n');
    const { run, calls } = runnerFor({ ps: ok(psOutput), osascript: ok('window') });
    await expect(
      focusSessionWithRunner(session({ ancestors: [], source: 'scanner' }), run),
    ).resolves.toMatchObject({ ok: true, host: 'vscode', method: 'window' });
    expect(calls).toEqual(['ps', 'osascript']);
  });

  it('cannot focus a session with no ancestors and no live process', async () => {
    const { run, calls } = runnerFor({ ps: ok('    1     0 /sbin/launchd') });
    await expect(focusSessionWithRunner(session({ ancestors: [] }), run)).resolves.toEqual({
      ok: false,
      host: 'unknown',
      reason: 'no-host',
      detail: null,
    });
    expect(calls).toEqual(['ps']);
  });

  it('does not shell out at all when there is no pid to walk from', async () => {
    const { run, calls } = runnerFor({});
    await expect(
      focusSessionWithRunner(session({ ancestors: [], claudePid: null }), run),
    ).resolves.toMatchObject({ ok: false, reason: 'no-host' });
    expect(calls).toEqual([]);
  });

  it('tolerates a failing process scan', async () => {
    const { run } = runnerFor({ ps: fail('ps: unavailable') });
    await expect(focusSessionWithRunner(session({ ancestors: [] }), run)).resolves.toMatchObject({
      reason: 'no-host',
    });
  });

  it('reports an unsupported host when the chain is recognisably not focusable', async () => {
    const { run } = runnerFor({});
    await expect(
      focusSessionWithRunner(session({ ancestors: chain('/bin/zsh', '/usr/bin/login') }), run),
    ).resolves.toEqual({ ok: false, host: 'unknown', reason: 'unsupported-host', detail: null });
  });

  it('reports the first, most diagnostic failure when every step fails', async () => {
    const { run, calls } = runnerFor({
      osascript: { code: null, stdout: '', stderr: 'osascript timed out' },
      'open-bundle': fail('open: -10814', 1),
    });
    const result = await focusSessionWithRunner(session(), run);
    expect(result).toEqual({
      ok: false,
      host: 'vscode',
      reason: 'timeout',
      detail: 'osascript timed out',
    });
    // The fallback was still tried before giving up.
    expect(calls).toEqual(['osascript', 'open-bundle']);
  });
});
