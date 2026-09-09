import { BaseDirectory, exists, readDir, readTextFile } from '@tauri-apps/plugin-fs';

import { parseSessionRecord } from '../core/parseSessionRecord';
import type { SessionRecord } from '../core/types';

/** Relative to the user's home dir, which is all the fs capability grants us. */
export const SESSIONS_DIR = '.claude-agents-widget/sessions';

/**
 * Reads every state file the hook script has written.
 *
 * Skips anything unreadable or unparseable rather than failing the whole sweep: a file caught
 * mid-write reappears intact on the next hook event, and one bad file must not hide the others.
 */
export const readHookRecords = async (): Promise<readonly SessionRecord[]> => {
  if (!(await exists(SESSIONS_DIR, { baseDir: BaseDirectory.Home }))) return [];

  const entries = await readDir(SESSIONS_DIR, { baseDir: BaseDirectory.Home });
  const records = await Promise.all(
    entries
      .filter((entry) => entry.isFile && entry.name.endsWith('.json'))
      .map(async (entry) => {
        try {
          const raw = await readTextFile(`${SESSIONS_DIR}/${entry.name}`, {
            baseDir: BaseDirectory.Home,
          });
          return parseSessionRecord(JSON.parse(raw));
        } catch {
          return null;
        }
      }),
  );

  return records.filter((record): record is SessionRecord => record !== null);
};
