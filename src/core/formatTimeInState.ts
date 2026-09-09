import { formatDuration } from './formatDuration';
import type { Session } from './types';

/**
 * The right-aligned age on a panel row, or `null` when it would be a lie.
 *
 * `updatedAt` is only a real state-transition timestamp on the hook path. The reconciler
 * stamps scanner-discovered sessions with the time of the sweep that saw them (ADR-0006), so
 * their age would reset every five seconds and always read a few seconds — worse than blank.
 * Those rows show no age until a hook event takes ownership of the session.
 */
export const formatTimeInState = (session: Session, nowMs: number): string | null => {
  if (session.source !== 'hook') return null;

  const updatedMs = Date.parse(session.updatedAt);
  if (Number.isNaN(updatedMs)) return null;

  return formatDuration(nowMs - updatedMs);
};
