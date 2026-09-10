import { useEffect, useSyncExternalStore } from 'react';

import { describeDetectionFailure } from '../core/describeDetectionFailure';
import { createSessionStore } from '../detection/createSessionStore';
import { logToApp } from '../detection/logToApp';
import { startDetection } from '../detection/startDetection';
import type { DetectionHealth, Session } from '../core/types';

// One store per app, not per component: the detection pipeline is a singleton.
const store = createSessionStore();

export interface SessionsView {
  readonly sessions: readonly Session[];
  /** Why the list may be empty or stale. Presentation must never ignore this (ADR-0011). */
  readonly health: DetectionHealth;
}

/**
 * Subscribes a component to the live session list, starting the detection pipeline on first
 * mount.
 *
 * The health snapshot rides along because the two are only meaningful together: an empty list
 * with a healthy pipeline means "nothing running", and the same list with a failing one means
 * "the widget is broken" — and the panel has to say which.
 */
export const useSessions = (): SessionsView => {
  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;

    startDetection(store)
      .then((dispose) => {
        if (cancelled) dispose();
        else stop = dispose;
      })
      .catch((error: unknown) => {
        const failure = describeDetectionFailure('startup', error);
        void logToApp('error', failure);
        store.setHealth({ failure, degraded: [] });
      });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  // Two subscriptions rather than one composite snapshot: `useSyncExternalStore` demands a
  // reference-stable value, which a freshly built object never is.
  const sessions = useSyncExternalStore(store.subscribe, store.getSessions);
  const health = useSyncExternalStore(store.subscribe, store.getHealth);

  return { sessions, health };
};
