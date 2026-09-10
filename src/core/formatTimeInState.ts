import { formatDuration } from './formatDuration';
import type { Session } from './types';

/**
 * The right-aligned age on a panel row.
 *
 * `stateSince` is a real state-transition timestamp for every session, so unlike the old
 * two-source pipeline there is no longer a class of row whose age would be a lie. Scanner-found
 * sessions used to be stamped with the sweep that saw them, which reset every five seconds, so
 * they showed nothing at all (ADR-0008); with Claude Code reporting the state and the widget
 * timing the changes, every row can say how long (ADR-0018).
 *
 * `null` only for a clock that has gone backwards — a machine waking from sleep can hand us a
 * `stateSince` in the future, and "-3s" is worse than blank.
 */
export const formatTimeInState = (session: Session, nowMs: number): string | null => {
  const elapsed = nowMs - session.stateSince;
  return elapsed < 0 ? null : formatDuration(elapsed);
};
