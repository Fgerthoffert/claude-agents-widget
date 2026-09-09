import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

/**
 * The native-side grants the detection pipeline needs, asserted against the files that grant
 * them.
 *
 * This exists for the same reason `src/ui/windowCapabilities.test.ts` does. v0.2.0 shipped with
 * `tauri-plugin-fs` built *without* its non-default `watch` feature, so the plugin never
 * registered the `watch` command: `watchImmediate()` rejected at runtime with a command-not-found
 * error, that rejection was awaited outside `startDetection`'s try, and the whole pipeline died
 * before its first sweep. Everything compiled, every jsdom test passed, and the panel reported
 * "No agents running right now" while nine sessions were live.
 *
 * A Cargo feature and a capability scope are both invisible to unit tests of the TypeScript that
 * depends on them, so they are checked here, at the level where the bug actually lived
 * (ADR-0011).
 */
const read = (relative: string): string => readFileSync(path.join(process.cwd(), relative), 'utf8');

const cargoToml = read('src-tauri/Cargo.toml');
const cargoLock = read('src-tauri/Cargo.lock');

interface AllowEntry {
  readonly path?: string;
  readonly name?: string;
  readonly cmd?: string;
  readonly args?: unknown;
}
interface ScopedPermission {
  readonly identifier: string;
  readonly allow?: readonly AllowEntry[];
}

const permissions = (
  JSON.parse(read('src-tauri/capabilities/default.json')) as {
    readonly permissions: readonly (string | ScopedPermission)[];
  }
).permissions;

const allowed = (identifier: string): readonly AllowEntry[] => {
  const found = permissions.find(
    (entry): entry is ScopedPermission =>
      typeof entry === 'object' && entry.identifier === identifier,
  );
  if (found === undefined) throw new Error(`no scoped permission for ${identifier}`);
  return found.allow ?? [];
};

const allowsPath = (identifier: string, wanted: string): boolean =>
  allowed(identifier).some((entry) => entry.path === wanted);

const command = (name: string): AllowEntry | undefined =>
  allowed('shell:allow-execute').find((entry) => entry.name === name);

describe('detection capabilities', () => {
  it('builds tauri-plugin-fs with the non-default `watch` feature', () => {
    // Without this the `watch` command does not exist and `watchImmediate()` rejects.
    expect(cargoToml).toMatch(/tauri-plugin-fs\s*=\s*\{[^}]*features\s*=\s*\[[^\]]*"watch"/);
  });

  it('actually resolves the watch backend, not just declares it', () => {
    // `notify` reaches the lock file only via the fs plugin's `watch` feature: the proof that
    // the feature is on is that its dependency is there.
    expect(cargoLock).toContain('name = "notify"');
  });

  it('grants a log target, so a failure survives having no devtools', () => {
    expect(cargoToml).toContain('tauri-plugin-log');
    expect(permissions).toContain('log:default');
  });

  it('scopes the watcher to the hook state directory', () => {
    expect(allowsPath('fs:allow-watch', '$HOME/.claude-agents-widget/sessions')).toBe(true);
    expect(allowsPath('fs:allow-watch', '$HOME/.claude-agents-widget/sessions/*')).toBe(true);
    expect(permissions).toContain('fs:allow-unwatch');
  });

  it('grants every path readHookRecords touches', () => {
    expect(allowsPath('fs:allow-exists', '$HOME/.claude-agents-widget/sessions')).toBe(true);
    expect(allowsPath('fs:allow-read-dir', '$HOME/.claude-agents-widget/sessions')).toBe(true);
    expect(allowsPath('fs:allow-read-text-file', '$HOME/.claude-agents-widget/sessions/*')).toBe(
      true,
    );
    expect(allowsPath('fs:allow-mkdir', '$HOME/.claude-agents-widget/sessions')).toBe(true);
  });

  it('grants every path the transcript scanner touches', () => {
    expect(allowsPath('fs:allow-exists', '$HOME/.claude/projects/*')).toBe(true);
    expect(allowsPath('fs:allow-read-dir', '$HOME/.claude/projects/*')).toBe(true);
    expect(allowsPath('fs:allow-stat', '$HOME/.claude/projects/*/*.jsonl')).toBe(true);
  });

  it('grants the transcript read that hook records ask for by absolute path', () => {
    // Hook payloads carry `/Users/<me>/.claude/projects/<enc>/<id>.jsonl`; readSessionTitles
    // rebases it onto BaseDirectory.Home, so this one glob has to cover both shapes.
    expect(allowsPath('fs:allow-read-text-file', '$HOME/.claude/projects/*/*.jsonl')).toBe(true);
  });

  it('allowlists `ps` with exactly the arguments the scanner passes', () => {
    expect(command('ps')?.cmd).toBe('/bin/ps');
    expect(command('ps')?.args).toEqual(['-axo', 'pid=,ppid=,command=']);
  });

  it('allowlists the `lsof` shape the scanner passes, with a pid-list validator', () => {
    expect(command('lsof-cwd')?.cmd).toBe('/usr/sbin/lsof');
    expect(command('lsof-cwd')?.args).toEqual([
      '-a',
      '-d',
      'cwd',
      '-Fn',
      '-p',
      { validator: '^[0-9,]+$' },
    ]);
  });
});
