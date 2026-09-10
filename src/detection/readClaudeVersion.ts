import { Command } from '@tauri-apps/plugin-shell';

import { parseClaudeVersion } from '../core/parseClaudeVersion';

/** Must match the allowlist entry in `src-tauri/capabilities/default.json`. */
const COMMAND = 'claude-version';

/**
 * Which Claude Code the widget is reading, or `null` when it cannot tell.
 *
 * Worth showing in the footer next to the widget's own version because the two together answer
 * the first question about any odd behaviour: the widget is now a view over
 * `claude agents --json` (ADR-0018), so what it can show depends on the CLI as much as on
 * itself. A bug report with both versions in it starts halfway to an answer.
 *
 * Read once per launch, through the same login shell as the session list and for the same
 * reason: `claude` is not on a GUI app's `PATH`. A failure is `null` and nothing more — the
 * footer omits what it does not know, and detection reports its own problems separately.
 */
export const readClaudeVersion = async (): Promise<string | null> => {
  try {
    const { code, stdout } = await Command.create(COMMAND).execute();
    return code === 0 ? parseClaudeVersion(stdout) : null;
  } catch {
    return null;
  }
};
