import { describe, expect, it } from 'vitest';

import { identifyOwnerApp } from '../identifyOwnerApp';
import type { FocusTarget } from '../types';

import { buildVscodeScript } from './buildVscodeScript';

const VSCODE = identifyOwnerApp([
  { pid: 1, comm: 'Code', args: '/Applications/Visual Studio Code.app/Contents/MacOS/Code' },
]);

const target = (cwd: string | null): FocusTarget => ({ host: VSCODE, cwd, ttyDevice: null });

describe('buildVscodeScript', () => {
  it('claims window precision and drives System Events, which has no other route', () => {
    const script = buildVscodeScript(target('/Users/test/proj'));
    expect(script?.method).toBe('window');
    expect(script?.source).toContain('tell application "System Events"');
    expect(script?.source).toContain('windows of process "Code"');
    expect(script?.source).toContain('perform action "AXRaise" of win');
  });

  it('raises the window before bringing the app forward, so there is one transition', () => {
    const source = buildVscodeScript(target('/Users/test/proj'))?.source ?? '';
    expect(source.indexOf('AXRaise')).toBeLessThan(source.indexOf('frontmost'));
  });

  it('never tells the editor itself, so the happy path needs no second Automation grant', () => {
    const source = buildVscodeScript(target('/Users/test/proj'))?.source ?? '';
    expect(source).not.toContain('tell application "Visual Studio Code"');
    expect(source).toContain('set frontmost of process "Code" to true');
  });

  it('still reports success when only the frontmost call fails', () => {
    // Raising is the part that matters; a refused activation must not lose a good raise.
    const source = buildVscodeScript(target('/Users/test/proj'))?.source ?? '';
    expect(source).toContain(
      'try\n            set frontmost of process "Code" to true\n          end try',
    );
  });

  it('echoes a marker so "no matching window" is not confused with a failure', () => {
    const source = buildVscodeScript(target('/Users/test/proj'))?.source ?? '';
    expect(source).toContain('return "window"');
    expect(source.trimEnd().endsWith('return "none"')).toBe(true);
  });

  it('matches whole window names before it will accept a substring', () => {
    // Observed live: a plain `contains` raised a `cortex-joe` window for a `…/cortex` session.
    const source = buildVscodeScript(target('/Users/test/proj'))?.source ?? '';
    expect(source).toContain('repeat with pass in {1, 2}');
    expect(source).toContain('set matched to (wname is cand or wname ends with (sep & cand))');
    expect(source).toContain('set matched to (wname contains cand)');
    expect(source.indexOf('wname is cand')).toBeLessThan(source.indexOf('wname contains cand'));
  });

  it('builds the em-dash title separator by code point, keeping the source ASCII', () => {
    expect(buildVscodeScript(target('/Users/test/proj'))?.source).toContain(
      'set sep to " " & (character id 8212) & " "',
    );
  });

  it('searches the deepest path segment first', () => {
    expect(buildVscodeScript(target('/Users/test/GitHub/proj'))?.source).toContain(
      'set candidates to {"proj", "GitHub", "test"}',
    );
  });

  it('skips dot-directories so a git worktree path still reaches its repository name', () => {
    expect(
      buildVscodeScript(target('/Users/test/proj/.claude/worktrees/agent-1'))?.source,
    ).toContain('set candidates to {"agent-1", "worktrees", "proj"}');
  });

  it('escapes every candidate, including quotes, backslashes and spaces', () => {
    const source = buildVscodeScript(target('/Users/test/we"ird\\dir/my proj'))?.source ?? '';
    expect(source).toContain('set candidates to {"my proj", "we\\"ird\\\\dir", "test"}');
  });

  it('cannot be escaped by a cwd that tries to close the literal', () => {
    const source =
      buildVscodeScript(target('/Users/test/" & (do shell script "id") & "'))?.source ?? '';
    expect(source).not.toContain('do shell script "id")');
    expect(source).toContain('\\" & (do shell script \\"id\\") & \\"');
  });

  it('cannot be built without a cwd, so the plan degrades instead', () => {
    expect(buildVscodeScript(target(null))).toBeNull();
    expect(buildVscodeScript(target('/'))).toBeNull();
  });

  it('cannot be built for a host with no scriptable name', () => {
    expect(
      buildVscodeScript({
        host: { ...VSCODE, appName: null },
        cwd: '/Users/test/proj',
        ttyDevice: null,
      }),
    ).toBeNull();
    expect(
      buildVscodeScript({
        host: { ...VSCODE, processName: null },
        cwd: '/Users/test/proj',
        ttyDevice: null,
      }),
    ).toBeNull();
  });
});
