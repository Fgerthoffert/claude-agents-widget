import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import { homeDir } from '@tauri-apps/api/path';

import { extractSessionTitle } from '../core/extractSessionTitle';

/** Session id plus the absolute or home-relative transcript path to read it from. */
export interface TitleSource {
  readonly sessionId: string;
  readonly transcriptPath: string | null;
}

/**
 * Extracts a display title per session from its transcript.
 *
 * Titles evolve as a conversation goes on, so this re-reads on every sweep rather than caching.
 * Hook payloads carry absolute transcript paths while the scanner produces home-relative ones;
 * both are normalised here because the fs capability is scoped to the home directory.
 */
export const readSessionTitles = async (
  sources: readonly TitleSource[],
): Promise<ReadonlyMap<string, string>> => {
  const home = await homeDir();

  const pairs = await Promise.all(
    sources.map(async ({ sessionId, transcriptPath }) => {
      if (transcriptPath === null) return null;

      const relative = transcriptPath.startsWith(home)
        ? transcriptPath.slice(home.length).replace(/^\//, '')
        : transcriptPath;

      try {
        const title = extractSessionTitle(
          await readTextFile(relative, { baseDir: BaseDirectory.Home }),
        );
        return title === null ? null : ([sessionId, title] as const);
      } catch {
        // No transcript yet, or one we are not allowed to read: the row shows its project.
        return null;
      }
    }),
  );

  return new Map(pairs.filter((pair): pair is readonly [string, string] => pair !== null));
};
