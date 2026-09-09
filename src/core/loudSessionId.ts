import type { Session } from './types';

/**
 * Which session, if any, the panel should shout about.
 *
 * At most one — that is the whole point. The original design gave every `needs_input` row the
 * accent bar, the wash, the pulse and a heavier title, which works with one blocked session and
 * collapses with four: if everything shouts, nothing does, and the user is left to re-read the
 * list they were trying to avoid reading (ADR-0013).
 *
 * The loud one is the **most recent** blocked session — store order already puts `needs_input`
 * first, most recently changed first, so it is simply the first one that is still unacknowledged.
 *
 * Acknowledgement is keyed to the event, not the session: `acknowledged` maps a session id to the
 * `updatedAt` the user was last shown. Clicking a row records the value it had at that moment, so
 * the row goes quiet — the user has seen it and clearly does not need it shouted at again. When
 * the agent then does something new, `updatedAt` moves on, the recorded value no longer matches,
 * and the row is loud again. That is the correct reading of "the user was aware of the thing":
 * they were aware of *that* thing, not of whatever happened next.
 */
export const loudSessionId = (
  sessions: readonly Session[],
  acknowledged: ReadonlyMap<string, string>,
): string | null =>
  sessions.find(
    (session) =>
      session.state === 'needs_input' && acknowledged.get(session.sessionId) !== session.updatedAt,
  )?.sessionId ?? null;
