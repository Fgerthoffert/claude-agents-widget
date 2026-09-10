import { useEffect, useState } from 'react';

import { isTauri } from './isTauri';

/**
 * The version of Claude Code the widget is reading, or `null` until it is known.
 *
 * Once per mount: a CLI can update underneath a long-running widget, but asking on a loop would
 * spend a process every few seconds on a string that changes a few times a month. The footer
 * shows what was true at launch, which is what a bug report needs.
 */
export const useClaudeVersion = (): string | null => {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;
    void import('../detection/readClaudeVersion').then(async ({ readClaudeVersion }) => {
      const found = await readClaudeVersion();
      if (!cancelled) setVersion(found);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return version;
};
