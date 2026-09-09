import type { SessionCounts } from './countSessionStates';

/** Set beside the tray icon when at least one session has stopped and is waiting on the user. */
const ATTENTION_MARK = '●';

/**
 * The menu bar label: a mark when something is ready to look at, nothing otherwise.
 *
 * Deliberately not a tally (ADR-0008, second revision). A number in the menu bar has to be read
 * before it can be acted on, and the answer it gives — "four" — is not the question the user
 * asks of the menu bar, which is only "is any of this mine to deal with?". The count still
 * exists in words one click away, in the dropdown summary, where there is room to spell it out.
 *
 * `needs_input` and `done_idle` both count as ready: different reasons, same conclusion — the
 * agent stopped and it is the user's move. This is the same split the panel's two sections use
 * (`groupSessions`), so the mark and the "Waiting for you" heading can never disagree. `working`
 * raises nothing: a session that is getting on with it is exactly what needs no attention.
 */
export const formatTrayLabel = (counts: SessionCounts): string =>
  counts.needsInput + counts.doneIdle > 0 ? ATTENTION_MARK : '';
