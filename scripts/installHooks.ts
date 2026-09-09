// Installs the widget's hook into ~/.claude/settings.json. Run via `npm run install-hooks`.
//
// Consent is explicit: the default run prints what it will change and waits for confirmation.
// `--dry-run` prints and exits, `--yes` confirms non-interactively (for scripted installs).
//
// Written in TypeScript and executed through Node's type stripping so it can share the tested
// pure merge function in src/core rather than reimplementing it — see ADR-0006.

import { once } from 'node:events';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

import { mergeHookSettings } from '../src/core/mergeHookSettings.ts';
import type { ClaudeSettings } from '../src/core/types.ts';

const BACKUP_SUFFIX = '.claude-agents-widget.bak';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceHook = join(repoRoot, 'hooks', 'claude-agents-widget-hook.mjs');

const out = (line: string): void => void process.stdout.write(`${line}\n`);

const fail = (line: string): never => {
  process.stderr.write(`${line}\n`);
  process.exit(1);
};

/** Refuses rather than repairs: a settings file we cannot parse must never be overwritten. */
const readSettings = (path: string): ClaudeSettings => {
  if (!existsSync(path)) return {};

  const raw = readFileSync(path, 'utf8');
  if (raw.trim() === '') return {};

  const parsed: unknown = ((): unknown => {
    try {
      const value: unknown = JSON.parse(raw);
      return value;
    } catch (error) {
      return fail(
        `Refusing to touch ${path}: it is not valid JSON ` +
          `(${error instanceof Error ? error.message : String(error)}).\n` +
          'Fix or move the file, then run this again. Nothing has been changed.',
      );
    }
  })();

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return fail(`Refusing to touch ${path}: expected a JSON object. Nothing has been changed.`);
  }
  return parsed as ClaudeSettings;
};

/**
 * Asks, and treats every non-answer as "no".
 *
 * A non-TTY stdin is refused up front rather than prompted: `question` would never settle,
 * the event loop would empty with the top-level `await` still pending, and Node would exit 13
 * with "Detected unsettled top-level await" instead of saying anything useful. An EOF (Ctrl-D)
 * closes the interface without answering, which is raced for the same reason.
 */
const confirm = async (): Promise<boolean> => {
  if (process.stdin.isTTY !== true) {
    out('Standard input is not a terminal, so there is nobody to ask.');
    out('Re-run with --dry-run to preview the change, or --yes to apply it non-interactively.');
    return false;
  }

  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await Promise.race([
      readline.question('Apply these changes? [y/N] '),
      once(readline, 'close').then(() => ''),
    ]);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    readline.close();
  }
};

const run = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const assumeYes = args.includes('--yes');

  const home = homedir();
  const widgetHome = join(home, '.claude-agents-widget');
  const installedHook = join(widgetHome, 'hook.mjs');
  const settingsPath = join(home, '.claude', 'settings.json');

  const settings = readSettings(settingsPath);
  const { settings: merged, added, unchanged } = mergeHookSettings(settings, installedHook);

  out(`Hook script : ${installedHook}`);
  out(`Settings    : ${settingsPath}`);
  out(`State files : ${join(widgetHome, 'sessions')}`);
  if (unchanged.length > 0) out(`Already set : ${unchanged.join(', ')}`);
  out(added.length > 0 ? `Will add    : ${added.join(', ')}` : 'Will add    : nothing');

  if (dryRun) {
    out('\n--dry-run: nothing written.');
    if (merged) out(JSON.stringify({ hooks: merged.hooks }, null, 2));
    return;
  }

  if (!assumeYes && !(await confirm())) {
    out('Aborted. Nothing has been changed.');
    return;
  }

  // Copy unconditionally so an existing install picks up a newer hook script.
  mkdirSync(widgetHome, { recursive: true });
  copyFileSync(sourceHook, installedHook);
  out(`Copied hook to ${installedHook}`);

  if (!merged) {
    out('Settings already register every event; left untouched.');
    return;
  }

  // Back up only once, so the pristine pre-widget file is what a user can restore.
  const backupPath = `${settingsPath}${BACKUP_SUFFIX}`;
  if (existsSync(settingsPath) && !existsSync(backupPath)) {
    copyFileSync(settingsPath, backupPath);
    out(`Backed up settings to ${backupPath}`);
  }

  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(merged, null, 2)}\n`);
  out(`Registered ${String(added.length)} event(s) in ${settingsPath}`);
  out('Restart any running Claude Code sessions for the hook to take effect.');
};

await run();
