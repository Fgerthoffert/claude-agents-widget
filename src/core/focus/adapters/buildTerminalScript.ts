import { escapeAppleScriptString } from '../escapeAppleScriptString';
import type { FocusScript, FocusTarget } from '../types';

/**
 * Selects the Terminal.app tab attached to the session's tty.
 *
 * `Terminal.sdef` gives `tab` a read-only `tty` and a writable `selected`, and `window` a
 * writable `frontmost` — so tty matching is exact, with no title heuristics. Reading `tty` is
 * guarded because a tab whose shell has exited raises rather than returning a value; the
 * selection itself is left unguarded so a genuine failure reaches stderr.
 */
export const buildTerminalScript = (target: FocusTarget): FocusScript | null => {
  const { appName } = target.host;
  if (appName === null || target.ttyDevice === null) return null;

  return {
    method: 'tab',
    source: [
      `set targetTty to "${escapeAppleScriptString(target.ttyDevice)}"`,
      `tell application "${escapeAppleScriptString(appName)}"`,
      `  repeat with win in windows`,
      `    repeat with tb in tabs of win`,
      `      set matched to false`,
      `      try`,
      `        set matched to (tty of tb is targetTty)`,
      `      end try`,
      `      if matched then`,
      `        set selected of tb to true`,
      `        set frontmost of win to true`,
      `        activate`,
      `        return "tab"`,
      `      end if`,
      `    end repeat`,
      `  end repeat`,
      `end tell`,
      `return "none"`,
    ].join('\n'),
  };
};
