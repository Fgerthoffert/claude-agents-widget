import { describe, expect, it } from 'vitest';

import { buildReleaseNotes } from './buildReleaseNotes';

const notes = (subjects: readonly string[], overrides = {}): string =>
  buildReleaseNotes({
    version: '0.1.0',
    subjects,
    previousTag: null,
    repoUrl: 'https://github.com/o/r',
    ...overrides,
  });

describe('buildReleaseNotes', () => {
  it('groups commits by conventional-commit prefix in a fixed section order', () => {
    const body = notes([
      'chore: bump deps',
      'docs: explain the hook',
      'fix: stop the tray leaking menus',
      'feat: focus engine',
    ]);

    const order = ['### Features', '### Fixes', '### Documentation', '### Maintenance'].map(
      (heading) => body.indexOf(heading),
    );
    expect(order.every((index) => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('keeps the scope as emphasis and drops the prefix', () => {
    expect(notes(['feat(panel): two sections'])).toContain('- **panel**: two sections');
  });

  it('lifts breaking changes above every other section', () => {
    const body = notes(['feat: something', 'feat(api)!: rename the hook payload']);

    expect(body.indexOf('### Breaking changes')).toBeLessThan(body.indexOf('### Features'));
    expect(body).toContain('- **api**: rename the hook payload');
  });

  it('puts unprefixed and unknown-prefix commits under Other', () => {
    const body = notes(['Initial commit', 'wip: half a thought']);

    expect(body).toContain('### Other');
    expect(body).toContain('- Initial commit');
    expect(body).toContain('- wip: half a thought');
  });

  it('ignores blank subjects and says so when nothing is left', () => {
    const body = notes(['', '   ']);

    expect(body).toContain('_No commits found since the previous tag._');
  });

  it('links to the full history for a first release and a compare for later ones', () => {
    expect(notes(['feat: x'])).toContain('https://github.com/o/r/commits/v0.1.0');
    expect(notes(['feat: x'], { previousTag: 'v0.0.9' })).toContain(
      'https://github.com/o/r/compare/v0.0.9...v0.1.0',
    );
  });

  it('omits the link when no repository URL is given', () => {
    expect(notes(['feat: x'], { repoUrl: null })).not.toContain('Full');
  });

  it('spells out the Gatekeeper workaround for an unsigned build', () => {
    const body = notes(['feat: x'], { dmgName: 'App_0.1.0_aarch64.dmg' });

    expect(body).toContain('App_0.1.0_aarch64.dmg');
    expect(body).toContain('unsigned');
    expect(body).toContain('xattr -dr com.apple.quarantine');
  });

  it('says the build is signed instead when it is', () => {
    const body = notes(['feat: x'], { signed: true });

    expect(body).toContain('signed and notarized');
    expect(body).not.toContain('xattr');
  });

  it('always names the architecture and ends with a single newline', () => {
    const body = notes(['feat: x']);

    expect(body).toContain('aarch64');
    expect(body.endsWith('\n')).toBe(true);
    expect(body.endsWith('\n\n')).toBe(false);
  });
});
