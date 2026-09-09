import type { DetectionHealth, Session } from '../core/types';

/** Nothing has failed and nothing has been degraded — the state before the first sweep. */
const HEALTHY: DetectionHealth = { failure: null, degraded: [] };

export interface SessionStore {
  /** Current snapshot. Stable by reference until something actually changes. */
  readonly getSessions: () => readonly Session[];
  /** Replaces the snapshot; notifies subscribers only when the list differs. */
  readonly setSessions: (sessions: readonly Session[]) => void;
  /** Whether sweeps are working. Stable by reference until it changes. */
  readonly getHealth: () => DetectionHealth;
  readonly setHealth: (health: DetectionHealth) => void;
  /** Returns an unsubscribe function, matching React's `useSyncExternalStore` contract. */
  readonly subscribe: (listener: () => void) => () => void;
}

/**
 * The single source of truth the UI (phase 3) and focus engine (phase 4) read from.
 *
 * A closure over a mutable snapshot rather than a state library: the whole contract is a getter,
 * a setter and a subscribe, which is exactly what `useSyncExternalStore` wants.
 *
 * It holds two snapshots, not one: the sessions, and whether the pipeline that produced them is
 * working. Without the second, an empty list and a broken sweep are indistinguishable, which is
 * the whole of ADR-0011.
 *
 * Identical output must not re-render the panel, so both setters compare before notifying — the
 * 5s scanner produces an unchanged list most of the time, and `useSyncExternalStore` requires a
 * reference-stable snapshot.
 */
export const createSessionStore = (): SessionStore => {
  let sessions: readonly Session[] = [];
  let health: DetectionHealth = HEALTHY;
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };

  return {
    getSessions: () => sessions,
    setSessions: (next) => {
      if (JSON.stringify(next) === JSON.stringify(sessions)) return;
      sessions = next;
      notify();
    },
    getHealth: () => health,
    setHealth: (next) => {
      if (JSON.stringify(next) === JSON.stringify(health)) return;
      health = next;
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
