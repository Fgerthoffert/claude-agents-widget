import { describe, expect, it } from 'vitest';

import { encodeProjectDirName } from './encodeProjectDirName';

describe('encodeProjectDirName', () => {
  it('turns a path into the dash-separated form Claude Code uses', () => {
    expect(encodeProjectDirName('/Users/test/GitHub/proj')).toBe('-Users-test-GitHub-proj');
  });

  it('replaces every non-alphanumeric character, not just separators', () => {
    expect(encodeProjectDirName('/Users/test/my_proj.v2')).toBe('-Users-test-my-proj-v2');
    expect(encodeProjectDirName('/Users/test/My App (old)')).toBe('-Users-test-My-App--old-');
  });

  it('keeps digits and case', () => {
    expect(encodeProjectDirName('/Users/test/Proj2')).toBe('-Users-test-Proj2');
  });

  it('collides for paths that differ only in separators — hence encode-only', () => {
    expect(encodeProjectDirName('/a/b-c')).toBe(encodeProjectDirName('/a-b/c'));
  });

  it('truncates to 200 characters and appends a hash when the name would be longer', () => {
    const long = `/Users/test/${'segment/'.repeat(40)}end`;
    const encoded = encodeProjectDirName(long);

    expect(encoded.slice(0, 200)).toBe(long.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 200));
    expect(encoded).toMatch(/^.{200}-[0-9a-z]+$/);
  });

  it('gives different hashes to different long paths sharing a 200-char prefix', () => {
    const prefix = `/Users/test/${'segment/'.repeat(40)}`;
    expect(encodeProjectDirName(`${prefix}a`)).not.toBe(encodeProjectDirName(`${prefix}b`));
  });

  it('leaves a name of exactly 200 characters unhashed', () => {
    const exact = `/${'a'.repeat(199)}`;
    expect(encodeProjectDirName(exact)).toBe(`-${'a'.repeat(199)}`);
  });

  it('handles the empty path', () => {
    expect(encodeProjectDirName('')).toBe('');
  });
});
