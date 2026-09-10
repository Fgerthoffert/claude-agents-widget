import type { Session, SessionSnapshot } from './types';

/** Attention order: what needs the user comes first, what is finished comes last. */
const stateRank: Readonly<Record<Session['state'], number>> = {
  needs_input: 0,
  working: 1,
  done_idle: 2,
  ended: 3,
};

/**
 * Stamps each snapshot with when its state began, carrying the stamp over while it holds, and
 * returns the list in the panel's attention order.
 *
 * `claude agents --json` reports `startedAt`, which is when the session was created and is
 * frozen for its lifetime. The row needs the other question — how long has it been *like this* —
 * because "blocked for 20 minutes" and "blocked for 3 seconds" are different situations and the
 * first is the one worth walking over to. So the widget times state changes itself: the only
 * derived value left in the pipeline, and derived from Claude Code's own state rather than in
 * place of it (ADR-0018).
 *
 * A session that is new, or whose state has changed, is stamped `nowMs`. Everything else keeps
 * the stamp it had, so the number counts up instead of resetting on every sweep. That was the
 * bug in the old scanner path, where each sweep re-stamped what it found and the age never got
 * past a few seconds (ADR-0008 hid it by showing no age at all for those rows).
 *
 * Pure, and given the previous list rather than holding state, so the store stays the only thing
 * with a memory.
 */
export const carryStateSince = (
  previous: readonly Session[],
  snapshots: readonly SessionSnapshot[],
  nowMs: number,
): readonly Session[] => {
  const before = new Map(previous.map((session) => [session.sessionId, session]));

  return snapshots
    .map((snapshot) => {
      const last = before.get(snapshot.sessionId);
      const held = last?.state === snapshot.state ? last.stateSince : nowMs;

      return { ...snapshot, stateSince: held };
    })
    .sort(
      (a, b) =>
        stateRank[a.state] - stateRank[b.state] ||
        b.stateSince - a.stateSince ||
        a.sessionId.localeCompare(b.sessionId),
    );
};
