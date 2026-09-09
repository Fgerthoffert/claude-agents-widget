import { homeDir } from '@tauri-apps/api/path';
import { useEffect, useState } from 'react';

import { isTauri } from './isTauri';

/**
 * The user's home directory, for abbreviating session paths to `~/…`.
 *
 * Resolved once and returned as `''` until it arrives, which `shortenPath` treats as "unknown"
 * and renders the full path — a correct row that gets shorter a tick later, never a wrong one.
 * That is also what happens outside the native shell, where there is no home to resolve.
 */
export const useHomeDir = (): string => {
  const [home, setHome] = useState('');

  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;
    homeDir()
      .then((resolved) => {
        if (!cancelled) setHome(resolved);
      })
      .catch((error: unknown) => {
        console.warn('could not resolve the home directory', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return home;
};
