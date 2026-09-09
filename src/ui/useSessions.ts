import { useEffect, useSyncExternalStore } from 'react';

import { createSessionStore } from '../detection/createSessionStore';
import { startDetection } from '../detection/startDetection';
import type { Session } from '../core/types';

// One store per app, not per component: the detection pipeline is a singleton.
const store = createSessionStore();

/**
 * Subscribes a component to the live session list, starting the detection pipeline on first
 * mount. Phase 3 builds the real panel and tray on this same hook.
 */
export const useSessions = (): readonly Session[] => {
  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;

    startDetection(store)
      .then((dispose) => {
        if (cancelled) dispose();
        else stop = dispose;
      })
      .catch((error: unknown) => {
        console.error('failed to start detection', error);
      });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return useSyncExternalStore(store.subscribe, store.getSessions);
};
