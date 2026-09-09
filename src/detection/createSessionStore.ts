import type { Session } from '../core/types';

export interface SessionStore {
  /** Current snapshot. Stable by reference until something actually changes. */
  readonly getSessions: () => readonly Session[];
  /** Replaces the snapshot; notifies subscribers only when the list differs. */
  readonly setSessions: (sessions: readonly Session[]) => void;
  /** Returns an unsubscribe function, matching React's `useSyncExternalStore` contract. */
  readonly subscribe: (listener: () => void) => () => void;
}

/**
 * The single source of truth the UI (phase 3) and focus engine (phase 4) read from.
 *
 * A closure over a mutable snapshot rather than a state library: the whole contract is one
 * getter, one setter and a subscribe, which is exactly what `useSyncExternalStore` wants.
 *
 * Identical reconciler output must not re-render the panel, so the setter compares before
 * notifying — the 5s scanner produces an unchanged list most of the time.
 */
export const createSessionStore = (): SessionStore => {
  let sessions: readonly Session[] = [];
  const listeners = new Set<() => void>();

  const setSessions = (next: readonly Session[]): void => {
    if (JSON.stringify(next) === JSON.stringify(sessions)) return;
    sessions = next;
    for (const listener of [...listeners]) listener();
  };

  return {
    getSessions: () => sessions,
    setSessions,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
