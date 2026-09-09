import { describe, expect, it } from 'vitest';

import { isPrereleaseVersion } from './isPrereleaseVersion';

describe('isPrereleaseVersion', () => {
  it('treats every 0.x version as a pre-release', () => {
    expect(isPrereleaseVersion('0.1.0')).toBe(true);
    expect(isPrereleaseVersion('0.99.3')).toBe(true);
  });

  it('treats 1.0.0 and later as stable', () => {
    expect(isPrereleaseVersion('1.0.0')).toBe(false);
    expect(isPrereleaseVersion('12.4.7')).toBe(false);
  });

  it('treats a semver pre-release suffix as a pre-release', () => {
    expect(isPrereleaseVersion('1.0.0-rc.1')).toBe(true);
  });

  it('errs on the side of pre-release for an unparseable version', () => {
    expect(isPrereleaseVersion('nightly')).toBe(true);
  });
});
