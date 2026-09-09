import type { Ancestor, SessionRecord, SessionState } from './types';

const states: readonly SessionState[] = ['working', 'needs_input', 'done_idle', 'ended'];

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const asPid = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;

const asState = (value: unknown): SessionState | null =>
  states.find((state) => state === value) ?? null;

const asAncestors = (value: unknown): readonly Ancestor[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        const record = asRecord(entry);
        const pid = record ? asPid(record.pid) : null;
        return record === null || pid === null
          ? []
          : [
              {
                pid,
                comm: asString(record.comm) ?? '',
                args: asString(record.args) ?? '',
              },
            ];
      })
    : [];

/**
 * Validates one parsed `sessions/<id>.json` file into a `SessionRecord`.
 *
 * Returns null for anything unusable — a half-written file, a foreign JSON blob, a record
 * whose state the app does not recognise — so the watcher can skip it and pick the session up
 * on the next hook event rather than poisoning the store.
 */
export const parseSessionRecord = (value: unknown): SessionRecord | null => {
  const record = asRecord(value);
  if (!record) return null;

  const sessionId = asString(record.sessionId);
  const state = asState(record.state);
  const updatedAt = asString(record.updatedAt);
  if (sessionId === null || sessionId === '' || state === null || updatedAt === null) return null;
  if (Number.isNaN(Date.parse(updatedAt))) return null;

  return {
    sessionId,
    cwd: asString(record.cwd),
    transcriptPath: asString(record.transcriptPath),
    state,
    lastEvent: asString(record.lastEvent),
    notificationType: asString(record.notificationType),
    notificationMessage: asString(record.notificationMessage),
    endReason: asString(record.endReason),
    agentId: asString(record.agentId),
    agentType: asString(record.agentType),
    updatedAt,
    hookPid: asPid(record.hookPid),
    claudePid: asPid(record.claudePid),
    ancestors: asAncestors(record.ancestors),
  };
};
