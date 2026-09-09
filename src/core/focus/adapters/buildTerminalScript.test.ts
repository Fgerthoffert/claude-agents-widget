import { describe, expect, it } from 'vitest';

import { identifyOwnerApp } from '../identifyOwnerApp';
import type { FocusTarget } from '../types';

import { buildTerminalScript } from './buildTerminalScript';

const TERMINAL = identifyOwnerApp([
  {
    pid: 1,
    comm: '/System/Applications/',
    args: '/System/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal',
  },
]);

const target = (ttyDevice: string | null): FocusTarget => ({
  host: TERMINAL,
  cwd: '/Users/test/proj',
  ttyDevice,
});

describe('buildTerminalScript', () => {
  it('selects the tab whose tty matches, then raises its window', () => {
    const script = buildTerminalScript(target('/dev/ttys003'));
    expect(script?.method).toBe('tab');
    expect(script?.source).toContain('set targetTty to "/dev/ttys003"');
    expect(script?.source).toContain('set matched to (tty of tb is targetTty)');
    expect(script?.source).toContain('set selected of tb to true');
    expect(script?.source).toContain('set frontmost of win to true');
    expect(script?.source).toContain('activate');
  });

  it('guards only the tty read, so a real selection failure still surfaces', () => {
    const source = buildTerminalScript(target('/dev/ttys003'))?.source ?? '';
    expect(source).toContain('try\n        set matched to (tty of tb is targetTty)\n      end try');
    expect(source).not.toContain('try\n        set selected');
  });

  it('echoes a marker when nothing matched', () => {
    expect(buildTerminalScript(target('/dev/ttys003'))?.source.trimEnd()).toMatch(/return "none"$/);
  });

  it('escapes the tty value even though it comes from ps', () => {
    expect(buildTerminalScript(target('/dev/tty" & (do shell script "id") & "'))?.source).toContain(
      'set targetTty to "/dev/tty\\" & (do shell script \\"id\\") & \\""',
    );
  });

  it('cannot be built without a tty, so the plan degrades to activation', () => {
    expect(buildTerminalScript(target(null))).toBeNull();
  });

  it('cannot be built for a host with no scriptable name', () => {
    expect(
      buildTerminalScript({
        host: { ...TERMINAL, appName: null },
        cwd: null,
        ttyDevice: '/dev/ttys003',
      }),
    ).toBeNull();
  });
});
