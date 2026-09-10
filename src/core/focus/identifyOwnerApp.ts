import type { Ancestor } from '../types';

import type { FocusHost } from './types';

/**
 * Recognised hosts, most specific marker first.
 *
 * Markers are matched against `args` (the full command line) and are **case-sensitive**: the
 * `Claude.app` / `Claude Helper` desktop-app processes must never look like a terminal host, and
 * bundle directory names carry their real casing. `Visual Studio Code - Insiders.app` does not
 * contain `Visual Studio Code.app`, so the two never collide.
 */
const HOSTS: readonly { readonly marker: string; readonly host: FocusHost }[] = [
  {
    marker: 'Visual Studio Code - Insiders.app',
    host: {
      kind: 'vscode-insiders',
      appName: 'Visual Studio Code - Insiders',
      processName: 'Code - Insiders',
      bundleId: 'com.microsoft.VSCodeInsiders',
      needsTty: false,
    },
  },
  {
    marker: 'Visual Studio Code.app',
    host: {
      kind: 'vscode',
      appName: 'Visual Studio Code',
      processName: 'Code',
      bundleId: 'com.microsoft.VSCode',
      needsTty: false,
    },
  },
  {
    marker: 'Cursor.app',
    host: {
      kind: 'cursor',
      appName: 'Cursor',
      processName: 'Cursor',
      // Cursor ships under a ToDesktop identifier; unverified on this machine (ADR-0007).
      bundleId: 'com.todesktop.230313mzl4w4u92',
      needsTty: false,
    },
  },
  {
    marker: 'iTerm.app',
    host: {
      kind: 'iterm2',
      appName: 'iTerm',
      processName: 'iTerm2',
      bundleId: 'com.googlecode.iterm2',
      needsTty: true,
    },
  },
  {
    marker: 'Terminal.app',
    host: {
      kind: 'terminal',
      appName: 'Terminal',
      processName: 'Terminal',
      bundleId: 'com.apple.Terminal',
      needsTty: true,
    },
  },
  {
    marker: 'Ghostty.app',
    host: {
      kind: 'ghostty',
      appName: 'Ghostty',
      processName: 'ghostty',
      bundleId: 'com.mitchellh.ghostty',
      // Ghostty's dictionary exposes `working directory` per surface, but no tty.
      needsTty: false,
    },
  },
  {
    marker: 'Warp.app',
    host: {
      kind: 'warp',
      // Warp ships no scripting dictionary, so there is no window adapter — only activation.
      appName: null,
      processName: 'Warp',
      bundleId: 'dev.warp.Warp-Stable',
      needsTty: false,
    },
  },
];

const UNKNOWN: FocusHost = {
  kind: 'unknown',
  appName: null,
  processName: null,
  bundleId: null,
  needsTty: false,
};

/**
 * Identifies the GUI app that owns a session from its parent-process chain.
 *
 * `ancestors` is nearest-first (ADR-0006), and the **nearest** recognised app wins: a session in
 * a VS Code integrated terminal has VS Code above the shell, and nothing further up the chain
 * (launchd) is focusable. An empty chain — every `source: 'scanner'` session — yields `unknown`.
 */
export const identifyOwnerApp = (ancestors: readonly Ancestor[]): FocusHost => {
  for (const ancestor of ancestors) {
    const match = HOSTS.find((candidate) => ancestor.args.includes(candidate.marker));
    if (match !== undefined) return match.host;
  }
  return UNKNOWN;
};
