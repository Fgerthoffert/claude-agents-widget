import { describe, expect, it } from 'vitest';

import { aSession } from '../testing/aSession';
import type { Session } from '../types';

import { focusSessionWithRunner } from './focusSessionWithRunner';
import type { FocusCommandName, FocusRunOutcome, FocusRunner } from './types';

/**
 * `ps` output describing the chain above the session's process, nearest first.
 *
 * The host used to arrive on the session itself, captured by the hook script at session start.
 * There is no hook (ADR-0018), so `focusSessionWithRunner` walks the live process tree from the
 * pid Claude Code reported — which means these tests script `ps` rather than hand over a chain.
 */
const psFor = (...above: readonly string[]): string =>
  [
    '    1     0 /sbin/launchd',
    ...above.map(
      (command, index) =>
        `${String(50501 + index)} ${String(index + 1 === above.length ? 1 : 50502 + index)} ${command}`,
    ),
    `50500 50501 claude`,
  ].join('\n');

const VSCODE = psFor('/bin/zsh -l', '/Applications/Visual Studio Code.app/Contents/MacOS/Code');
const TERMINAL = psFor(
  '/bin/zsh -l',
  '/System/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal',
);

const session = (overrides: Partial<Session> = {}): Session =>
  aSession({
    sessionId: 'a1',
    title: 'Refactor the parser',
    cwd: '/Users/test/proj',
    state: 'needs_input',
    claudePid: 50500,
    ...overrides,
  });

const ok = (stdout = ''): FocusRunOutcome => ({ code: 0, stdout, stderr: '' });
const fail = (stderr: string, code = 1): FocusRunOutcome => ({ code, stdout: '', stderr });

/** Records every command the orchestration issued, answering from a scripted table. */
const runnerFor = (
  answers: Partial<Record<FocusCommandName, FocusRunOutcome>>,
): { readonly run: FocusRunner; readonly calls: FocusCommandName[] } => {
  const calls: FocusCommandName[] = [];
  // Every focus now begins by walking `ps`, so a VS Code chain is the default answer and a test
  // only mentions `ps` when the chain itself is what it is about.
  const table = { ps: ok(VSCODE), ...answers };
  const run: FocusRunner = (command) => {
    calls.push(command);
    return Promise.resolve(table[command] ?? fail(`no answer for ${command}`));
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
    expect(calls).toEqual(['ps', 'osascript']);
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
    expect(calls).toEqual(['ps', 'osascript', 'open-bundle']);
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

      expect(calls).toEqual(['ps', 'osascript', 'open-bundle']);
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
    expect(calls).toEqual(['ps', 'osascript', 'open-bundle']);
  });

  it('looks up the tty for a terminal host and reports the tab', async () => {
    const { run, calls } = runnerFor({
      ps: ok(TERMINAL),
      'ps-tty': ok('ttys003\n'),
      osascript: ok('tab'),
    });
    await expect(focusSessionWithRunner(session(), run)).resolves.toMatchObject({
      ok: true,
      host: 'terminal',
      method: 'tab',
    });
    expect(calls).toEqual(['ps', 'ps-tty', 'osascript']);
  });

  it('activates the terminal when its tty can no longer be read', async () => {
    // A session whose process has exited: ps prints nothing, so no tab can be matched.
    const { run, calls } = runnerFor({ ps: ok(TERMINAL), 'ps-tty': ok(''), 'open-bundle': ok() });
    await expect(focusSessionWithRunner(session(), run)).resolves.toMatchObject({
      ok: true,
      method: 'app',
      degradedFrom: null,
    });
    expect(calls).toEqual(['ps', 'ps-tty', 'open-bundle']);
  });

  it('tolerates a failing tty lookup', async () => {
    const { run } = runnerFor({
      ps: ok(TERMINAL),
      'ps-tty': fail('ps: bad pid', 1),
      'open-bundle': ok(),
    });
    await expect(focusSessionWithRunner(session(), run)).resolves.toMatchObject({
      ok: true,
      method: 'app',
    });
  });

  it('walks the live process tree to find the host, every time', async () => {
    // Not a fallback any more: reading `ps` at click time is the only route, and the better one.
    // A chain captured at session start describes where the session *was* (ADR-0018).
    const { run, calls } = runnerFor({ ps: ok(VSCODE), osascript: ok('window') });
    await expect(focusSessionWithRunner(session(), run)).resolves.toMatchObject({
      ok: true,
      host: 'vscode',
      method: 'window',
    });
    expect(calls).toEqual(['ps', 'osascript']);
  });

  it('cannot focus a session whose process has gone', async () => {
    const { run, calls } = runnerFor({ ps: ok('    1     0 /sbin/launchd') });
    await expect(focusSessionWithRunner(session(), run)).resolves.toEqual({
      ok: false,
      host: 'unknown',
      reason: 'no-host',
      detail: null,
    });
    expect(calls).toEqual(['ps']);
  });

  it('does not shell out at all when there is no pid to walk from', async () => {
    const { run, calls } = runnerFor({});
    await expect(focusSessionWithRunner(session({ claudePid: null }), run)).resolves.toMatchObject({
      ok: false,
      reason: 'no-host',
    });
    expect(calls).toEqual([]);
  });

  it('tolerates a failing process scan', async () => {
    const { run } = runnerFor({ ps: fail('ps: unavailable') });
    await expect(focusSessionWithRunner(session(), run)).resolves.toMatchObject({
      reason: 'no-host',
    });
  });

  it('reports an unsupported host when the chain is recognisably not focusable', async () => {
    const { run } = runnerFor({ ps: ok(psFor('/bin/zsh -l', '/usr/bin/login')) });
    await expect(focusSessionWithRunner(session(), run)).resolves.toEqual({
      ok: false,
      host: 'unknown',
      reason: 'unsupported-host',
      detail: null,
    });
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
    expect(calls).toEqual(['ps', 'osascript', 'open-bundle']);
  });
});
