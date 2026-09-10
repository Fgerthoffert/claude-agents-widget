import type { SessionState } from './types';

/** How long a finished session stays worth a look before it settles out of the way. */
export const SETTLE_AFTER_MS = 30 * 60 * 1000;

export interface SettleInput {
  /** The state Claude Code's `status` mapped to. */
  readonly state: SessionState;
  /** Claude Code's session name, or `null` when it has never generated one. */
  readonly title: string | null;
  /** How long the session has held this state, in ms. */
  readonly heldMs: number;
}

/**
 * Separates a session that has just finished from one there is no longer anything to see in.
 *
 * "Done" was doing two jobs. An agent that finished a minute ago is something to go and read; an
 * agent that finished an hour ago, or one that was cleared and never used again, is furniture.
 * Both sat in the same section looking identical, so the section stopped answering the question
 * it exists for (ADR-0019):
 *
 * > I want to differentiate betwen sessions that were recently done and I can look at, from
 * > sessions that were cleared (and nothing else happened) or session that have been done for
 * > some time and already looked at.
 *
 * Only a finished session can settle. `working` is working, and a blocked session is blocked
 * however long it has been waiting — an agent stuck on a question for two hours is the *last*
 * thing to dim.
 *
 * Two ways in:
 *
 * - **No name.** Claude Code names a session from its first prompt, and names it eagerly enough
 *   that even "I don't see a coding task to summarize" becomes one. So a session with no name is
 *   one where nothing has been asked: freshly started, or cleared with `/clear`, which mints a
 *   new session in the same terminal. Either way there is nothing in it to read.
 * - **Time.** Thirty minutes in the same finished state. Long enough that a session you finished
 *   and meant to come back to is still in `Done`, short enough that yesterday's work is not.
 */
export const settleSession = ({ state, title, heldMs }: SettleInput): SessionState => {
  if (state !== 'done_idle') return state;
  if (title === null) return 'dormant';

  return heldMs >= SETTLE_AFTER_MS ? 'dormant' : 'done_idle';
};
