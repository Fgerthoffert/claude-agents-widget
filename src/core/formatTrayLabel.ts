import type { SessionCounts } from './countSessionStates';

/** Set beside the tray icon when at least one session is blocked on an answer from the user. */
const ATTENTION_MARK = '●';

/**
 * The menu bar label: a mark when an agent is blocked on the user, nothing otherwise.
 *
 * Deliberately not a tally (ADR-0008, second revision). A number in the menu bar has to be read
 * before it can be acted on, and the answer it gives — "four" — is not the question the user
 * asks of the menu bar, which is only "is any of this mine to deal with?". The count still
 * exists in words one click away, in the dropdown summary, where there is room to spell it out.
 *
 * Only `needs_input` raises it (ADR-0014). `done_idle` used to as well, on the grounds that a
 * stopped agent is the user's move either way — but a *finished* agent making the menu bar shout
 * is the mark crying wolf, and a mark that is usually noise stops being read. `working` raises
 * nothing either: a session getting on with it is exactly what needs no attention. This is the
 * same narrowing `groupSessions` applies, so the mark and the "Waiting for you" heading can never
 * disagree.
 */
export const formatTrayLabel = (counts: SessionCounts): string =>
  counts.needsInput > 0 ? ATTENTION_MARK : '';
