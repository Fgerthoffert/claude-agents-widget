import { describe, expect, it } from 'vitest';

import { isDesktopSession } from './isDesktopSession';
import type { Ancestor } from './types';

const ancestor = (comm: string, args = comm): Ancestor => ({ pid: 1, comm, args });

describe('isDesktopSession', () => {
  it('recognises the CLI copy bundled in the desktop app support directory', () => {
    expect(
      isDesktopSession([
        ancestor(
          '/Users/test/Library/Application Support/Claude/claude-code/2.1.260/claude.app/Contents/MacOS/claude',
        ),
      ]),
    ).toBe(true);
  });

  it('recognises the desktop app further up the chain', () => {
    expect(
      isDesktopSession([
        ancestor('claude'),
        ancestor(
          '/Applications/Claude.app/Contents/Frameworks/Claude Helper.app/Contents/MacOS/Claude Helper',
        ),
        ancestor('/sbin/launchd'),
      ]),
    ).toBe(true);
  });

  it('reads args as well as comm, since either column can be the fuller one', () => {
    expect(
      isDesktopSession([
        { pid: 9, comm: 'Claude Helper', args: '/Applications/Claude.app/Contents/MacOS/Claude' },
      ]),
    ).toBe(true);
  });

  it('leaves a terminal session alone', () => {
    expect(
      isDesktopSession([
        ancestor('claude', 'claude --dangerously-skip-permissions'),
        ancestor('/bin/zsh', '-/bin/zsh'),
        ancestor('/Applications/Ghostty.app/Contents/MacOS/ghostty'),
        ancestor('/sbin/launchd'),
      ]),
    ).toBe(false);
  });

  it('leaves a VS Code session alone', () => {
    expect(
      isDesktopSession([
        ancestor('claude', 'claude'),
        ancestor('/bin/zsh', '-/bin/zsh'),
        ancestor('/Applications/Visual Studio Code.app/Contents/MacOS/Code'),
      ]),
    ).toBe(false);
  });

  it('is not fooled by a directory that merely mentions Claude', () => {
    expect(
      isDesktopSession([
        ancestor('claude', 'claude'),
        ancestor('/bin/zsh', '-/bin/zsh --cd /Users/test/GitHub/Claude'),
      ]),
    ).toBe(false);
  });

  it('has nothing to go on when the chain is empty', () => {
    expect(isDesktopSession([])).toBe(false);
  });
});
