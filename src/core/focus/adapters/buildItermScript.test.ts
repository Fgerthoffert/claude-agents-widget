import { describe, expect, it } from 'vitest';

import { identifyOwnerApp } from '../identifyOwnerApp';
import type { FocusTarget } from '../types';

import { buildItermScript } from './buildItermScript';

const ITERM = identifyOwnerApp([
  { pid: 1, comm: '/Applications/iTe', args: '/Applications/iTerm.app/Contents/MacOS/iTerm2' },
]);

const target = (ttyDevice: string | null): FocusTarget => ({
  host: ITERM,
  cwd: '/Users/test/proj',
  ttyDevice,
});

describe('buildItermScript', () => {
  it('walks windows, tabs and split panes and matches on tty', () => {
    const script = buildItermScript(target('/dev/ttys010'));
    expect(script?.method).toBe('tab');
    expect(script?.source).toContain('tell application "iTerm"');
    expect(script?.source).toContain('repeat with sess in sessions of tb');
    expect(script?.source).toContain('set matched to (tty of sess is targetTty)');
  });

  it('selects the pane inside-out so the exact split ends up focused', () => {
    const source = buildItermScript(target('/dev/ttys010'))?.source ?? '';
    expect(source.indexOf('select sess')).toBeLessThan(source.indexOf('select tb'));
    expect(source.indexOf('select tb')).toBeLessThan(source.indexOf('select win'));
    expect(source.indexOf('select win')).toBeLessThan(source.indexOf('activate'));
  });

  it('escapes the tty value', () => {
    expect(buildItermScript(target('/dev/tty"x'))?.source).toContain(
      'set targetTty to "/dev/tty\\"x"',
    );
  });

  it('cannot be built without a tty', () => {
    expect(buildItermScript(target(null))).toBeNull();
  });

  it('cannot be built for a host with no scriptable name', () => {
    expect(
      buildItermScript({ host: { ...ITERM, appName: null }, cwd: null, ttyDevice: '/dev/ttys1' }),
    ).toBeNull();
  });
});
