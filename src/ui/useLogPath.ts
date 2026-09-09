import { useEffect, useState } from 'react';

import { appLogPath } from '../detection/appLogPath';

/**
 * Absolute path of the app log file, or `null` outside the native shell.
 *
 * The setup view names it rather than telling the user to go and look for it: the log is the only
 * place the underlying error text survives in a release build (ADR-0011).
 */
export const useLogPath = (): string | null => {
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    void appLogPath().then(setPath);
  }, []);

  return path;
};
