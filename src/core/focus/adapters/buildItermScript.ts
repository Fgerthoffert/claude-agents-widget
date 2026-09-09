import { escapeAppleScriptString } from '../escapeAppleScriptString';
import type { FocusScript, FocusTarget } from '../types';

/**
 * Selects the iTerm2 session (split pane) attached to the session's tty.
 *
 * `iTerm2.sdef` gives `session` a read-only `tty` and a `select` command that also applies to
 * tabs and windows, so selecting inside-out lands on the exact pane. Reading `tty` is guarded
 * because a dead pane raises instead of answering.
 */
export const buildItermScript = (target: FocusTarget): FocusScript | null => {
  const { appName } = target.host;
  if (appName === null || target.ttyDevice === null) return null;

  return {
    method: 'tab',
    source: [
      `set targetTty to "${escapeAppleScriptString(target.ttyDevice)}"`,
      `tell application "${escapeAppleScriptString(appName)}"`,
      `  repeat with win in windows`,
      `    repeat with tb in tabs of win`,
      `      repeat with sess in sessions of tb`,
      `        set matched to false`,
      `        try`,
      `          set matched to (tty of sess is targetTty)`,
      `        end try`,
      `        if matched then`,
      `          select sess`,
      `          select tb`,
      `          select win`,
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
