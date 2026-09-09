import { formatTimeInState } from './formatTimeInState';
import type { Session } from './types';

/** The right-hand duration on a row: how long, and whether that time was spent working. */
export interface AgeDisplay {
  readonly kind: 'active' | 'inactive';
  /** ▶ while the agent is processing, ⏸ while nothing is happening. */
  readonly icon: string;
  readonly text: string;
  /** Spelled out for screen readers and the tooltip, where there is room for words. */
  readonly label: string;
}

/**
 * Splits the age into the two questions the user actually asks.
 *
 * A working session's `updatedAt` is stamped when the current turn began, so its age is the
 * length of *this* processing run rather than the session's lifetime; every other state stamps
 * it when the agent stopped, so the same number reads as how long nothing has happened.
 *
 * The two mean opposite things and must never be confused for one another, so they differ on
 * three channels at once: play against pause (shapes, not two similar clock faces), the working
 * accent colour against muted grey, and weight (ADR-0008).
 *
 * `null` for scanner-only sessions, whose timestamp is the sweep that found them.
 */
export const describeAge = (session: Session, nowMs: number): AgeDisplay | null => {
  const text = formatTimeInState(session, nowMs);
  if (text === null) return null;

  if (session.state === 'working') {
    return { kind: 'active', icon: '▶', text, label: `processing for ${text}` };
  }

  const verb = session.state === 'needs_input' ? 'waiting for you for' : 'inactive for';

  return { kind: 'inactive', icon: '⏸', text, label: `${verb} ${text}` };
};
