import { describe, expect, it } from 'vitest';

import { identifyOwnerApp } from '../identifyOwnerApp';
import type { FocusTarget } from '../types';

import { buildGhosttyScript } from './buildGhosttyScript';

const GHOSTTY = identifyOwnerApp([
  { pid: 1, comm: '/Applications/Gho', args: '/Applications/Ghostty.app/Contents/MacOS/ghostty' },
]);

const target = (cwd: string | null): FocusTarget => ({ host: GHOSTTY, cwd, ttyDevice: null });

describe('buildGhosttyScript', () => {
  it('matches a surface on its working directory, since Ghostty exposes no tty', () => {
    const script = buildGhosttyScript(target('/Users/test/proj'));
    expect(script?.method).toBe('tab');
    expect(script?.source).toContain('set targetDir to "/Users/test/proj"');
    expect(script?.source).toContain('set wd to working directory of surf');
    expect(script?.source).toContain('focus surf');
  });

  it('tolerates the trailing slash Ghostty sometimes reports', () => {
    expect(buildGhosttyScript(target('/Users/test/proj'))?.source).toContain(
      'set matched to (wd is targetDir or wd is (targetDir & "/"))',
    );
  });

  it('escapes a cwd containing quotes and spaces', () => {
    expect(buildGhosttyScript(target('/Users/test/my "proj"'))?.source).toContain(
      'set targetDir to "/Users/test/my \\"proj\\""',
    );
  });

  it('cannot be built without a cwd', () => {
    expect(buildGhosttyScript(target(null))).toBeNull();
  });

  it('cannot be built for a host with no scriptable name', () => {
    expect(
      buildGhosttyScript({ host: { ...GHOSTTY, appName: null }, cwd: '/x', ttyDevice: null }),
    ).toBeNull();
  });
});
