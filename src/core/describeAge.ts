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
 * The duration is `stateSince` — how long the session has been in the state it is in, which is
 * not the same as how old it is (ADR-0018). For a working session that is the length of *this*
 * run; for a stopped one it is how long nothing has happened.
 *
 * The two mean opposite things and must never be confused for one another, so they differ on
 * three channels at once: play against pause (shapes, not two similar clock faces), the working
 * accent colour against muted grey, and weight (ADR-0008).
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
