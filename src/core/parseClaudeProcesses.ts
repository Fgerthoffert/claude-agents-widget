import type { ProcessEntry } from './types';

// Local rather than node:path — src/core is bundled for the webview and stays runtime-free.
const baseName = (path: string): string => path.split('/').pop() ?? '';

const isNodeRuntime = (path: string): boolean => /^node(?:js)?(?:\d[\d.]*)?$/.test(baseName(path));

/**
 * Case-sensitive on `claude`: `Claude` is the desktop app and `Claude Helper` its renderers,
 * neither of which is a CLI session. Homebrew and native installs surface as argv0 `claude`;
 * npm installs run the CLI through node, hence the second branch.
 */
const isClaudeCli = (command: string): boolean => {
  const tokens = command.split(/\s+/).filter((token) => token !== '');
  const argv0 = tokens[0] ?? '';
  if (baseName(argv0) === 'claude') return true;
  if (!isNodeRuntime(argv0)) return false;
  return tokens
    .slice(1)
    .some((token) => baseName(token) === 'claude' || token.endsWith('claude-code/cli.js'));
};

/**
 * Finds the running `claude` CLI processes in `ps -axo pid=,ppid=,command=` output.
 *
 * Rows are two numeric columns followed by a command line that may itself contain spaces, so
 * only the leading numbers are split off. A header row, if present, simply fails to match.
 */
export const parseClaudeProcesses = (psOutput: string): readonly ProcessEntry[] =>
  psOutput
    .split('\n')
    .map((line) => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line))
    .flatMap((match) =>
      match === null
        ? []
        : [{ pid: Number(match[1]), ppid: Number(match[2]), command: (match[3] ?? '').trim() }],
    )
    .filter((entry) => isClaudeCli(entry.command));
