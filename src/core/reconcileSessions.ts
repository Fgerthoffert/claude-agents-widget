import type { ReconcileInput, Session, SessionRecord, ScannedSession, SessionState } from './types';

/** An `ended` session stays visible this long, so a finished agent does not vanish mid-glance. */
const ENDED_TTL_MS = 5 * 60 * 1000;

/** A transcript touched this recently means the agent is mid-turn rather than waiting. */
const ACTIVE_APPEND_MS = 10 * 1000;

/** Attention order: what needs the user comes first, what is finished comes last. */
const stateRank: Readonly<Record<SessionState, number>> = {
  needs_input: 0,
  working: 1,
  done_idle: 2,
  ended: 3,
};

const fromRecord = (record: SessionRecord, state: SessionState, title: string | null): Session => ({
  sessionId: record.sessionId,
  title,
  cwd: record.cwd,
  transcriptPath: record.transcriptPath,
  state,
  source: 'hook',
  notificationType: record.notificationType,
  notificationMessage: record.notificationMessage,
  updatedAt: record.updatedAt,
  claudePid: record.claudePid,
  ancestors: record.ancestors,
});

const fromScan = (
  scanned: ScannedSession,
  title: string | null,
  nowMs: number,
): Session => ({
  sessionId: scanned.sessionId,
  title,
  cwd: scanned.cwd,
  transcriptPath: scanned.transcriptPath,
  state:
    scanned.transcriptMtimeMs !== null && nowMs - scanned.transcriptMtimeMs <= ACTIVE_APPEND_MS
      ? 'working'
      : 'done_idle',
  source: 'scanner',
  notificationType: null,
  notificationMessage: null,
  updatedAt: new Date(nowMs).toISOString(),
  claudePid: scanned.claudePid,
  // The scanner cannot see a process's parent chain the way the hook can, so click-to-focus
  // degrades to app-level for scanner-only sessions until a hook event fills this in.
  ancestors: [],
});

/**
 * Folds the two detection sources into the single ordered session list the UI renders.
 *
 * Precedence (ADR-0003): a hook record's state always wins, because hooks are told what
 * happened while the scanner only infers it. The scanner therefore does exactly three things:
 * add sessions the hook path never saw, expire hook records whose `claude` process is gone,
 * and — by omission — let dead scanner-only sessions disappear.
 *
 * Pure and stateless: the same inputs always produce the same list. One consequence is that a
 * scanner-only session leaves the store the moment its process exits, rather than lingering as
 * `done_idle`; once any hook event has fired for a session it is hook-owned and persists.
 */
export const reconcileSessions = (input: ReconcileInput): readonly Session[] => {
  const { hookRecords, scanned, livePids, titles, nowMs } = input;
  const live = new Set(livePids);
  const scannedIds = new Set(scanned.map((session) => session.sessionId));

  const fromHooks = hookRecords.flatMap((record) => {
    const title = titles.get(record.sessionId) ?? null;

    // A `claude` PID we know about but no longer see is a session that died without a
    // SessionEnd. When the hook never identified one, trust the hook state instead of
    // guessing — an empty scan must not wipe the store.
    const dead =
      record.claudePid !== null && !live.has(record.claudePid) && !scannedIds.has(record.sessionId);
    const state: SessionState = dead ? 'ended' : record.state;

    if (state === 'ended' && nowMs - Date.parse(record.updatedAt) > ENDED_TTL_MS) return [];
    return [fromRecord(record, state, title)];
  });

  const knownIds = new Set(fromHooks.map((session) => session.sessionId));
  const discovered = scanned
    .filter((session) => !knownIds.has(session.sessionId))
    .map((session) => fromScan(session, titles.get(session.sessionId) ?? null, nowMs));

  return [...fromHooks, ...discovered].sort(
    (a, b) =>
      stateRank[a.state] - stateRank[b.state] ||
      Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
      a.sessionId.localeCompare(b.sessionId),
  );
};
