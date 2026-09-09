import { escapeAppleScriptString } from '../escapeAppleScriptString';
import type { FocusScript, FocusTarget } from '../types';

/**
 * Focuses the Ghostty terminal surface whose working directory is the session's `cwd`.
 *
 * `Ghostty.sdef` exposes no tty, but it does expose `working directory` per surface plus a
 * `focus` command that raises the owning window — so cwd is the matching key here. Ghostty
 * sometimes reports the directory with a trailing slash, hence both forms are compared.
 */
export const buildGhosttyScript = (target: FocusTarget): FocusScript | null => {
  const { appName } = target.host;
  if (appName === null || target.cwd === null) return null;

  return {
    method: 'tab',
    source: [
      `set targetDir to "${escapeAppleScriptString(target.cwd)}"`,
      `tell application "${escapeAppleScriptString(appName)}"`,
      `  repeat with win in windows`,
      `    repeat with tb in tabs of win`,
      `      repeat with surf in terminals of tb`,
      `        set matched to false`,
      `        try`,
      `          set wd to working directory of surf`,
      `          set matched to (wd is targetDir or wd is (targetDir & "/"))`,
      `        end try`,
      `        if matched then`,
      `          focus surf`,
      `          activate`,
      `          return "tab"`,
      `        end if`,
      `      end repeat`,
      `    end repeat`,
      `  end repeat`,
      `end tell`,
      `return "none"`,
    ].join('\n'),
  };
};
