import { describe, expect, it } from 'vitest';

import { parseSessionRecord } from './parseSessionRecord';

const valid = {
  sessionId: 'sess-1',
  cwd: '/Users/test/proj',
  transcriptPath: '/Users/test/.claude/projects/-Users-test-proj/sess-1.jsonl',
  state: 'working',
  lastEvent: 'SessionStart',
  notificationType: null,
  notificationMessage: null,
  endReason: null,
  agentId: null,
  agentType: null,
  updatedAt: '2026-09-09T12:00:00.000Z',
  hookPid: 4242,
  claudePid: 411,
  ancestors: [{ pid: 411, comm: 'claude', args: 'claude --resume' }],
};

describe('parseSessionRecord', () => {
  it('accepts a record the hook script wrote', () => {
    expect(parseSessionRecord(valid)).toEqual(valid);
  });

  it('accepts every state in the model', () => {
    for (const state of ['working', 'needs_input', 'done_idle', 'ended']) {
      expect(parseSessionRecord({ ...valid, state })?.state).toBe(state);
    }
  });

  it('rejects an unknown state rather than letting it reach the UI', () => {
    expect(parseSessionRecord({ ...valid, state: 'thinking' })).toBeNull();
    expect(parseSessionRecord({ ...valid, state: null })).toBeNull();
  });

  it('rejects a record without a usable session id', () => {
    expect(parseSessionRecord({ ...valid, sessionId: '' })).toBeNull();
    expect(parseSessionRecord({ ...valid, sessionId: 42 })).toBeNull();
    expect(parseSessionRecord({ ...valid, sessionId: undefined })).toBeNull();
  });

  it('rejects a missing or unparseable timestamp', () => {
    expect(parseSessionRecord({ ...valid, updatedAt: 'yesterday' })).toBeNull();
    expect(parseSessionRecord({ ...valid, updatedAt: undefined })).toBeNull();
  });

  it('rejects values that are not JSON objects', () => {
    expect(parseSessionRecord(null)).toBeNull();
    expect(parseSessionRecord(undefined)).toBeNull();
    expect(parseSessionRecord('sess-1')).toBeNull();
    expect(parseSessionRecord([valid])).toBeNull();
  });

  it('normalises optional fields to null instead of dropping them', () => {
    const record = parseSessionRecord({
      sessionId: 'sess-2',
      state: 'ended',
      updatedAt: '2026-09-09T12:00:00.000Z',
    });

    expect(record).toMatchObject({
      cwd: null,
      transcriptPath: null,
      lastEvent: null,
      notificationType: null,
      endReason: null,
      hookPid: null,
      claudePid: null,
      ancestors: [],
    });
  });

  it('keeps notification details for a session needing input', () => {
    const record = parseSessionRecord({
      ...valid,
      state: 'needs_input',
      notificationType: 'permission_prompt',
      notificationMessage: 'Claude needs your permission to use Bash',
    });

    expect(record).toMatchObject({
      notificationType: 'permission_prompt',
      notificationMessage: 'Claude needs your permission to use Bash',
    });
  });

  it('drops malformed ancestors but keeps the well-formed ones', () => {
    const record = parseSessionRecord({
      ...valid,
      ancestors: [
        { pid: 411, comm: 'claude', args: 'claude' },
        { pid: 0, comm: 'bogus', args: '' },
        { comm: 'no-pid', args: '' },
        'not an object',
        { pid: 310 },
      ],
    });

    expect(record?.ancestors).toEqual([
      { pid: 411, comm: 'claude', args: 'claude' },
      { pid: 310, comm: '', args: '' },
    ]);
  });

  it('ignores non-array ancestors and non-integer pids', () => {
    expect(parseSessionRecord({ ...valid, ancestors: 'nope' })?.ancestors).toEqual([]);
    expect(parseSessionRecord({ ...valid, claudePid: 1.5 })?.claudePid).toBeNull();
    expect(parseSessionRecord({ ...valid, hookPid: -1 })?.hookPid).toBeNull();
  });
});
