import { describe, expect, it } from 'vitest';

import { buildFocusScript } from './buildFocusScript';
import { identifyOwnerApp } from './identifyOwnerApp';
import type { FocusHost, FocusTarget } from './types';

const hostFor = (args: string): FocusHost => identifyOwnerApp([{ pid: 1, comm: '', args }]);

const CWD = '/Users/test/proj';

const vscode: FocusTarget = {
  host: hostFor('/Applications/Visual Studio Code.app/Contents/MacOS/Code'),
  cwd: CWD,
  ttyDevice: null,
};
const cursor: FocusTarget = {
  host: hostFor('/Applications/Cursor.app/Contents/MacOS/Cursor'),
  cwd: CWD,
  ttyDevice: null,
};
const insiders: FocusTarget = {
  host: hostFor('/Applications/Visual Studio Code - Insiders.app/Contents/MacOS/Electron'),
  cwd: CWD,
  ttyDevice: null,
};
const iterm2: FocusTarget = {
  host: hostFor('/Applications/iTerm.app/Contents/MacOS/iTerm2'),
  cwd: CWD,
  ttyDevice: '/dev/ttys004',
};
const terminal: FocusTarget = {
  host: hostFor('/System/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal'),
  cwd: CWD,
  ttyDevice: '/dev/ttys004',
};
const ghostty: FocusTarget = {
  host: hostFor('/Applications/Ghostty.app/Contents/MacOS/ghostty'),
  cwd: CWD,
  ttyDevice: null,
};

const all = [vscode, cursor, insiders, iterm2, terminal, ghostty];

describe('buildFocusScript', () => {
  it.each(all)('dispatches $host.kind to an adapter that tells its own app', (target) => {
    expect(buildFocusScript(target)?.source).toContain(
      `tell application "${target.host.appName ?? ''}"`,
    );
  });

  it.each(all)('stamps $host.kind with the marker the shell capability requires', (target) => {
    expect(buildFocusScript(target)?.source.split('\n')[0]).toBe('-- claude-agents-widget focus');
  });

  it('claims window precision for editors and tab precision for terminals', () => {
    expect(buildFocusScript(vscode)?.method).toBe('window');
    expect(buildFocusScript(iterm2)?.method).toBe('tab');
  });

  it('drives the editor variants through the VS Code adapter with their own process name', () => {
    expect(buildFocusScript(insiders)?.source).toContain('windows of process "Code - Insiders"');
    expect(buildFocusScript(cursor)?.source).toContain('windows of process "Cursor"');
  });

  it('has no script for a host that ships no scripting dictionary', () => {
    const warp = hostFor('/Applications/Warp.app/Contents/MacOS/stable');
    expect(warp.kind).toBe('warp');
    expect(buildFocusScript({ host: warp, cwd: CWD, ttyDevice: null })).toBeNull();
  });

  it('has no script for an unknown host', () => {
    expect(buildFocusScript({ host: hostFor('/bin/zsh'), cwd: CWD, ttyDevice: null })).toBeNull();
  });

  it('has no script when the adapter is missing its hint', () => {
    expect(buildFocusScript({ ...terminal, ttyDevice: null })).toBeNull();
    expect(buildFocusScript({ ...vscode, cwd: null })).toBeNull();
  });
});
