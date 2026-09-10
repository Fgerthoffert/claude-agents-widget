import { describe, expect, it } from 'vitest';

import { parseClaudeVersion } from './parseClaudeVersion';

describe('parseClaudeVersion', () => {
  it('reads the version the real command prints', () => {
    expect(parseClaudeVersion('2.1.236 (Claude Code)')).toBe('2.1.236');
  });

  it('tolerates the whitespace a shell may add', () => {
    expect(parseClaudeVersion('  2.1.236 (Claude Code)\n')).toBe('2.1.236');
  });

  it('keeps a pre-release suffix, which is still worth showing', () => {
    expect(parseClaudeVersion('2.2.0-beta.1 (Claude Code)')).toBe('2.2.0-beta.1');
  });

  it('accepts a leading v, and a two-part version', () => {
    expect(parseClaudeVersion('v3.0 (Claude Code)')).toBe('3.0');
  });

  it('does not care what the product calls itself', () => {
    // The version is ours to read; the name in brackets is not ours to depend on.
    expect(parseClaudeVersion('2.1.236 (Something Else)')).toBe('2.1.236');
  });

  it('says nothing rather than guessing at output it does not recognise', () => {
    expect(parseClaudeVersion('command not found: claude')).toBeNull();
    expect(parseClaudeVersion('')).toBeNull();
    expect(parseClaudeVersion('Claude Code 2.1.236')).toBeNull();
  });
});
