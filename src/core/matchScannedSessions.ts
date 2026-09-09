import { encodeProjectDirName } from './encodeProjectDirName';
import type { MatchScannedSessionsInput, ScannedSession } from './types';

/**
 * Pairs each running `claude` process with the transcript it is most likely writing.
 *
 * `ps` gives no session id, so the scanner reaches it the long way round: a process's cwd
 * encodes its `~/.claude/projects/<dir>` name, and the transcripts in that directory are named
 * by session id. When one directory holds several live processes — the user running two agents
 * in one repo — there is no way to tell which owns which transcript, so the newest transcript
 * goes to the lowest pid and so on down. That is a deliberate heuristic on the fallback path:
 * the moment any hook event fires, the hook record supersedes this guess entirely (ADR-0003).
 *
 * A process whose cwd or transcript cannot be resolved still yields a session, because a
 * running agent the user cannot see is the failure this widget exists to prevent.
 */
export const matchScannedSessions = (
  input: MatchScannedSessionsInput,
): readonly ScannedSession[] => {
  const { processes, cwdByPid, transcriptsByDir } = input;

  const byCwd = new Map<string | null, number[]>();
  for (const { pid } of [...processes].sort((a, b) => a.pid - b.pid)) {
    const cwd = cwdByPid.get(pid) ?? null;
    byCwd.set(cwd, [...(byCwd.get(cwd) ?? []), pid]);
  }

  return [...byCwd].flatMap(([cwd, pids]) => {
    const transcripts =
      cwd === null
        ? []
        : [...(transcriptsByDir.get(encodeProjectDirName(cwd)) ?? [])].sort(
            (a, b) => b.mtimeMs - a.mtimeMs || a.sessionId.localeCompare(b.sessionId),
          );

    return pids.map((pid, index) => {
      const transcript = transcripts[index];
      return {
        // Without a transcript there is no real session id, so key on the pid instead. Such a
        // session shows up as "unknown" rather than disappearing.
        sessionId: transcript?.sessionId ?? `pid-${String(pid)}`,
        cwd,
        transcriptPath: transcript?.path ?? null,
        claudePid: pid,
        transcriptMtimeMs: transcript?.mtimeMs ?? null,
      };
    });
  });
};
