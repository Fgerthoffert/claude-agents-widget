import { describe, expect, it } from 'vitest';

import { parseProcessAncestors } from './parseProcessAncestors';

// A synthetic `ps -axo pid=,ppid=,command=` table shaped like the real VS Code chain.
const PS_OUTPUT = [
  '    1     0 /sbin/launchd',
  ' 1199     1 /Applications/Visual Studio Code.app/Contents/MacOS/Code',
  ' 1683  1199 /Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper.app/Contents/MacOS/Code Helper --type=utility --utility-sub-type=node.mojom.NodeService',
  '50410  1683 /bin/zsh -l',
  '50500 50410 claude --dangerously-skip-permissions',
  '50600 50500 /bin/zsh -c -l ps -axo pid=',
  '  999     1 /usr/libexec/unrelated',
].join('\n');

describe('parseProcessAncestors', () => {
  it('walks the chain nearest-first and stops before launchd', () => {
    expect(parseProcessAncestors(PS_OUTPUT, 50500).map((a) => a.pid)).toEqual([50410, 1683, 1199]);
  });

  it('carries the full command line as args and argv0 as the comm hint', () => {
    const [nearest] = parseProcessAncestors(PS_OUTPUT, 50500);
    expect(nearest).toEqual({ pid: 50410, comm: '/bin/zsh', args: '/bin/zsh -l' });
  });

  it('produces a chain identifyOwnerApp can recognise', () => {
    expect(parseProcessAncestors(PS_OUTPUT, 50500)[2]?.args).toContain('Visual Studio Code.app');
  });

  it('returns nothing for a pid that is not in the table', () => {
    expect(parseProcessAncestors(PS_OUTPUT, 42)).toEqual([]);
  });

  it('returns nothing for a process whose parent is launchd', () => {
    expect(parseProcessAncestors(PS_OUTPUT, 999)).toEqual([]);
  });

  it('stops when the chain leaves the table', () => {
    expect(parseProcessAncestors('  50 40 /bin/zsh', 50)).toEqual([]);
  });

  it('does not loop forever on a cyclic table', () => {
    const cyclic = ['10 20 /bin/a', '20 10 /bin/b'].join('\n');
    expect(parseProcessAncestors(cyclic, 10).map((a) => a.pid)).toEqual([20]);
  });

  it('tolerates a header row, blank lines and empty input', () => {
    expect(parseProcessAncestors('  PID  PPID COMMAND\n\n', 1)).toEqual([]);
    expect(parseProcessAncestors('', 1)).toEqual([]);
  });
});
