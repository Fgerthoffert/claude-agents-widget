import { useEffect, useState } from 'react';

import { formatBuildIdentity } from '../core/formatBuildIdentity';
import { isTauri } from './isTauri';
import { readBuildInfo } from './readBuildInfo';

/**
 * The build identity string — `v0.2.1` on a release, `v0.2.1 (abc1234)` on anything else.
 *
 * The version comes from the native layer (`core:app:allow-version`, kept in lockstep with
 * `package.json` by `scripts/checkVersions.ts`) so it can never drift from the installed bundle;
 * the commit comes from the build stamp. `null` until both are known.
 */
export const useAppVersion = (): string | null => {
  const [identity, setIdentity] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;

    void (async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        setIdentity(formatBuildIdentity(await getVersion(), readBuildInfo()));
      } catch (error) {
        console.warn('could not read the app version', error);
      }
    })();
  }, []);

  return identity;
};
