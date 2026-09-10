import type { Session } from './types';
import type { FocusMethod } from './focus/types';

/** How precise the last click was, and whether macOS refused it. */
export interface LastFocusOutcome {
  readonly ok: boolean;
  /** How precisely the click landed. Only proves consent alongside `degraded === false`. */
  readonly method: FocusMethod | null;
  readonly permissionDenied: boolean;
  /**
   * True when the click only worked because a fallback picked it up, so it proves nothing about
   * the Accessibility grant.
   */
  readonly degraded: boolean;
  /** Machine-readable method or failure reason, for the diagnostics dump. */
  readonly detail: string;
}

/** Everything the setup view needs to describe itself. */
export interface SetupProbe {
  readonly sessions: readonly Session[];
  readonly lastFocus: LastFocusOutcome | null;
}

/**
 * `unknown` is a first-class answer: whether macOS granted Accessibility cannot be read, only
 * discovered by trying, and claiming otherwise would make the checklist lie.
 */
export type SetupStepStatus = 'done' | 'todo' | 'blocked' | 'unknown';

export interface SetupState {
  readonly permissions: {
    readonly status: SetupStepStatus;
    readonly lastFocus: LastFocusOutcome | null;
  };
  readonly sessions: {
    readonly total: number;
    readonly background: number;
  };
}

/**
 * What is left of setup: one macOS permission, and a count.
 *
 * There used to be three steps, and two of them were about installing a hook script into the
 * user's `~/.claude/settings.json` so that the widget could be told what its sessions were
 * doing. `claude agents --json` tells it directly, so there is nothing to install, nothing to
 * consent to, and no way for the install to be half-done (ADR-0018). What remains cannot be
 * automated at all: macOS will not let an app request Accessibility for itself.
 *
 * That step is deliberately never `done` on faith. Only an *undegraded* click that reached
 * `window` or `tab` precision proves the grant was given — the fallback that activates an app
 * reaches neither. A refused click proves it is missing, and anything else is `unknown`.
 */
export const evaluateSetupState = (probe: SetupProbe): SetupState => {
  const focus = probe.lastFocus;
  const status: SetupStepStatus =
    focus === null
      ? 'unknown'
      : focus.permissionDenied
        ? 'blocked'
        : focus.ok && !focus.degraded && (focus.method === 'window' || focus.method === 'tab')
          ? 'done'
          : 'unknown';

  return {
    permissions: { status, lastFocus: focus },
    sessions: {
      total: probe.sessions.length,
      background: probe.sessions.filter((session) => session.kind === 'background').length,
    },
  };
};
