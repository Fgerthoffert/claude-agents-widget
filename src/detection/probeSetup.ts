import { homeDir, join } from '@tauri-apps/api/path';
import { BaseDirectory, exists, readTextFile } from '@tauri-apps/plugin-fs';

import type { ClaudeSettings } from '../core/types';

/** Home-relative, which is the only scope the fs capability grants (see capabilities/default.json). */
export const SETTINGS_REL = '.claude/settings.json';
export const HOOK_SCRIPT_REL = '.claude-agents-widget/hook.mjs';
export const BACKUP_REL = `${SETTINGS_REL}.claude-agents-widget.bak`;

/** What the filesystem can tell us about the install, before sessions are folded in. */
export interface SetupFilesProbe {
  readonly settings: ClaudeSettings | null;
  /** The file exists but is not parseable JSON — nothing may be written to it. */
  readonly settingsUnreadable: boolean;
  readonly hookScriptInstalled: boolean;
  /** Absolute paths, because the hook entries in settings.json are absolute. */
  readonly hookPath: string;
  readonly settingsPath: string;
}

/**
 * Reads the two things that decide whether the widget is set up: whether our hook script is on
 * disk, and what `~/.claude/settings.json` currently says.
 *
 * A settings file that will not parse is reported as such rather than treated as empty. That
 * distinction is the whole safety story of the installer: "no hooks yet" means write, "cannot
 * read it" means refuse (ADR-0006).
 */
export const probeSetup = async (): Promise<SetupFilesProbe> => {
  const home = await homeDir();
  const [hookPath, settingsPath] = await Promise.all([
    join(home, HOOK_SCRIPT_REL),
    join(home, SETTINGS_REL),
  ]);

  const [hookScriptInstalled, settingsExists] = await Promise.all([
    exists(HOOK_SCRIPT_REL, { baseDir: BaseDirectory.Home }),
    exists(SETTINGS_REL, { baseDir: BaseDirectory.Home }),
  ]);

  if (!settingsExists) {
    return {
      settings: null,
      settingsUnreadable: false,
      hookScriptInstalled,
      hookPath,
      settingsPath,
    };
  }

  try {
    const raw = await readTextFile(SETTINGS_REL, { baseDir: BaseDirectory.Home });
    const parsed: unknown = raw.trim() === '' ? {} : JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('settings.json is not a JSON object');
    }
    return {
      settings: parsed as ClaudeSettings,
      settingsUnreadable: false,
      hookScriptInstalled,
      hookPath,
      settingsPath,
    };
  } catch (error) {
    console.warn('could not read ~/.claude/settings.json', error);
    return {
      settings: null,
      settingsUnreadable: true,
      hookScriptInstalled,
      hookPath,
      settingsPath,
    };
  }
};
