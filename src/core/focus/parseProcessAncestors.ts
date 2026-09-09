import type { Ancestor } from '../types';

/** Guards against a cycle in a corrupt table, and against launchd-rooted chains being long. */
const MAX_DEPTH = 32;

/**
 * Walks the parent chain of `pid` out of `ps -axo pid=,ppid=,command=` output, nearest first.
 *
 * This is the recovery path for `source: 'scanner'` sessions, whose records carry no ancestors
 * because no hook ever ran in them (ADR-0006). Reconstructing the chain live from the same `ps`
 * call the scanner already makes is what lets those sessions be focused at all.
 *
 * The row shape is deliberately the same as `parseClaudeProcesses`, but that function filters to
 * `claude` rows only, so it cannot supply the intermediate links a walk needs.
 */
export const parseProcessAncestors = (psOutput: string, pid: number): readonly Ancestor[] => {
  const rows = new Map<number, { readonly ppid: number; readonly command: string }>();
  for (const line of psOutput.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
    if (match !== null) {
      rows.set(Number(match[1]), { ppid: Number(match[2]), command: (match[3] ?? '').trim() });
    }
  }

  const ancestors: Ancestor[] = [];
  const seen = new Set<number>([pid]);
  let current = rows.get(pid)?.ppid;

  while (
    current !== undefined &&
    current > 1 &&
    !seen.has(current) &&
    ancestors.length < MAX_DEPTH
  ) {
    const row = rows.get(current);
    if (row === undefined) break;
    // `comm` mirrors the hook's meaning: argv0 only, a hint next to the authoritative `args`.
    ancestors.push({ pid: current, comm: row.command.split(/\s+/)[0] ?? '', args: row.command });
    seen.add(current);
    current = row.ppid;
  }

  return ancestors;
};
