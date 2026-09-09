/**
 * Reads process working directories out of `lsof -a -d cwd -Fn -p <pids>` output.
 *
 * `-F` is lsof's machine-readable mode: one field per line, prefixed by its identifier —
 * `p<pid>` opens a process block, `f<descriptor>` a file block, `n<name>` gives the path.
 * A pid keeps whatever cwd follows it, and processes lsof cannot inspect simply do not appear.
 *
 * The scanner needs this because `ps` cannot report another process's cwd, and the cwd is what
 * maps a `claude` process to its transcript directory.
 */
export const parseLsofCwds = (lsofOutput: string): ReadonlyMap<number, string> => {
  const cwds = new Map<number, string>();
  let pid: number | null = null;

  for (const line of lsofOutput.split('\n')) {
    if (line.startsWith('p')) {
      const parsed = Number(line.slice(1).trim());
      pid = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    } else if (line.startsWith('n') && pid !== null) {
      const path = line.slice(1).trim();
      // Only the first cwd per process block matters; `-d cwd` should yield exactly one.
      if (path !== '' && !cwds.has(pid)) cwds.set(pid, path);
    }
  }

  return cwds;
};
