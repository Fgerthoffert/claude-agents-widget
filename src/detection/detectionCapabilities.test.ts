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
 * registered the command it needed, the whole pipeline died before its first sweep, and the panel
 * reported "No agents running right now" while nine sessions were live. Everything compiled and
 * every jsdom test passed.
 *
 * A capability scope is invisible to unit tests of the TypeScript that depends on it, so it is
 * checked here, at the level where that bug actually lived (ADR-0011). The pipeline now needs one
 * command rather than a filesystem watcher and two process tools (ADR-0018), so there is much
 * less to get wrong — but the one command is load-bearing for the entire app.
 */
const read = (relative: string): string => readFileSync(path.join(process.cwd(), relative), 'utf8');

const cargoToml = read('src-tauri/Cargo.toml');

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
  it('grants a log target, so a failure survives having no devtools', () => {
    expect(cargoToml).toContain('tauri-plugin-log');
    expect(permissions).toContain('log:default');
  });

  it('allowlists the one command the whole pipeline depends on', () => {
    // `claude` lives wherever the user's package manager put it, and a GUI app launched from
    // Finder inherits a PATH of /usr/bin:/bin:/usr/sbin:/sbin — which contains none of the
    // likely locations. A login shell resolves it the way the user's own terminal does.
    expect(command('claude-agents-json')?.cmd).toBe('/bin/zsh');
    expect(command('claude-agents-json')?.args).toEqual(['-lc', 'claude agents --json']);
  });

  it('fixes those arguments, so nothing is interpolated into a shell', () => {
    // The whole risk of shelling out through `zsh -lc` is an argument that is not a constant.
    for (const name of ['claude-agents-json', 'claude-version']) {
      const args = command(name)?.args;

      expect(Array.isArray(args)).toBe(true);
      expect((args as readonly unknown[]).every((arg) => typeof arg === 'string')).toBe(true);
    }
  });

  it('allowlists the version lookup the footer shows', () => {
    // The footer names both versions, because the widget is a view over a CLI as much as an app
    // and "which widget, which Claude" is the first question about odd behaviour (ADR-0018).
    expect(command('claude-version')?.cmd).toBe('/bin/zsh');
    expect(command('claude-version')?.args).toEqual(['-lc', 'claude --version']);
  });

  it('allowlists `ps` with exactly the arguments the focus engine passes', () => {
    // Still needed, but only at click time: the pid comes from Claude Code, and `ps` is how the
    // chain from that pid to a window is walked (ADR-0018).
    expect(command('ps')?.cmd).toBe('/bin/ps');
    expect(command('ps')?.args).toEqual(['-axo', 'pid=,ppid=,command=']);
  });

  it('no longer grants what the old detection pipeline needed', () => {
    // Deleting code is not enough; the grants have to go too, or the app keeps permissions it
    // has no use for. The widget reads no files and writes none (ADR-0018).
    expect(command('lsof-cwd')).toBeUndefined();
    const fsGrants = permissions
      .map((entry) => (typeof entry === 'string' ? entry : entry.identifier))
      .filter((identifier) => identifier.startsWith('fs:'));

    expect(fsGrants.sort()).toEqual(['fs:allow-unwatch', 'fs:allow-watch']);
  });

  it('grants a watch on the project tree, and nothing more than a watch', () => {
    // The doorbell (ADR-0020): it says "something happened", and cannot read a byte to find out
    // what — which is the property that keeps ADR-0018 true.
    expect(allowsPath('fs:allow-watch', '$HOME/.claude/projects')).toBe(true);
    expect(allowsPath('fs:allow-watch', '$HOME/.claude/projects/**')).toBe(true);
    expect(permissions).toContain('fs:allow-unwatch');
    for (const readOrWrite of [
      'fs:allow-read-text-file',
      'fs:allow-read-dir',
      'fs:allow-write-text-file',
      'fs:allow-stat',
      'fs:allow-exists',
      'fs:default',
    ]) {
      expect(permissions.some((entry) => JSON.stringify(entry).includes(readOrWrite))).toBe(false);
    }
  });
});
