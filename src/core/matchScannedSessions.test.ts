import { describe, expect, it } from 'vitest';

import { matchScannedSessions } from './matchScannedSessions';
import type { ProcessEntry, TranscriptFile } from './types';

const process = (pid: number): ProcessEntry => ({ pid, ppid: 310, command: 'claude' });

const transcript = (sessionId: string, mtimeMs: number): TranscriptFile => ({
  sessionId,
  path: `/Users/test/.claude/projects/-Users-test-proj/${sessionId}.jsonl`,
  mtimeMs,
});

describe('matchScannedSessions', () => {
  it('pairs a process with the transcript in its encoded project directory', () => {
    const sessions = matchScannedSessions({
      processes: [process(411)],
      cwdByPid: new Map([[411, '/Users/test/proj']]),
      transcriptsByDir: new Map([['-Users-test-proj', [transcript('sess-1', 1000)]]]),
    });

    expect(sessions).toEqual([
      {
        sessionId: 'sess-1',
        cwd: '/Users/test/proj',
        transcriptPath: '/Users/test/.claude/projects/-Users-test-proj/sess-1.jsonl',
        claudePid: 411,
        transcriptMtimeMs: 1000,
      },
    ]);
  });

  it('gives the newest transcript to the lowest pid when a directory has several sessions', () => {
    const sessions = matchScannedSessions({
      processes: [process(412), process(411)],
      cwdByPid: new Map([
        [411, '/Users/test/proj'],
        [412, '/Users/test/proj'],
      ]),
      transcriptsByDir: new Map([
        ['-Users-test-proj', [transcript('older', 1000), transcript('newer', 2000)]],
      ]),
    });

    expect(sessions.map((session) => [session.claudePid, session.sessionId])).toEqual([
      [411, 'newer'],
      [412, 'older'],
    ]);
  });

  it('never assigns one transcript to two processes', () => {
    const sessions = matchScannedSessions({
      processes: [process(411), process(412)],
      cwdByPid: new Map([
        [411, '/Users/test/proj'],
        [412, '/Users/test/proj'],
      ]),
      transcriptsByDir: new Map([['-Users-test-proj', [transcript('only', 1000)]]]),
    });

    expect(sessions.map((session) => session.sessionId)).toEqual(['only', 'pid-412']);
    expect(new Set(sessions.map((session) => session.sessionId)).size).toBe(2);
  });

  it('still reports a live process whose transcript directory is empty', () => {
    const sessions = matchScannedSessions({
      processes: [process(411)],
      cwdByPid: new Map([[411, '/Users/test/fresh']]),
      transcriptsByDir: new Map(),
    });

    expect(sessions).toEqual([
      {
        sessionId: 'pid-411',
        cwd: '/Users/test/fresh',
        transcriptPath: null,
        claudePid: 411,
        transcriptMtimeMs: null,
      },
    ]);
  });

  it('still reports a process whose cwd lsof could not read', () => {
    const sessions = matchScannedSessions({
      processes: [process(411)],
      cwdByPid: new Map(),
      transcriptsByDir: new Map([['-Users-test-proj', [transcript('sess-1', 1000)]]]),
    });

    expect(sessions).toEqual([
      {
        sessionId: 'pid-411',
        cwd: null,
        transcriptPath: null,
        claudePid: 411,
        transcriptMtimeMs: null,
      },
    ]);
  });

  it('keeps sessions in different directories separate', () => {
    const sessions = matchScannedSessions({
      processes: [process(411), process(412)],
      cwdByPid: new Map([
        [411, '/Users/test/a'],
        [412, '/Users/test/b'],
      ]),
      transcriptsByDir: new Map([
        ['-Users-test-a', [transcript('in-a', 1000)]],
        ['-Users-test-b', [transcript('in-b', 1000)]],
      ]),
    });

    expect(sessions.map((session) => session.sessionId)).toEqual(['in-a', 'in-b']);
  });

  it('breaks mtime ties on session id so the pairing never flickers', () => {
    const input = {
      processes: [process(411), process(412)],
      cwdByPid: new Map([
        [411, '/Users/test/proj'],
        [412, '/Users/test/proj'],
      ]),
      transcriptsByDir: new Map([
        ['-Users-test-proj', [transcript('b', 1000), transcript('a', 1000)]],
      ]),
    };

    expect(matchScannedSessions(input).map((session) => session.sessionId)).toEqual(['a', 'b']);
    expect(matchScannedSessions(input)).toEqual(matchScannedSessions(input));
  });

  it('returns nothing when no claude process is running', () => {
    expect(
      matchScannedSessions({
        processes: [],
        cwdByPid: new Map(),
        transcriptsByDir: new Map(),
      }),
    ).toEqual([]);
  });
});
