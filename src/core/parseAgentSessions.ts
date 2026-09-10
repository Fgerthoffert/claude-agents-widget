import { mapAgentStatus } from './mapAgentStatus';
import type { SessionKind, SessionSnapshot } from './types';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const asPid = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;

const asEpochMs = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

const asKind = (value: unknown): SessionKind =>
  value === 'background' ? 'background' : 'interactive';

/**
 * Parses one entry. Returns `null` for anything without an identity, because a row the user
 * cannot be taken back to is worse than no row: `sessionId` is what names it and `id` is the
 * supervisor's handle for a background job, so one of the two must be there.
 */
const parseOne = (value: unknown): SessionSnapshot | null => {
  const entry = asRecord(value);
  if (entry === null) return null;

  const sessionId = asString(entry.sessionId) ?? asString(entry.id);
  if (sessionId === null) return null;

  const kind = asKind(entry.kind);

  return {
    sessionId,
    title: asString(entry.name),
    cwd: asString(entry.cwd),
    state: mapAgentStatus({ kind, status: asString(entry.status), state: asString(entry.state) }),
    kind,
    waitingFor: asString(entry.waitingFor),
    claudePid: asPid(entry.pid),
    startedAtMs: asEpochMs(entry.startedAt),
  };
};

/**
 * Turns the output of `claude agents --json` into the sessions the panel renders.
 *
 * This is the entire detection layer now (ADR-0018). What it replaced: a hook script installed
 * into the user's `~/.claude/settings.json`, a `ps` scan, an `lsof` call per sweep, a heuristic
 * pairing live PIDs with the newest transcript in a project directory, a JSONL parser for
 * session titles, and a state machine folding five hook events into four states. Every one of
 * those was an attempt to work out something Claude Code already knows and now says plainly.
 *
 * Untrusted all the same. The output is another program's, its shape is documented but not
 * frozen, and the fields differ by session kind — `state` and `id` are background-only, `status`
 * and `pid` exist only while the process is alive. So every field is validated, an entry without
 * an identity is dropped rather than rendered as a mystery row, and anything that is not an
 * array yields nothing at all. A malformed answer must look like "no sessions" to the caller,
 * which reports it as a detection failure, and never like a crash.
 */
export const parseAgentSessions = (json: string): readonly SessionSnapshot[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((entry) => {
    const session = parseOne(entry);
    return session === null ? [] : [session];
  });
};
