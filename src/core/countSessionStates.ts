import type { Session } from './types';

/** How many sessions sit in each bucket the tray cares about. */
export interface SessionCounts {
  readonly working: number;
  readonly needsInput: number;
  readonly doneIdle: number;
  /** Cleared, or finished long enough ago to stop being worth a look (ADR-0019). */
  readonly dormant: number;
}

/**
 * Buckets sessions for the tray. `ended` sessions are counted nowhere: they are on their way out
 * of the store and reporting them would inflate the summary.
 */
export const countSessionStates = (sessions: readonly Session[]): SessionCounts => ({
  working: sessions.filter((session) => session.state === 'working').length,
  needsInput: sessions.filter((session) => session.state === 'needs_input').length,
  doneIdle: sessions.filter((session) => session.state === 'done_idle').length,
  dormant: sessions.filter((session) => session.state === 'dormant').length,
});
