import { escapeAppleScriptString } from '../escapeAppleScriptString';
import type { FocusScript, FocusTarget } from '../types';

/** How far up from `cwd` we are willing to guess at the workspace root. */
const MAX_CANDIDATES = 3;

/**
 * Window-title fragments to look for, deepest path segment first.
 *
 * A VS Code window title ends in the workspace root's name, and the session's `cwd` is the root
 * or a descendant of it — so some segment of `cwd` appears in the title. Dot-directories
 * (`.claude/worktrees/…`) are never window roots and are dropped, which lets a git worktree path
 * still reach its repository name within the budget.
 */
const titleCandidates = (cwd: string): readonly string[] =>
  cwd
    .split('/')
    .filter((segment) => segment !== '' && !segment.startsWith('.'))
    .reverse()
    .slice(0, MAX_CANDIDATES);

/**
 * Raises the VS Code window whose title names the session's workspace.
 *
 * VS Code exposes no AppleScript window API (verified: `get name of every window` fails with
 * -1728), so the only window-level route is `System Events` + `AXRaise`, which needs macOS
 * Accessibility consent. `activate` is attempted first and tolerated failing, so an Automation
 * denial for VS Code itself still leaves the Accessibility attempt — and any real permission
 * error surfaces on stderr instead of being swallowed, because Phase 5's first-run guide needs
 * to see it. Tab-level precision inside a window is out of scope (ADR-0007).
 *
 * Titles are matched in two passes. A VS Code title reads `file.ts — workspaceRoot`, so pass one
 * compares whole separator-delimited names and refuses a partial hit — without it, a session in
 * `…/cortex` raises a `cortex-joe` window, which was observed live. Pass two relaxes to a
 * substring so that a customised title format still lands somewhere in the right app.
 */
export const buildVscodeScript = (target: FocusTarget): FocusScript | null => {
  const { appName, processName } = target.host;
  if (appName === null || processName === null || target.cwd === null) return null;

  const candidates = titleCandidates(target.cwd);
  if (candidates.length === 0) return null;

  const list = candidates.map((candidate) => `"${escapeAppleScriptString(candidate)}"`).join(', ');

  return {
    method: 'window',
    source: [
      `set candidates to {${list}}`,
      // U+2014 by character id, so this builder emits pure ASCII.
      `set sep to " " & (character id 8212) & " "`,
      `try`,
      `  tell application "${escapeAppleScriptString(appName)}" to activate`,
      `end try`,
      `tell application "System Events"`,
      `  set wins to windows of process "${escapeAppleScriptString(processName)}"`,
      `  repeat with pass in {1, 2}`,
      `    repeat with candidate in candidates`,
      `      repeat with win in wins`,
      `        set matched to false`,
      `        try`,
      `          set wname to name of win`,
      `          set cand to candidate as text`,
      `          if pass is 1 then`,
      `            set matched to (wname is cand or wname ends with (sep & cand))`,
      `          else`,
      `            set matched to (wname contains cand)`,
      `          end if`,
      `        end try`,
      `        if matched then`,
      `          perform action "AXRaise" of win`,
      `          return "window"`,
      `        end if`,
      `      end repeat`,
      `    end repeat`,
      `  end repeat`,
      `end tell`,
      `return "none"`,
    ].join('\n'),
  };
};
