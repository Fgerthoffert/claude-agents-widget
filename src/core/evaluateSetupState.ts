import { mergeHookSettings } from './mergeHookSettings';
import type { ClaudeSettings, Session } from './types';
import type { FocusMethod } from './focus/types';

/** How precise the last click was, and whether macOS refused it. */
export interface LastFocusOutcome {
  readonly ok: boolean;
  /** How precisely the click landed. Only proves consent alongside `degraded === false`. */
  readonly method: FocusMethod | null;
  readonly permissionDenied: boolean;
  /**
   * True when the click only worked because a fallback picked it up. `open -b <bundle> <path>`
   * can land on the exact window and so reports `method: 'window'`, but it needs no
   * Accessibility grant at all — so without this flag a VS Code user who had never granted
   * Accessibility was told step 2 was done, and never found out why their clicks were imprecise.
   */
  readonly degraded: boolean;
  /** Machine-readable method or failure reason, for the diagnostics dump. */
  readonly detail: string;
}

/** Everything the shell can observe, gathered by `src/detection/probeSetup.ts`. */
export interface SetupProbe {
  /** Parsed `~/.claude/settings.json`, or `null` when it does not exist. */
  readonly settings: ClaudeSettings | null;
  /** The file exists but could not be parsed — nothing may be written to it. */
  readonly settingsUnreadable: boolean;
  /** Absolute path of the installed hook script; our entries are identified by it. */
  readonly hookPath: string;
  readonly hookScriptInstalled: boolean;
  readonly sessions: readonly Session[];
  readonly lastFocus: LastFocusOutcome | null;
}

/**
 * `unknown` is a first-class answer: whether macOS granted Accessibility cannot be read, only
 * discovered by trying, and claiming otherwise would make the checklist lie.
 */
export type SetupStepStatus = 'done' | 'todo' | 'blocked' | 'unknown';

export interface SetupState {
  readonly hooks: {
    readonly status: SetupStepStatus;
    /** Events that already invoke our hook script. */
    readonly registeredEvents: readonly string[];
    /** Events an install would add. */
    readonly missingEvents: readonly string[];
    readonly scriptInstalled: boolean;
  };
  readonly permissions: {
    readonly status: SetupStepStatus;
    readonly lastFocus: LastFocusOutcome | null;
  };
  readonly sessions: {
    readonly status: SetupStepStatus;
    readonly total: number;
    readonly hookOwned: number;
    readonly scannerOnly: number;
  };
  /** True when the panel should open on the setup view rather than the session list. */
  readonly needsSetup: boolean;
}

/**
 * Turns what the shell could observe into the three-step checklist the setup view renders.
 *
 * Hook presence is decided by re-running the tested `mergeHookSettings` in "what would it add"
 * mode: identity is the hook path, so this answers "are we registered" with exactly the logic
 * that registers us, and a partially-installed settings file (some events ours, some not)
 * reports as `todo` with the missing ones named rather than as an opaque failure.
 *
 * The macOS permission step is deliberately never `done` on faith. Only an *undegraded* click
 * that reached `window` or `tab` precision proves Accessibility consent was granted — the
 * fallback that opens a folder reaches the same precision without it. A refused click proves
 * consent is missing, and anything else is `unknown`.
 */
export const evaluateSetupState = (probe: SetupProbe): SetupState => {
  const merge = mergeHookSettings(probe.settings ?? {}, probe.hookPath);
  const hooksRegistered = merge.added.length === 0 && probe.hookScriptInstalled;

  const hookOwned = probe.sessions.filter((session) => session.source === 'hook').length;
  const scannerOnly = probe.sessions.length - hookOwned;

  const focus = probe.lastFocus;
  const permissionStatus: SetupStepStatus =
    focus === null
      ? 'unknown'
      : focus.permissionDenied
        ? 'blocked'
        : focus.ok && !focus.degraded && (focus.method === 'window' || focus.method === 'tab')
          ? 'done'
          : 'unknown';

  return {
    hooks: {
      status: probe.settingsUnreadable ? 'blocked' : hooksRegistered ? 'done' : 'todo',
      registeredEvents: merge.unchanged,
      missingEvents: merge.added,
      scriptInstalled: probe.hookScriptInstalled,
    },
    permissions: { status: permissionStatus, lastFocus: focus },
    sessions: {
      // No sessions at all says nothing about the hooks — a user may simply have none running.
      status: hookOwned > 0 ? 'done' : probe.sessions.length > 0 ? 'todo' : 'unknown',
      total: probe.sessions.length,
      hookOwned,
      scannerOnly,
    },
    needsSetup: probe.settingsUnreadable || !hooksRegistered,
  };
};
