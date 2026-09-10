import { isDesktopSession } from './isDesktopSession';
import { mapHookEventToState } from './mapHookEventToState';
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

const fromScan = (scanned: ScannedSession, title: string | null, nowMs: number): Session => ({
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

const isNewer = (candidate: SessionRecord, held: SessionRecord): boolean => {
  const delta = Date.parse(candidate.updatedAt) - Date.parse(held.updatedAt);
  // The session id breaks a tie, so the outcome never depends on the order the files were read.
  return delta !== 0 ? delta > 0 : candidate.sessionId > held.sessionId;
};

/**
 * The newest live record for each `claude` process.
 *
 * A CLI process runs one session at a time, so two live records naming the same PID mean the
 * older one has been superseded — `/clear` and `/resume` mint a new session id inside the same
 * process, and the session being replaced does not always get a `SessionEnd` on the way out.
 * Left alone, the abandoned record keeps its last state for as long as the process lives, and
 * the panel shows two rows for one terminal.
 */
const newestByPid = (records: readonly SessionRecord[]): ReadonlyMap<number, string> => {
  const newest = new Map<number, SessionRecord>();
  for (const record of records) {
    if (record.claudePid === null || record.state === 'ended') continue;
    const held = newest.get(record.claudePid);
    if (held === undefined || isNewer(record, held)) {
      newest.set(record.claudePid, record);
    }
  }
  return new Map([...newest].map(([pid, record]) => [pid, record.sessionId]));
};

/**
 * Folds the two detection sources into the single ordered session list the UI renders.
 *
 * Precedence (ADR-0003): a hook record's *event* always wins, because hooks are told what
 * happened while the scanner only infers it. The scanner therefore does exactly three things:
 * add sessions the hook path never saw, expire hook records whose `claude` process is gone,
 * and — by omission — let dead scanner-only sessions disappear.
 *
 * The event wins; the hook's *reading* of it does not. State is re-derived here from
 * `lastEvent` and `notificationType` through `mapHookEventToState`, so what an event means is
 * decided by the app rather than by the version of the hook script sitting in the user's home
 * directory. That directory is only rewritten when the installer runs, so before this every
 * classification fix shipped in an app update was invisible to anyone who did not think to
 * press *Install hooks* again — which is how two sessions sat in "Waiting for you" saying
 * `Claude is waiting for your input`, an idle nag that blocks nothing (ADR-0017).
 *
 * One row per process, both ways round (ADR-0012): a record superseded inside its own process is
 * treated as `ended`, and a scanned process whose PID a hook record already claims contributes
 * nothing — the scanner reaches a session id by guessing which transcript in the project
 * directory a PID is writing, and a wrong guess would otherwise appear beside the hook's row as
 * a second session that does not exist. Desktop-app sessions are dropped outright.
 *
 * Pure and stateless: the same inputs always produce the same list. One consequence is that a
 * scanner-only session leaves the store the moment its process exits, rather than lingering as
 * `done_idle`; once any hook event has fired for a session it is hook-owned and persists.
 */
export const reconcileSessions = (input: ReconcileInput): readonly Session[] => {
  const { hookRecords, scanned, livePids, titles, nowMs } = input;
  const live = livePids === null ? null : new Set(livePids);
  const scannedIds = new Set(scanned.map((session) => session.sessionId));
  const terminalRecords = hookRecords.filter((record) => !isDesktopSession(record.ancestors));
  const currentByPid = newestByPid(terminalRecords);

  const fromHooks = terminalRecords.flatMap((record) => {
    const title = titles.get(record.sessionId) ?? null;

    // A `claude` PID we know about but no longer see is a session that died without a
    // SessionEnd. Two cases deliberately do not expire anything: a hook that never identified
    // a claude PID, and a scan that failed outright (`livePids === null`) — a broken `ps` must
    // not empty the panel.
    const dead =
      live !== null &&
      record.claudePid !== null &&
      !live.has(record.claudePid) &&
      !scannedIds.has(record.sessionId);
    const superseded =
      record.claudePid !== null && currentByPid.get(record.claudePid) !== record.sessionId;
    // Re-derived from the event, not read from the file. The classification belongs to the app,
    // which ships with it, rather than to whatever hook script happens to be installed — see
    // ADR-0017. A record whose `lastEvent` is not one of the five we register keeps whatever
    // state it was written with.
    const reported = mapHookEventToState(record.lastEvent, record.notificationType) ?? record.state;
    const state: SessionState = dead || superseded ? 'ended' : reported;

    if (state === 'ended' && nowMs - Date.parse(record.updatedAt) > ENDED_TTL_MS) return [];
    return [fromRecord(record, state, title)];
  });

  const knownIds = new Set(fromHooks.map((session) => session.sessionId));
  const claimedPids = new Set(currentByPid.keys());
  const discovered = scanned
    .filter((session) => !knownIds.has(session.sessionId) && !claimedPids.has(session.claudePid))
    .map((session) => fromScan(session, titles.get(session.sessionId) ?? null, nowMs));

  return [...fromHooks, ...discovered].sort(
    (a, b) =>
      stateRank[a.state] - stateRank[b.state] ||
      Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
      a.sessionId.localeCompare(b.sessionId),
  );
};
