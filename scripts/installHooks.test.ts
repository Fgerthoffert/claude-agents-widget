import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ClaudeSettings } from '../src/core/types.ts';

const scriptPath = fileURLToPath(new URL('./installHooks.ts', import.meta.url));

let home = '';

/**
 * Runs the installer with HOME pointed at a throwaway directory. The real
 * ~/.claude/settings.json is never a target of these tests.
 */
const install = (...args: string[]): string =>
  execFileSync(process.execPath, ['--experimental-strip-types', scriptPath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });

const installExpectingFailure = (): { status: number; stderr: string } => {
  try {
    install('--yes');
    return { status: 0, stderr: '' };
  } catch (error) {
    const failure = error as { status?: number; stderr?: string };
    return { status: failure.status ?? -1, stderr: failure.stderr ?? '' };
  }
};

const settingsPath = () => join(home, '.claude', 'settings.json');
const hookPath = () => join(home, '.claude-agents-widget', 'hook.mjs');
const backupPath = () => `${settingsPath()}.claude-agents-widget.bak`;

const writeSettings = (contents: string) => {
  mkdirSync(dirname(settingsPath()), { recursive: true });
  writeFileSync(settingsPath(), contents);
};

const readSettings = (): ClaudeSettings =>
  JSON.parse(readFileSync(settingsPath(), 'utf8')) as ClaudeSettings;

const eventsRegistered = (): string[] => Object.keys(readSettings().hooks ?? {});

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'caw-install-'));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe('install-hooks', () => {
  it('registers all five events and copies the hook script', () => {
    const output = install('--yes');

    expect(output).toContain('Registered 5 event(s)');
    expect(eventsRegistered()).toEqual([
      'SessionStart',
      'UserPromptSubmit',
      'Stop',
      'Notification',
      'SessionEnd',
    ]);
    expect(readFileSync(hookPath(), 'utf8')).toContain('claude-agents-widget');
    expect(readSettings().hooks?.Stop).toEqual([
      { hooks: [{ type: 'command', command: `node ${hookPath()}` }] },
    ]);
  });

  it('writes nothing under --dry-run', () => {
    const output = install('--dry-run');

    expect(output).toContain('--dry-run: nothing written.');
    expect(output).toContain('Will add    : SessionStart, UserPromptSubmit, Stop');
    expect(existsSync(settingsPath())).toBe(false);
    expect(existsSync(hookPath())).toBe(false);
  });

  it('is idempotent: a second run changes nothing', () => {
    install('--yes');
    const before = readFileSync(settingsPath(), 'utf8');

    const output = install('--yes');

    expect(output).toContain('Settings already register every event');
    expect(readFileSync(settingsPath(), 'utf8')).toBe(before);
  });

  it("preserves another tool's hooks and unrelated settings", () => {
    writeSettings(
      JSON.stringify({
        theme: 'dark',
        hooks: {
          PreToolUse: [],
          SessionStart: [{ hooks: [{ type: 'command', command: 'python3', args: ['other.py'] }] }],
        },
      }),
    );

    install('--yes');

    const settings = readSettings();
    expect(settings.theme).toBe('dark');
    expect(settings.hooks?.PreToolUse).toEqual([]);
    expect(settings.hooks?.SessionStart).toHaveLength(2);
    expect(settings.hooks?.SessionStart?.[0]?.hooks?.[0]?.command).toBe('python3');
  });

  it('backs up an existing settings file exactly once', () => {
    writeSettings(JSON.stringify({ theme: 'dark' }));
    const original = readFileSync(settingsPath(), 'utf8');

    install('--yes');
    expect(readFileSync(backupPath(), 'utf8')).toBe(original);

    // A later run must not overwrite the pristine backup with an already-modified file.
    writeSettings(JSON.stringify({ theme: 'light' }));
    install('--yes');
    expect(readFileSync(backupPath(), 'utf8')).toBe(original);
  });

  it('creates no backup when there was no settings file', () => {
    install('--yes');
    expect(existsSync(backupPath())).toBe(false);
  });

  it('refuses malformed JSON without touching anything', () => {
    writeSettings('{ "hooks": { oops }');

    const { status, stderr } = installExpectingFailure();

    expect(status).toBe(1);
    expect(stderr).toContain('not valid JSON');
    expect(stderr).toContain('Nothing has been changed');
    expect(readFileSync(settingsPath(), 'utf8')).toBe('{ "hooks": { oops }');
    expect(existsSync(hookPath())).toBe(false);
  });

  it('refuses a settings file that is not a JSON object', () => {
    writeSettings('[1, 2, 3]');

    const { status, stderr } = installExpectingFailure();

    expect(status).toBe(1);
    expect(stderr).toContain('expected a JSON object');
    expect(existsSync(hookPath())).toBe(false);
  });

  it('treats an empty settings file as empty settings', () => {
    writeSettings('   ');
    install('--yes');
    expect(eventsRegistered()).toHaveLength(5);
  });

  it('reports the state directory the app will watch', () => {
    expect(install('--dry-run')).toContain(join(home, '.claude-agents-widget', 'sessions'));
  });
});
