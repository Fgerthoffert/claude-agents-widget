import { useEffect } from 'react';

import { isTauri } from './isTauri';

/**
 * Brings the installed hook script up to date, once, on launch.
 *
 * A separate hook rather than part of `useSetupState` because it is a write, and reading the
 * setup state must stay something that can be done without side effects. It takes no arguments
 * and reports nothing: the outcome goes to the app log, and the setup view reads the resulting
 * state from disk like it always did (ADR-0017).
 */
export const useHookScriptRefresh = (): void => {
  useEffect(() => {
    if (!isTauri()) return;

    void import('../detection/refreshHookScript').then(({ refreshHookScript }) =>
      refreshHookScript(),
    );
  }, []);
};
