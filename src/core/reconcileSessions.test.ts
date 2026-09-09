import { describe, expect, it } from 'vitest';

import { reconcileSessions } from './reconcileSessions';
import type { ReconcileInput, ScannedSession, SessionRecord } from './types';

const NOW = Date.parse('2026-09-09T12:00:00.000Z');
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const record = (overrides: Partial<SessionRecord> = {}): SessionRecord => ({
  sessionId: 'sess-1',
  cwd: '/Users/test/proj',
  transcriptPath: '/Users/test/.claude/projects/-Users-test-proj/sess-1.jsonl',
  state: 'working',
  lastEvent: 'UserPromptSubmit',
  notificationType: null,
  notificationMessage: null,
  endReason: null,
  agentId: null,
  agentType: null,
  updatedAt: at(-1000),
  hookPid: 5000,
  claudePid: 411,
  ancestors: [{ pid: 411, comm: 'claude', args: 'claude' }],
  ...overrides,
});

const scan = (overrides: Partial<ScannedSession> = {}): ScannedSession => ({
  sessionId: 'sess-9',
  cwd: '/Users/test/other',
  transcriptPath: '/Users/test/.claude/projects/-Users-test-other/sess-9.jsonl',
  claudePid: 812,
  transcriptMtimeMs: NOW - 1000,
  ...overrides,
});

const run = (overrides: Partial<ReconcileInput> = {}) =>
  reconcileSessions({
    hookRecords: [],
    scanned: [],
    livePids: [],
    titles: new Map(),
    nowMs: NOW,
    ...overrides,
  });

