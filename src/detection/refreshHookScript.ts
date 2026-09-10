import { resolveResource } from '@tauri-apps/api/path';
import { BaseDirectory, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

import { HOOK_SCRIPT_REL } from './probeSetup';
import { logToApp } from './logToApp';

/** Where the hook script rides inside the app bundle — see `bundle.resources` in tauri.conf.json. */
const HOOK_RESOURCE = 'hooks/claude-agents-widget-hook.mjs';

/** What the refresh did, for the log and for anything that wants to report it. */
export type HookRefresh = 'absent' | 'current' | 'updated' | 'failed';

/**
 * Brings the installed hook script up to date with the one this app version ships.
 *
 * The hook lives in `~/.claude-agents-widget/hook.mjs` and was only ever rewritten when the user
 * pressed *Install hooks*. Once the entries were in `~/.claude/settings.json` the setup step read
 * `done`, the button went away, and the script on disk stayed at whatever version installed it —
 * so every fix shipped in the hook was invisible to anybody who did not think to reinstall. Two
 * of those fixes were found live: idle notifications still reported as "waiting for you", and a
 * cleared session still leaving its predecessor's row behind (ADR-0017).
 *
 * Consent is not at stake here, which is why this runs unprompted. ADR-0009's consent model is
 * about `~/.claude/settings.json` — *the user's* file, shared with Claude Code and whatever else
 * they have installed. This writes one file in the widget's own directory, which exists only
 * because the user asked for it, and replaces it with the version this app is built to read.
 *
 * An **absent** script is deliberately not created: that is the not-installed case, and it needs
 * the consent flow, not a silent write. Anything that goes wrong is logged and swallowed — a
 * stale hook is a degraded widget, and a widget that will not start is a broken one.
 */
export const refreshHookScript = async (): Promise<HookRefresh> => {
  let installed: string;
  try {
    installed = await readTextFile(HOOK_SCRIPT_REL, { baseDir: BaseDirectory.Home });
  } catch {
    return 'absent';
  }

  try {
    const shipped = await readTextFile(await resolveResource(HOOK_RESOURCE));
    if (shipped === installed) return 'current';

    await writeTextFile(HOOK_SCRIPT_REL, shipped, { baseDir: BaseDirectory.Home });
    void logToApp('info', `hook script refreshed: ${HOOK_SCRIPT_REL} was out of date`);
    return 'updated';
  } catch (error) {
    void logToApp('warn', `could not refresh the hook script: ${String(error)}`);
    return 'failed';
  }
};
