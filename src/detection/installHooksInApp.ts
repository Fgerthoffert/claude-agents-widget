import { resolveResource } from '@tauri-apps/api/path';
import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

import { mergeHookSettings } from '../core/mergeHookSettings';
import { BACKUP_REL, HOOK_SCRIPT_REL, SETTINGS_REL, probeSetup } from './probeSetup';
import type { HookInstallReport } from '../core/describeHookInstall';

/** Where the hook script rides inside the app bundle — see `bundle.resources` in tauri.conf.json. */
const HOOK_RESOURCE = 'hooks/claude-agents-widget-hook.mjs';

type Failure = NonNullable<HookInstallReport['reason']>;

const failure = (reason: Failure, detail: string): HookInstallReport => ({
  ok: false,
  added: [],
  alreadyPresent: [],
  backedUp: false,
  reason,
  detail,
});

/**
 * Installs the Claude Code hooks from inside the app: copies the bundled hook script to
 * `~/.claude-agents-widget/hook.mjs` and merges our five event entries into
 * `~/.claude/settings.json`.
 *
 * This is the same operation as `npm run install-hooks`, doing the same things in the same
 * order and sharing the same pure `mergeHookSettings` — because a user who installed the
 * `.dmg` has no repository, no npm and no reason to open a terminal.
 *
 * Order is the safety property. The settings file is read and validated **before** anything is
 * written, so a file we cannot parse aborts the install with no side effects at all; the backup
 * is written before the settings, and only once, so it keeps the pristine pre-widget file.
 * Callers must have obtained explicit consent first: this function does not ask.
 */
export const installHooksInApp = async (): Promise<HookInstallReport> => {
  const probe = await probeSetup();
  if (probe.settingsUnreadable) {
    return failure(
      'settings-unreadable',
      `${probe.settingsPath} is not valid JSON. Fix or move it, then try again — nothing was changed.`,
    );
  }

  const merge = mergeHookSettings(probe.settings ?? {}, probe.hookPath);

  let source: string;
  try {
    source = await readTextFile(await resolveResource(HOOK_RESOURCE));
  } catch (error) {
    return failure('hook-resource-missing', String(error));
  }

  try {
    await mkdir('.claude-agents-widget', { baseDir: BaseDirectory.Home, recursive: true });
    // Copied unconditionally, so an upgraded app refreshes an older installed script.
    await writeTextFile(HOOK_SCRIPT_REL, source, { baseDir: BaseDirectory.Home });

    if (merge.settings === null) {
      return {
        ok: true,
        added: [],
        alreadyPresent: merge.unchanged,
        backedUp: false,
        reason: null,
        detail: null,
      };
    }

    const [settingsExists, backupExists] = await Promise.all([
      exists(SETTINGS_REL, { baseDir: BaseDirectory.Home }),
      exists(BACKUP_REL, { baseDir: BaseDirectory.Home }),
    ]);

    const backedUp = settingsExists && !backupExists;
    if (backedUp) {
      const raw = await readTextFile(SETTINGS_REL, { baseDir: BaseDirectory.Home });
      await writeTextFile(BACKUP_REL, raw, { baseDir: BaseDirectory.Home });
    }

    await mkdir('.claude', { baseDir: BaseDirectory.Home, recursive: true });
    await writeTextFile(SETTINGS_REL, `${JSON.stringify(merge.settings, null, 2)}\n`, {
      baseDir: BaseDirectory.Home,
    });

    return {
      ok: true,
      added: merge.added,
      alreadyPresent: merge.unchanged,
      backedUp,
      reason: null,
      detail: null,
    };
  } catch (error) {
    return failure('write-failed', String(error));
  }
};
