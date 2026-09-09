/** Levels we actually use; `info` marks the pipeline's lifecycle, `error` its failures. */
export type LogLevel = 'info' | 'warn' | 'error';

/**
 * Writes one line to the app log file, and to the console when there is one.
 *
 * This exists because `console.error` alone was the v0.2.0 bug: a packaged release has no
 * devtools, so a fatal detection error was written to a stream nobody could ever read and the
 * panel simply looked idle. `tauri-plugin-log` puts the same line in
 * `~/Library/Logs/<bundle id>/claude-agents-widget.log`, which a user can be asked for
 * (ADR-0011).
 *
 * The plugin is imported lazily and its failure is swallowed on purpose: the browser preview and
 * jsdom have no native layer, and logging must never be the thing that breaks detection.
 */
export const logDetection = async (level: LogLevel, message: string): Promise<void> => {
  if (level === 'error') console.error(message);
  else if (level === 'warn') console.warn(message);

  try {
    const log = await import('@tauri-apps/plugin-log');
    await log[level](message);
  } catch {
    // No native layer, or the log plugin is missing: the console line above still stands.
  }
};
