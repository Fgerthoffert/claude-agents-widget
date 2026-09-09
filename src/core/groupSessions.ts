import { visibleSessions } from './visibleSessions';
import type { Session } from './types';

/** The panel's two sections: what is under way, and what is stuck on the user. */
export interface SessionGroups {
  /** The agent is processing; nothing is expected of the user. */
  readonly running: readonly Session[];
  /** Blocked on a prompt, or finished and waiting to be looked at. */
  readonly waiting: readonly Session[];
}

/**
 * Splits the list by whether the user has to do something.
 *
 * That is the only question the panel exists to answer, and it does not map to the four states
 * one-to-one: `needs_input` and `done_idle` are different reasons for the same conclusion — the
 * agent has stopped and it is the user's move. `ended` sessions are dropped entirely.
 *
 * Store order is preserved inside each group, so rows never move under the cursor.
 */
export const groupSessions = (sessions: readonly Session[]): SessionGroups => {
  const visible = visibleSessions(sessions);

  return {
    running: visible.filter((session) => session.state === 'working'),
    waiting: visible.filter((session) => session.state !== 'working'),
  };
};
