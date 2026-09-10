import { describe, expect, it } from 'vitest';

import type { Ancestor } from '../types';

import { identifyOwnerApp } from './identifyOwnerApp';

/** Nearest-first, as the hook records it (ADR-0006); pids are decorative here. */
const chain = (...args: readonly string[]): readonly Ancestor[] =>
  args.map((value, index) => ({
    pid: 100 + index,
    comm: value.split(/\s+/)[0] ?? '',
    args: value,
  }));

const VSCODE_HELPER =
  '/Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper.app/Contents/MacOS/' +
  'Code Helper --type=utility --utility-sub-type=node.mojom.NodeService --lang=en-GB';

// The chain verified live on the owner's machine in phase 2, with real paths swapped out.
const VSCODE_CHAIN = chain(
  '/bin/zsh',
  'claude',
  '/bin/zsh',
  VSCODE_HELPER,
  '/Applications/Visual Studio Code.app/Contents/MacOS/Code',
  '/sbin/launchd',
);

describe('identifyOwnerApp', () => {
  it('identifies VS Code from the real integrated-terminal chain', () => {
    expect(identifyOwnerApp(VSCODE_CHAIN)).toEqual({
      kind: 'vscode',
      appName: 'Visual Studio Code',
      processName: 'Code',
      bundleId: 'com.microsoft.VSCode',
      needsTty: false,
    });
  });

  it('identifies iTerm2 and asks for a tty', () => {
    const host = identifyOwnerApp(
      chain('-zsh', '/Applications/iTerm.app/Contents/MacOS/iTerm2', '/sbin/launchd'),
    );
    expect(host.kind).toBe('iterm2');
    expect(host.appName).toBe('iTerm');
    expect(host.needsTty).toBe(true);
  });

  it('identifies Terminal.app', () => {
    const host = identifyOwnerApp(
      chain('/bin/zsh', '/System/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal'),
    );
    expect(host.kind).toBe('terminal');
    expect(host.bundleId).toBe('com.apple.Terminal');
    expect(host.needsTty).toBe(true);
  });

  it('identifies Ghostty, which matches on cwd rather than tty', () => {
    const host = identifyOwnerApp(
      chain('/bin/zsh', '/Applications/Ghostty.app/Contents/MacOS/ghostty'),
    );
    expect(host.kind).toBe('ghostty');
    expect(host.appName).toBe('Ghostty');
    expect(host.needsTty).toBe(false);
  });

  it('identifies Warp as activation-only, since it ships no scripting dictionary', () => {
    const host = identifyOwnerApp(
      chain('/bin/zsh', '/Applications/Warp.app/Contents/MacOS/stable'),
    );
    expect(host.kind).toBe('warp');
    expect(host.appName).toBeNull();
    expect(host.bundleId).toBe('dev.warp.Warp-Stable');
  });

  it('distinguishes VS Code Insiders from stable VS Code', () => {
    const host = identifyOwnerApp(
      chain('/Applications/Visual Studio Code - Insiders.app/Contents/MacOS/Electron'),
    );
    expect(host.kind).toBe('vscode-insiders');
    expect(host.processName).toBe('Code - Insiders');
  });

  it('identifies Cursor', () => {
    expect(identifyOwnerApp(chain('/Applications/Cursor.app/Contents/MacOS/Cursor')).kind).toBe(
      'cursor',
    );
  });

  it('takes the nearest GUI app when the chain contains two', () => {
    // A terminal launched from an editor: the terminal is what actually holds the session.
    const host = identifyOwnerApp(
      chain(
        '/bin/zsh',
        '/Applications/iTerm.app/Contents/MacOS/iTerm2',
        '/Applications/Visual Studio Code.app/Contents/MacOS/Code',
      ),
    );
    expect(host.kind).toBe('iterm2');
  });

  it('never mistakes the Claude desktop app for a terminal host', () => {
    const host = identifyOwnerApp(
      chain(
        '/Applications/Claude.app/Contents/Frameworks/Claude Helper.app/Contents/MacOS/Claude Helper --type=renderer',
        '/Applications/Claude.app/Contents/MacOS/Claude',
      ),
    );
    expect(host.kind).toBe('unknown');
    expect(host.bundleId).toBeNull();
  });

  it('returns unknown for a bare login shell under launchd', () => {
    expect(identifyOwnerApp(chain('/bin/zsh', '/usr/bin/login -pfl test /bin/zsh')).kind).toBe(
      'unknown',
    );
  });

  it('returns unknown for a scanner session, which carries no ancestors', () => {
    expect(identifyOwnerApp([]).kind).toBe('unknown');
  });

  it('matches case-sensitively, so a lowercased path is not a host', () => {
    expect(
      identifyOwnerApp(chain('/applications/visual studio code.app/contents/macos/code')).kind,
    ).toBe('unknown');
  });
});
