import { Command } from '@tauri-apps/plugin-shell';

import { parseAgentSessions } from '../core/parseAgentSessions';
import type { SessionSnapshot } from '../core/types';

/** Must match the allowlist entry in `src-tauri/capabilities/default.json`. */
const COMMAND = 'claude-agents-json';

/**
 * Long enough for a cold supervisor start, short enough that a hung CLI cannot stall the 5s
 * sweep loop into a backlog.
 */
const TIMEOUT_MS = 10_000;

export interface AgentSessionsResult {
  readonly sessions: readonly SessionSnapshot[];
  /** Why the list is empty, when it is empty because something broke. `null` when it is true. */
  readonly failure: string | null;
}

const withTimeout = async <T>(work: Promise<T>, onTimeout: T): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => {
          resolve(onTimeout);
        }, TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Asks Claude Code what its sessions are doing.
 *
 * `claude agents --json` is documented for scripting and explicitly does not need a TTY. It
 * reports interactive and background sessions alike, with the working directory, the session's
 * own name, its pid and its status — which is everything the panel renders, from the authority
 * on the subject (ADR-0018).
 *
 * Run through a **login shell**, and that is the load-bearing detail. `claude` lives wherever the
 * user's package manager put it — `/opt/homebrew/bin` on this machine — and a GUI app launched
 * from Finder inherits a minimal `PATH` of `/usr/bin:/bin:/usr/sbin:/sbin`, which contains none
 * of the likely locations. `/bin/zsh -lc` resolves it the way the user's own terminal does, for
 * about 20ms more than calling the binary directly. The arguments are fixed in the capability
 * allowlist, so nothing is interpolated into that shell.
 *
 * An empty list is a real answer — no agents are running — so it must be distinguishable from a
 * broken one. Every failure path therefore returns a sentence the panel can show instead of
 * claiming all is quiet (ADR-0011): a missing CLI, a version too old for `--json`, a timeout, a
 * non-zero exit, or output that would not parse.
 */
export const readAgentSessions = async (): Promise<AgentSessionsResult> => {
  const outcome = await withTimeout(
    Command.create(COMMAND)
      .execute()
      .then(({ code, stdout, stderr }) => ({ code, stdout, stderr })),
    { code: null, stdout: '', stderr: 'timed out' },
  ).catch((error: unknown) => ({ code: -1, stdout: '', stderr: String(error) }));

  if (outcome.code !== 0) {
    const detail = outcome.stderr.trim() === '' ? 'no output' : outcome.stderr.trim().slice(0, 300);
    return {
      sessions: [],
      failure: `\`claude agents --json\` failed (${detail}). Claude Code 2.1 or newer must be installed and on your shell's PATH.`,
    };
  }

  if (outcome.stdout.trim() === '') {
    return { sessions: [], failure: '`claude agents --json` returned nothing.' };
  }

  const sessions = parseAgentSessions(outcome.stdout);
  // Output that parses to nothing when there *was* output is a shape we do not understand —
  // most likely a newer CLI — and saying so beats an empty panel that looks like calm.
  if (sessions.length === 0 && outcome.stdout.trim() !== '[]') {
    return {
      sessions: [],
      failure: 'Could not read the session list from `claude agents --json`.',
    };
  }

  return { sessions, failure: null };
};
