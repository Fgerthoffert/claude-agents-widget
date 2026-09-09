import { describe, expect, it } from 'vitest';

import { checkVersionConsistency } from './checkVersionConsistency';

const cargo = (version: string): string => `[package]
name = "claude-agents-widget"
version = "${version}"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
version = "9.9.9"
`;

const sources = (version: string, tag?: string | null) => ({
  packageJson: JSON.stringify({ name: 'x', version }),
  tauriConf: JSON.stringify({ productName: 'x', version }),
  cargoToml: cargo(version),
  ...(tag === undefined ? {} : { tag }),
});

describe('checkVersionConsistency', () => {
  it('accepts three agreeing files', () => {
    const result = checkVersionConsistency(sources('0.1.0'));

    expect(result.ok).toBe(true);
    expect(result.version).toBe('0.1.0');
    expect(result.problems).toEqual([]);
    expect(result.found.get('tag')).toBeUndefined();
  });

  it('reads the version from the [package] table, not from a dependency', () => {
    const result = checkVersionConsistency(sources('0.1.0'));

    expect(result.found.get('Cargo.toml')).toBe('0.1.0');
  });

  it('accepts a matching tag with or without the v prefix', () => {
    expect(checkVersionConsistency(sources('0.1.0', 'v0.1.0')).ok).toBe(true);
    expect(checkVersionConsistency(sources('0.1.0', '0.1.0')).ok).toBe(true);
  });

  it('fails loudly when the tag names a different version', () => {
    const result = checkVersionConsistency(sources('0.1.0', 'v0.2.0'));

    expect(result.ok).toBe(false);
    expect(result.version).toBeNull();
    expect(result.problems.join('\n')).toContain('versions disagree');
    expect(result.problems.join('\n')).toContain('tag=0.2.0');
  });

  it('reports every disagreeing file in one run', () => {
    const result = checkVersionConsistency({
      packageJson: JSON.stringify({ version: '0.1.0' }),
      tauriConf: JSON.stringify({ version: '0.1.1' }),
      cargoToml: cargo('0.2.0'),
    });

    expect(result.ok).toBe(false);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toBe(
      'versions disagree: package.json=0.1.0, tauri.conf.json=0.1.1, Cargo.toml=0.2.0',
    );
  });

  it('reports a missing version rather than guessing one', () => {
    const result = checkVersionConsistency({
      packageJson: JSON.stringify({ name: 'x' }),
      tauriConf: JSON.stringify({ version: '0.1.0' }),
      cargoToml: cargo('0.1.0'),
    });

    expect(result.ok).toBe(false);
    expect(result.problems).toContain('package.json: no version found');
  });

  it('refuses malformed JSON and a Cargo.toml with no package table', () => {
    const result = checkVersionConsistency({
      packageJson: '{ not json',
      tauriConf: '[]',
      cargoToml: '[dependencies]\nversion = "1.0.0"\n',
    });

    expect(result.ok).toBe(false);
    expect(result.problems).toEqual([
      'package.json: no version found',
      'tauri.conf.json: no version found',
      'Cargo.toml: no version found',
    ]);
  });

  it('rejects a version that is not semver', () => {
    const result = checkVersionConsistency(sources('0.1'));

    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain('is not a semver version');
  });

  it('accepts a semver pre-release suffix', () => {
    expect(checkVersionConsistency(sources('1.0.0-rc.1', 'v1.0.0-rc.1')).ok).toBe(true);
  });

  it('reports an empty tag as missing', () => {
    const result = checkVersionConsistency(sources('0.1.0', 'v'));

    expect(result.ok).toBe(false);
    expect(result.problems).toContain('tag: no version found');
  });
});
