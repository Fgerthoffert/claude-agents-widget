import { appLogDir, join } from '@tauri-apps/api/path';

/** Must match the `file_name` given to `tauri_plugin_log`'s `LogDir` target in `src-tauri`. */
const LOG_FILE = 'claude-agents-widget.log';

/**
 * Absolute path of the log file, so the panel and the diagnostics dump can name it instead of
 * telling the user to go and find it. Returns `null` outside the native shell.
 */
export const appLogPath = async (): Promise<string | null> => {
  try {
    return await join(await appLogDir(), LOG_FILE);
  } catch {
    return null;
  }
};
