import { visibleSessions } from './visibleSessions';
import type { Session } from './types';

/** The panel's three sections: under way, blocked on the user, and finished. */
export interface SessionGroups {
  /** The agent is processing; nothing is expected of the user. */
  readonly running: readonly Session[];
  /** Blocked on an answer and unable to proceed without one. */
  readonly waiting: readonly Session[];
  /** Stopped, and not blocked: a finished turn, or a fresh prompt nobody has typed into yet. */
  readonly done: readonly Session[];
}

/**
 * Splits the list by what the user has to do about it.
 *
 * Three answers, not two. "Waiting for you" used to hold `needs_input` *and* `done_idle` on the
 * grounds that both mean the agent stopped and it is the user's move — true, but not what the
 * words say, and the user said so (ADR-0014):
 *
 * > the 'waiting for you' should only be for situations in which the agent is actually asking a
 * > question and is waiting for an answer before being able to proceed
 *
 * So **Waiting for you** is now exactly `needs_input`: a permission prompt or an explicit
 * question, where the agent cannot continue until it is answered. Finished and idle work moved to
 * its own **Done** section below it, and `idle_prompt` — Claude Code noting that a session has
 * been sitting idle, which blocks nothing — is classified as `done_idle` at the source
 * (`mapHookEventToState`) rather than being special-cased here.
 *
 * `ended` sessions are dropped entirely. Store order is preserved inside each group, so rows
 * never move under the cursor.
 */
export const groupSessions = (sessions: readonly Session[]): SessionGroups => {
  const visible = visibleSessions(sessions);

  return {
    running: visible.filter((session) => session.state === 'working'),
    waiting: visible.filter((session) => session.state === 'needs_input'),
    done: visible.filter((session) => session.state === 'done_idle'),
  };
};
