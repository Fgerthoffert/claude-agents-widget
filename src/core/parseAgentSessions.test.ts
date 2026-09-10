import { describe, expect, it } from 'vitest';

import { parseAgentSessions } from './parseAgentSessions';

/** Verbatim from `claude agents --json` on 2.1.236, with the paths made synthetic. */
const REAL_OUTPUT = JSON.stringify([
  {
    pid: 13982,
    cwd: '/Users/test/GitHub/widget',
    kind: 'interactive',
    startedAt: 1789020450002,
    sessionId: '0e680a5e-6a35-49f3-b883-67e8b5599f73',
    name: 'fix-widget-topbar-filtering',
    status: 'busy',
  },
  {
    pid: 82515,
    cwd: '/Users/test/GitHub/cortex-nick/cortex',
    kind: 'interactive',
    startedAt: 1789027073906,
    sessionId: '2058dc5a-a290-4ee1-aa88-15e57c43c96a',
    name: 'upgrade-httpclient5',
    status: 'idle',
  },
]);

describe('parseAgentSessions', () => {
  it('reads the real shape of the CLI’s output', () => {
    const sessions = parseAgentSessions(REAL_OUTPUT);

    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toEqual({
      sessionId: '0e680a5e-6a35-49f3-b883-67e8b5599f73',
      title: 'fix-widget-topbar-filtering',
      cwd: '/Users/test/GitHub/widget',
      state: 'working',
      kind: 'interactive',
      waitingFor: null,
      claudePid: 13982,
      startedAtMs: 1789020450002,
    });
    expect(sessions[1]?.state).toBe('done_idle');
  });

  it('takes the session name as the title, with no transcript to parse', () => {
    // This used to mean reading the JSONL and hunting for `custom-title` / `ai-title` records.
    expect(parseAgentSessions(REAL_OUTPUT)[0]?.title).toBe('fix-widget-topbar-filtering');
  });

  it('carries the reason a session is blocked, in the CLI’s own words', () => {
    const json = JSON.stringify([
      { id: '7c5dcf5d', kind: 'background', status: 'waiting', waitingFor: 'permission prompt' },
    ]);

    expect(parseAgentSessions(json)[0]).toMatchObject({
      state: 'needs_input',
      waitingFor: 'permission prompt',
    });
  });

  it('identifies a background job by its short id when it has no uuid yet', () => {
    const json = JSON.stringify([{ id: '7c5dcf5d', kind: 'background', state: 'done' }]);

    expect(parseAgentSessions(json)[0]?.sessionId).toBe('7c5dcf5d');
  });

  it('prefers the uuid over the short id, because that is what identifies a session', () => {
    const json = JSON.stringify([{ id: 'short', sessionId: 'the-uuid', kind: 'background' }]);

    expect(parseAgentSessions(json)[0]?.sessionId).toBe('the-uuid');
  });

  it('drops an entry with no identity rather than rendering a mystery row', () => {
    const json = JSON.stringify([{ cwd: '/Users/test/proj', status: 'busy' }, { id: 'ok' }]);

    expect(parseAgentSessions(json).map((s) => s.sessionId)).toEqual(['ok']);
  });

  it('defaults an unstated kind to interactive', () => {
    expect(parseAgentSessions(JSON.stringify([{ id: 'a' }]))[0]?.kind).toBe('interactive');
  });

  it('treats a missing pid, cwd, name or startedAt as unknown rather than as zero', () => {
    const session = parseAgentSessions(JSON.stringify([{ id: 'a' }]))[0];

    expect(session).toMatchObject({
      title: null,
      cwd: null,
      claudePid: null,
      startedAtMs: null,
      waitingFor: null,
    });
  });

  it('rejects nonsense in the numeric fields', () => {
    const json = JSON.stringify([{ id: 'a', pid: 0, startedAt: -1 }]);

    expect(parseAgentSessions(json)[0]).toMatchObject({ claudePid: null, startedAtMs: null });
  });

  it('yields nothing for output that is not an array of objects', () => {
    // Another program's output, documented but not frozen: a shape we do not understand must
    // look like "no sessions" to the caller, which reports it, and never like a crash.
    expect(parseAgentSessions('not json')).toEqual([]);
    expect(parseAgentSessions('{}')).toEqual([]);
    expect(parseAgentSessions('null')).toEqual([]);
    expect(parseAgentSessions('[1, "two", null]')).toEqual([]);
    expect(parseAgentSessions('')).toEqual([]);
  });

  it('reads an empty array as an empty machine', () => {
    expect(parseAgentSessions('[]')).toEqual([]);
  });
});
