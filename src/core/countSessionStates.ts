import type { SessionCounts } from './formatAggregate';
import type { Session } from './types';

/**
 * Buckets sessions for the menu bar label. `ended` sessions are counted nowhere: they are on
 * their way out of the store and reporting them would inflate the aggregate.
 */
export const countSessionStates = (sessions: readonly Session[]): SessionCounts => ({
  working: sessions.filter((session) => session.state === 'working').length,
  needsInput: sessions.filter((session) => session.state === 'needs_input').length,
  doneIdle: sessions.filter((session) => session.state === 'done_idle').length,
});
