import { buildGhosttyScript } from './adapters/buildGhosttyScript';
import { buildItermScript } from './adapters/buildItermScript';
import { buildTerminalScript } from './adapters/buildTerminalScript';
import { buildVscodeScript } from './adapters/buildVscodeScript';
import type { FocusHostKind, FocusScript, FocusTarget } from './types';

/**
 * First line of every generated script. `capabilities/default.json` requires it, so an argument
 * that did not come from this module cannot be handed to `osascript`.
 */
const MARKER = '-- claude-agents-widget focus';

/** Adding a terminal is one adapter file plus one entry here (ADR-0007). */
const ADAPTERS: Partial<Record<FocusHostKind, (target: FocusTarget) => FocusScript | null>> = {
  vscode: buildVscodeScript,
  'vscode-insiders': buildVscodeScript,
  cursor: buildVscodeScript,
  iterm2: buildItermScript,
  terminal: buildTerminalScript,
  ghostty: buildGhosttyScript,
};

/**
 * The window-level AppleScript for a target, or `null` when no adapter can do better than
 * activating the app (unrecognised host, no scripting dictionary, or a missing tty/cwd hint).
 *
 * Every script echoes `"window"`, `"tab"` or `"none"` so that "ran but matched nothing" stays
 * distinguishable from "failed" — see `interpretFocusAttempt`.
 */
export const buildFocusScript = (target: FocusTarget): FocusScript | null => {
  const adapter = ADAPTERS[target.host.kind];
  if (adapter === undefined) return null;

  const script = adapter(target);
  if (script === null) return null;

  return { method: script.method, source: `${MARKER}\n${script.source}` };
};
