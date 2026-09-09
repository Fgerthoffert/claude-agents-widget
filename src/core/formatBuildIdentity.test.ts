import { describe, expect, it } from 'vitest';

import { formatBuildIdentity } from './formatBuildIdentity';
import type { BuildInfo } from './formatBuildIdentity';

const build = (overrides: Partial<BuildInfo> = {}): BuildInfo => ({
  commit: 'abc1234',
  tagged: false,
  dirty: false,
  ...overrides,
});

describe('formatBuildIdentity', () => {
  it('shows only the version on a tagged release', () => {
    expect(formatBuildIdentity('0.2.1', build({ tagged: true }))).toBe('v0.2.1');
  });

  it('adds the short commit on any other build, which could be any commit on main', () => {
    expect(formatBuildIdentity('0.2.1', build())).toBe('v0.2.1 (abc1234)');
  });

  it('marks a dirty tree, tagged or not', () => {
    expect(formatBuildIdentity('0.2.1', build({ dirty: true }))).toBe('v0.2.1 (abc1234-dirty)');
    expect(formatBuildIdentity('0.2.1', build({ tagged: true, dirty: true }))).toBe(
      'v0.2.1 (abc1234-dirty)',
    );
  });

  // A release tarball has no .git, and the build must not fail or lie about it.
  it('degrades to the version alone when git was unavailable', () => {
    expect(formatBuildIdentity('0.2.1', build({ commit: null }))).toBe('v0.2.1');
    expect(formatBuildIdentity('0.2.1', build({ commit: null, dirty: true }))).toBe(
      'v0.2.1 (dirty)',
    );
  });
});
