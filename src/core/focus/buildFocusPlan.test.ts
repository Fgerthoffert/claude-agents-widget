import { describe, expect, it } from 'vitest';

import { buildFocusPlan } from './buildFocusPlan';
import { identifyOwnerApp } from './identifyOwnerApp';
import type { FocusHost } from './types';

const hostFor = (args: string): FocusHost => identifyOwnerApp([{ pid: 1, comm: '', args }]);

const VSCODE = hostFor('/Applications/Visual Studio Code.app/Contents/MacOS/Code');
const TERMINAL = hostFor('/System/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal');
const WARP = hostFor('/Applications/Warp.app/Contents/MacOS/stable');
const UNKNOWN = hostFor('/bin/zsh');

describe('buildFocusPlan', () => {
  it('tries the exact window, then the folder open, then plain activation for VS Code', () => {
    const plan = buildFocusPlan({ host: VSCODE, cwd: '/Users/test/proj', ttyDevice: null });
    expect(plan.map((step) => [step.command, step.method, step.degraded])).toEqual([
      ['osascript', 'window', false],
      ['open-bundle-path', 'window', true],
      ['open-bundle', 'app', true],
    ]);
  });

  it('passes the cwd to the folder-open step, which needs no Accessibility consent', () => {
    const plan = buildFocusPlan({ host: VSCODE, cwd: '/Users/test/my proj', ttyDevice: null });
    expect(plan[1]?.args).toEqual(['-b', 'com.microsoft.VSCode', '/Users/test/my proj']);
    expect(plan[1]?.success).toBe('exit');
  });

  it('never asks a terminal to open a path, which would spawn a new window', () => {
    const plan = buildFocusPlan({
      host: TERMINAL,
      cwd: '/Users/test/proj',
      ttyDevice: '/dev/ttys003',
    });
    expect(plan.map((step) => step.command)).toEqual(['osascript', 'open-bundle']);
  });

  it('judges the script step by its marker, not its exit code', () => {
    const plan = buildFocusPlan({ host: VSCODE, cwd: '/Users/test/proj', ttyDevice: null });
    expect(plan[0]?.success).toBe('marker');
    expect(plan[0]?.args[0]).toBe('-e');
  });

  it('falls back to activation alone when no adapter can build a script', () => {
    const plan = buildFocusPlan({ host: TERMINAL, cwd: null, ttyDevice: null });
    expect(plan.map((step) => step.command)).toEqual(['open-bundle']);
    expect(plan[0]?.args).toEqual(['-b', 'com.apple.Terminal']);
  });

  it('still activates a host with no scripting dictionary at all', () => {
    const plan = buildFocusPlan({ host: WARP, cwd: '/Users/test/proj', ttyDevice: null });
    expect(plan.map((step) => step.command)).toEqual(['open-bundle']);
  });

  it('is empty only for a host with no bundle id, the one unfocusable case', () => {
    expect(buildFocusPlan({ host: UNKNOWN, cwd: '/Users/test/proj', ttyDevice: null })).toEqual([]);
  });

  it('omits the folder-open step for an editor with no known cwd', () => {
    const plan = buildFocusPlan({ host: VSCODE, cwd: null, ttyDevice: null });
    expect(plan.map((step) => step.command)).toEqual(['open-bundle']);
  });
});
