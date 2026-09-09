import { BaseDirectory, exists, readDir, stat } from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';

import { encodeProjectDirName } from '../core/encodeProjectDirName';
import { matchScannedSessions } from '../core/matchScannedSessions';
import { parseClaudeProcesses } from '../core/parseClaudeProcesses';
import { parseLsofCwds } from '../core/parseLsofCwds';
import type { ProcessEntry, ScannedSession, TranscriptFile } from '../core/types';

const PROJECTS_DIR = '.claude/projects';

export interface ScanResult {
  readonly scanned: readonly ScannedSession[];
  /** PIDs seen alive, which the reconciler uses to expire dead hook records. */
  readonly livePids: readonly number[];
}

/** `ps` and `lsof` are allowlisted with fixed arguments in capabilities/default.json. */
const runPs = async (): Promise<string> => {
  const { stdout } = await Command.create('ps', ['-axo', 'pid=,ppid=,command=']).execute();
  return stdout;
};

const runLsof = async (pids: readonly number[]): Promise<string> => {
  if (pids.length === 0) return '';
  const list = pids.map((pid) => String(pid)).join(',');
  const { stdout } = await Command.create('lsof-cwd', [
    '-a',
    '-d',
    'cwd',
    '-Fn',
    '-p',
    list,
  ]).execute();
  return stdout;
};

/** Lists the transcripts in the project directories the live processes actually sit in. */
const readTranscripts = async (
  dirNames: readonly string[],
): Promise<ReadonlyMap<string, readonly TranscriptFile[]>> => {
  const pairs = await Promise.all(
    dirNames.map(async (dirName) => {
      const dir = `${PROJECTS_DIR}/${dirName}`;
      try {
        if (!(await exists(dir, { baseDir: BaseDirectory.Home }))) return null;

        const entries = await readDir(dir, { baseDir: BaseDirectory.Home });
        const files = await Promise.all(
          entries
            .filter((entry) => entry.isFile && entry.name.endsWith('.jsonl'))
            .map(async (entry) => {
              const info = await stat(`${dir}/${entry.name}`, { baseDir: BaseDirectory.Home });
              return {
                sessionId: entry.name.replace(/\.jsonl$/, ''),
                path: `${dir}/${entry.name}`,
                mtimeMs: info.mtime?.getTime() ?? 0,
              };
            }),
        );
        return [dirName, files] as const;
      } catch {
        // A fresh machine has no projects dir at all; that is not an error.
        return null;
      }
    }),
  );

  return new Map(
    pairs.filter((pair): pair is readonly [string, TranscriptFile[]] => pair !== null),
  );
};

/**
 * One scanner pass: which `claude` processes are running, and which session each is working on.
 *
 * This is the zero-config half of the hybrid strategy (ADR-0003) — it finds sessions started
 * before the hook was installed and, via `livePids`, notices sessions that died without firing
 * `SessionEnd`. All the judgement lives in the pure functions it calls; this function only
 * shells out and reads directories.
 *
 * A failed `ps` yields an empty result, which the reconciler treats as "no new information"
 * rather than "everything died".
 */
export const scanClaudeSessions = async (): Promise<ScanResult> => {
  const processes: readonly ProcessEntry[] | null = await runPs().then(
    parseClaudeProcesses,
    () => null,
  );
  if (processes === null) return { scanned: [], livePids: [] };

  const livePids = processes.map((entry) => entry.pid);
  if (livePids.length === 0) return { scanned: [], livePids: [] };

  // Without cwds the pass still reports liveness, just no newly discovered sessions.
  const cwdByPid: ReadonlyMap<number, string> = await runLsof(livePids).then(
    parseLsofCwds,
    () => new Map<number, string>(),
  );

  const dirNames = [...new Set([...cwdByPid.values()].map(encodeProjectDirName))];
  const transcriptsByDir = await readTranscripts(dirNames);

  return { scanned: matchScannedSessions({ processes, cwdByPid, transcriptsByDir }), livePids };
};
