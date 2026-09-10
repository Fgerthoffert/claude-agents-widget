import { BaseDirectory, watchImmediate } from '@tauri-apps/plugin-fs';

/** Home-relative, which is the only scope the fs capability grants. */
const PROJECTS_DIR = '.claude/projects';

/**
 * Calls `onChange` when Claude Code writes anything under `~/.claude/projects`.
 *
 * **This is a doorbell, not a data source.** It supplies timing and nothing else: no file is
 * read, no line is parsed, and no session state is inferred from it. `claude agents --json`
 * remains the only thing that says what a session is doing (ADR-0018). The distinction matters
 * because reading these files for *state* is exactly the mistake that ADR undid, and this looks
 * superficially like the same thing.
 *
 * It exists because polling is the only way to ask, and asking costs ~330ms of CPU: at a 1s
 * interval that is a third of a core, forever, for a widget that is idle most of the day. There
 * is no file to watch that reflects a session's *status* — `~/.claude/daemon/roster.json` tracks
 * background workers only, and was an hour stale with `"workers": {}` while five interactive
 * sessions were live. But a session writes to its transcript on every turn, and `/clear` creates
 * a whole new transcript in the same project directory — so a write under this tree means
 * "something happened, go and ask" (ADR-0020).
 *
 * Recursive, because the interesting event is a *new* file appearing in a project directory.
 * Returns a function that stops watching, or `null` if the watch could not be set up — losing it
 * costs latency, never detection, so the caller falls back to its heartbeat.
 */
export const watchClaudeProjects = async (onChange: () => void): Promise<(() => void) | null> => {
  try {
    return await watchImmediate(PROJECTS_DIR, onChange, {
      baseDir: BaseDirectory.Home,
      recursive: true,
    });
  } catch {
    return null;
  }
};