describe('reconcileSessions', () => {
  it('returns nothing when neither source saw anything', () => {
    expect(run()).toEqual([]);
  });

  it('surfaces a hook record with its state, source and ancestors intact', () => {
    const [session] = run({ hookRecords: [record()], livePids: [411] });

    expect(session).toMatchObject({
      sessionId: 'sess-1',
      state: 'working',
      source: 'hook',
      cwd: '/Users/test/proj',
      claudePid: 411,
      ancestors: [{ pid: 411, comm: 'claude', args: 'claude' }],
    });
  });

  it('attaches the title the caller extracted', () => {
    const titles = new Map([['sess-1', 'Detection core']]);
    expect(run({ hookRecords: [record()], livePids: [411], titles })[0]?.title).toBe(
      'Detection core',
    );
    expect(run({ hookRecords: [record()], livePids: [411] })[0]?.title).toBeNull();
  });

  it('lets the hook state win over what the scanner would infer', () => {
    // The claude process is alive and the transcript is fresh, but the hook said needs_input.
    const sessions = run({
      hookRecords: [record({ state: 'needs_input', notificationType: 'permission_prompt' })],
      scanned: [scan({ sessionId: 'sess-1' })],
      livePids: [411, 812],
    });

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ state: 'needs_input', source: 'hook' });
  });

  it('adds sessions the hook path never saw', () => {
    const sessions = run({ scanned: [scan()], livePids: [812] });

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      sessionId: 'sess-9',
      source: 'scanner',
      claudePid: 812,
      ancestors: [],
      notificationType: null,
    });
  });

  it('infers working from a transcript appended within the last 10s', () => {
    expect(run({ scanned: [scan({ transcriptMtimeMs: NOW - 9_999 })] })[0]?.state).toBe('working');
    expect(run({ scanned: [scan({ transcriptMtimeMs: NOW - 10_001 })] })[0]?.state).toBe(
      'done_idle',
    );
    expect(run({ scanned: [scan({ transcriptMtimeMs: null })] })[0]?.state).toBe('done_idle');
  });

  it('expires a hook record whose claude process died without a SessionEnd', () => {
    const sessions = run({ hookRecords: [record({ state: 'working' })], livePids: [999] });
    expect(sessions[0]).toMatchObject({ sessionId: 'sess-1', state: 'ended' });
  });

  it('does not expire a record whose process the scan still sees', () => {
    expect(run({ hookRecords: [record()], livePids: [411] })[0]?.state).toBe('working');
  });

  it('keeps a record whose claude pid was never identified, rather than guessing', () => {
    // An empty or failed scan must never wipe the store.
    const sessions = run({ hookRecords: [record({ claudePid: null })], livePids: [] });
    expect(sessions[0]?.state).toBe('working');
  });

  it('drops an ended session once its 5 minute grace period is up', () => {
    const fresh = record({ sessionId: 'a', state: 'ended', updatedAt: at(-4 * 60 * 1000) });
    const stale = record({ sessionId: 'b', state: 'ended', updatedAt: at(-6 * 60 * 1000) });

    expect(run({ hookRecords: [fresh, stale], livePids: [411] }).map((s) => s.sessionId)).toEqual([
      'a',
    ]);
  });

  it('keeps done_idle sessions indefinitely', () => {
    const old = record({ state: 'done_idle', updatedAt: at(-24 * 60 * 60 * 1000) });
    expect(run({ hookRecords: [old], livePids: [411] })).toHaveLength(1);
  });

  it('expires a just-died session only after its grace period, not immediately', () => {
    // Liveness flips the state to ended and the record's own updatedAt starts the clock.
    const old = record({ state: 'working', updatedAt: at(-6 * 60 * 1000) });
    expect(run({ hookRecords: [old], livePids: [] })).toEqual([]);
  });

  it('orders needs_input first, then working, then done_idle, then ended', () => {
    const sessions = run({
      hookRecords: [
        record({ sessionId: 'idle', state: 'done_idle', claudePid: null }),
        record({ sessionId: 'gone', state: 'ended', claudePid: null }),
        record({ sessionId: 'busy', state: 'working', claudePid: null }),
        record({ sessionId: 'blocked', state: 'needs_input', claudePid: null }),
      ],
    });

    expect(sessions.map((session) => session.sessionId)).toEqual([
      'blocked',
      'busy',
      'idle',
      'gone',
    ]);
  });

  it('orders sessions in the same state most-recent first', () => {
    const sessions = run({
      hookRecords: [
        record({ sessionId: 'older', updatedAt: at(-60_000), claudePid: null }),
        record({ sessionId: 'newer', updatedAt: at(-1_000), claudePid: null }),
      ],
    });

    expect(sessions.map((session) => session.sessionId)).toEqual(['newer', 'older']);
  });

  it('breaks ties on session id so the order never flickers', () => {
    const sessions = run({
      hookRecords: [
        record({ sessionId: 'b', claudePid: null }),
        record({ sessionId: 'a', claudePid: null }),
      ],
    });

    expect(sessions.map((session) => session.sessionId)).toEqual(['a', 'b']);
  });

  it('keeps two sessions in the same cwd distinct', () => {
    const sessions = run({
      hookRecords: [
        record({ sessionId: 'first', claudePid: 411 }),
        record({ sessionId: 'second', state: 'needs_input', claudePid: 412 }),
      ],
      livePids: [411, 412],
    });

    expect(sessions.map((session) => session.sessionId)).toEqual(['second', 'first']);
    expect(sessions.every((session) => session.cwd === '/Users/test/proj')).toBe(true);
  });

  it('reconciles a realistic mixed snapshot', () => {
    const sessions = run({
      hookRecords: [
        record({ sessionId: 'blocked', state: 'needs_input', claudePid: 411 }),
        record({ sessionId: 'dead', state: 'working', claudePid: 700 }),
      ],
      scanned: [scan({ sessionId: 'undiscovered', claudePid: 812 })],
      livePids: [411, 812],
      titles: new Map([['blocked', 'Needs a permission']]),
    });

    expect(sessions.map((session) => [session.sessionId, session.state, session.source])).toEqual([
      ['blocked', 'needs_input', 'hook'],
      ['undiscovered', 'working', 'scanner'],
      ['dead', 'ended', 'hook'],
    ]);
  });
});
