// The one multi-export module in src/core (see CLAUDE.md): shared shapes, no behaviour.

/** PRD state model. `ended` only reaches the store for a background session that was stopped. */
export type SessionState = 'working' | 'needs_input' | 'done_idle' | 'ended';

/** How the session was started: attached to a terminal, or dispatched to the supervisor. */
export type SessionKind = 'interactive' | 'background';

/**
 * One link in a session's parent-process chain, read live from `ps` by the focus engine.
 * `comm` is the executable path truncated by `ps` (16 chars on macOS), so prefer `args`
 * when matching and treat `comm` as a hint.
 */
export interface Ancestor {
  readonly pid: number;
  readonly comm: string;
  readonly args: string;
}

/** A row of `ps -axo pid=,ppid=,command=`. */
export interface ProcessEntry {
  readonly pid: number;
  readonly ppid: number;
  readonly command: string;
}

/**
 * One session exactly as `claude agents --json` reports it, once validated.
 *
 * Everything here is Claude Code's own answer about its own sessions (ADR-0018). Nothing is
 * inferred from a process table, a transcript file or a hook event.
 */
export interface SessionSnapshot {
  /** The full session UUID when there is one, else the supervisor's short id. */
  readonly sessionId: string;
  /** Claude Code's own session name, already generated for it. `null` when unnamed. */
  readonly title: string | null;
  readonly cwd: string | null;
  readonly state: SessionState;
  readonly kind: SessionKind;
  /** Why it is blocked, verbatim: `permission prompt`, `input needed`, … `null` when it is not. */
  readonly waitingFor: string | null;
  /** The session's own process, and the thread the focus engine pulls to find its window. */
  readonly claudePid: number | null;
  /** Session creation time, epoch ms. */
  readonly startedAtMs: number | null;
}

/** A snapshot plus the one thing only the widget can know: how long this state has held. */
export interface Session extends SessionSnapshot {
  /**
   * When the widget first saw this session in this state, epoch ms.
   *
   * `claude agents --json` reports `startedAt` — when the session was created — which answers
   * "how old" and not "how long has it been stuck", and the second is the question a row exists
   * to answer. So the widget times state changes itself (`carryStateSince`); it is the only
   * derived value left in the pipeline, and it is derived from Claude Code's own state rather
   * than instead of it.
   */
  readonly stateSince: number;
}

/** Whether detection is working, so the panel never claims an empty list is good news. */
export interface DetectionHealth {
  /** Nothing is being detected at all, and why. `null` when sweeps are producing data. */
  readonly failure: string | null;
  /** Working, but with something reduced — each entry is one human-readable reason. */
  readonly degraded: readonly string[];
}
