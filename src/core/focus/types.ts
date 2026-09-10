// Types-only module for the focus engine, kept out of src/core/types.ts so the focus engine
// owns its vocabulary (and so phases 3/4 do not collide on one shared file). See ADR-0007.

/** Terminal or editor that owns a session's process chain. */
export type FocusHostKind =
  'vscode' | 'vscode-insiders' | 'cursor' | 'iterm2' | 'terminal' | 'ghostty' | 'warp' | 'unknown';

/** Everything the adapters and the fallback chain need to know about a host app. */
export interface FocusHost {
  readonly kind: FocusHostKind;
  /** Name for `tell application "…"`. `null` when the app is not scriptable by name. */
  readonly appName: string | null;
  /** Name of the process as `System Events` sees it (differs from `appName` for Electron apps). */
  readonly processName: string | null;
  /** For `open -b`. `null` only for `unknown`, which is why unknown cannot even degrade. */
  readonly bundleId: string | null;
  /** True when the adapter matches windows by tty, so the shell must look one up. */
  readonly needsTty: boolean;
}

/** A session resolved to something focusable. */
export interface FocusTarget {
  readonly host: FocusHost;
  readonly cwd: string | null;
  /** Full device path, e.g. `/dev/ttys003`, as the terminal AppleScript APIs report it. */
  readonly ttyDevice: string | null;
}

/** How precisely the click landed. `app` means "we raised the app, not the window". */
export type FocusMethod = 'window' | 'tab' | 'app';

/** An AppleScript an adapter produced, plus the precision it claims when it succeeds. */
export interface FocusScript {
  readonly source: string;
  readonly method: FocusMethod;
}

/** Shell commands the focus engine may run; each is allowlisted in capabilities/default.json. */
export type FocusCommandName = 'osascript' | 'open-bundle' | 'ps' | 'ps-tty';

/** One attempt in the degradation chain. */
export interface FocusStep {
  readonly command: FocusCommandName;
  readonly args: readonly string[];
  readonly method: FocusMethod;
  /** True when this step is coarser than the ideal outcome for its host. */
  readonly degraded: boolean;
  /**
   * `marker`: the script echoes its method name on stdout, so "ran but matched nothing" is
   * distinguishable from "failed". `exit`: a zero exit code is the only signal available.
   */
  readonly success: 'marker' | 'exit';
}

export type FocusFailureReason =
  /** No ancestor chain at all — nothing to identify the host from. */
  | 'no-host'
  /** Host identified, but no bundle id to activate (or no adapter and no fallback). */
  | 'unsupported-host'
  /** macOS Automation or Accessibility consent missing — Phase 5's first-run guide. */
  | 'permission-denied'
  /** The script ran and found no matching window/tab. */
  | 'window-not-found'
  | 'script-failed'
  | 'timeout';

export interface FocusRunOutcome {
  /** Process exit code, or `null` when the runner timed out or never started it. */
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export interface FocusSuccess {
  readonly ok: true;
  readonly host: FocusHostKind;
  readonly method: FocusMethod;
  /** Reason the more precise attempt failed, when this success is a fallback. */
  readonly degradedFrom: FocusFailureReason | null;
  readonly detail: string | null;
}

export interface FocusFailure {
  readonly ok: false;
  readonly host: FocusHostKind;
  readonly reason: FocusFailureReason;
  readonly detail: string | null;
}

/** What `focusSession` returns. A click is never a no-op: worst case is a typed failure. */
export type FocusResult = FocusSuccess | FocusFailure;

/** Injected shell runner: the one impure dependency of the focus orchestration. */
export type FocusRunner = (
  command: FocusCommandName,
  args: readonly string[],
) => Promise<FocusRunOutcome>;
