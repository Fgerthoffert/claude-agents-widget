import { visibleSessions } from './visibleSessions';
import type { Session } from './types';

/** The panel's four sections: under way, blocked, just finished, and settled. */
export interface SessionGroups {
  /** The agent is processing; nothing is expected of the user. */
  readonly running: readonly Session[];
  /** Blocked on an answer and unable to proceed without one. */
  readonly waiting: readonly Session[];
  /** Stopped, not blocked, and recent enough to be worth reading. */
  readonly done: readonly Session[];
  /** Cleared, or finished long enough ago that there is nothing to do about it (ADR-0019). */
  readonly idle: readonly Session[];
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
 * its own **Done** section below it. Which is which is decided at the source, by Claude Code's
 * own `status` and `waitingFor` (ADR-0018) — an idle session is never `needs_input` to begin
 * with, so there is nothing to special-case here.
 *
 * **Done** splits again into two, because it was doing two jobs: a session that finished a
 * minute ago is something to go and read, and one that was cleared or finished an hour ago is
 * furniture. `settleSession` decides which, and the second lands in **Idle** (ADR-0019).
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
    idle: visible.filter((session) => session.state === 'dormant'),
  };
};
