import type { SessionKind, SessionState } from './types';

/** The fields `claude agents --json` offers about liveness, as raw strings. */
export interface AgentStatusInput {
  readonly kind: SessionKind;
  /** Present while the process is alive: `busy`, `waiting`, `idle`. */
  readonly status: string | null;
  /** Background sessions only: `working`, `blocked`, `done`, `failed`, `stopped`. */
  readonly state: string | null;
}

/** `status` describes a *live* process, and outranks `state` whenever it is there. */
const fromStatus: Readonly<Record<string, SessionState>> = {
  busy: 'working',
  waiting: 'needs_input',
  idle: 'done_idle',
};

/** `state` is the supervisor's verdict on a background session, alive or not. */
const fromState: Readonly<Record<string, SessionState>> = {
  working: 'working',
  blocked: 'needs_input',
  done: 'done_idle',
  failed: 'done_idle',
  stopped: 'ended',
};

/**
 * Claude Code's own words for what a session is doing, in the three the panel shows.
 *
 * This is the whole of the state machine now (ADR-0018). There is no event log to fold, no
 * notification matcher to classify and no transcript mtime to infer from: the CLI is asked what
 * its sessions are doing and it answers.
 *
 * `status` wins over `state` because it is only present while the process is alive, and a live
 * process's current activity is more specific than the supervisor's record of the job. A
 * background session whose process has exited has no `status`, and then `state` is all there is.
 *
 * `failed` maps to `done_idle` rather than to a failure state of its own: the panel's question is
 * "is this mine to deal with", and a failed run is finished work waiting to be read, exactly like
 * a successful one. `stopped` maps to `ended`, which `visibleSessions` drops.
 *
 * An unrecognised value falls through to `done_idle` — the state that claims the least. A future
 * status the widget has never heard of should show the session as present and quiet, not invent
 * activity or a question that may not exist.
 */
export const mapAgentStatus = ({ kind, status, state }: AgentStatusInput): SessionState => {
  const live = status === null ? undefined : fromStatus[status];
  if (live !== undefined) return live;

  const recorded = state === null ? undefined : fromState[state];
  if (recorded !== undefined) return recorded;

  // An interactive session only appears in the list while it exists, so "no idea" means idle.
  return kind === 'background' && state === null && status === null ? 'ended' : 'done_idle';
};
