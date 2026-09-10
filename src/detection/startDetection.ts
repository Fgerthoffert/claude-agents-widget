import { carryStateSince } from '../core/carryStateSince';
import { describeDetectionFailure } from '../core/describeDetectionFailure';
import { logToApp } from './logToApp';
import { readAgentSessions } from './readAgentSessions';
import type { SessionStore } from './createSessionStore';

/**
 * How often Claude Code is asked. The PRD's target is a state change on screen within ~2s; each
 * ask costs one short-lived process (~0.3s), so this is the point where responsiveness stops
 * being worth the wake-ups (ADR-0018).
 */
const POLL_INTERVAL_MS = 3000;

/**
 * Starts the detection pipeline and returns a function that stops it.
 *
 * One source, one sweep: `claude agents --json`, parsed, stamped with how long each state has
 * held, published. There used to be two sources feeding a reconciler — a hook script pushing
 * events and a `ps`/`lsof`/transcript scanner inferring the rest — and both existed to work out
 * things Claude Code now states directly (ADR-0018).
 *
 * Sweeps are serialized on a promise chain and coalesced to at most one queued behind the one
 * running, so a slow answer cannot pile up a backlog of processes.
 *
 * Every step degrades rather than aborts, and records why in the store so the panel can say so
 * (ADR-0011): an empty list because nothing is running and an empty list because the CLI could
 * not be run must never look the same.
 */
export const startDetection = async (store: SessionStore): Promise<() => void> => {
  const state = { stopped: false, queued: false };

  const sweepOnce = async (): Promise<void> => {
    const { sessions, failure } = await readAgentSessions();

    if (failure !== null) {
      // The last good snapshot stays on screen: a CLI that failed once says nothing about
      // whether those agents are still running, and blanking the panel would be a worse lie.
      void logToApp('error', failure);
      store.setHealth({ failure, degraded: [] });
      return;
    }

    const before = store.getSessions().length;
    store.setSessions(carryStateSince(store.getSessions(), sessions, Date.now()));
    const after = store.getSessions().length;

    // Only on a change, so the log stays a timeline rather than a heartbeat — and so a report
    // of "the panel went empty" can be placed in time.
    if (after !== before) {
      void logToApp('info', `sessions: ${String(before)} -> ${String(after)}`);
    }

    store.setHealth({ failure: null, degraded: [] });
  };

  let chain: Promise<void> = Promise.resolve();

  const sweep = (): void => {
    if (state.queued) return;
    state.queued = true;
    chain = chain.then(async () => {
      state.queued = false;
      if (state.stopped) return;
      try {
        await sweepOnce();
      } catch (error) {
        // A failed sweep leaves the last good snapshot in place; the next one retries.
        const failure = describeDetectionFailure('sweep', error);
        void logToApp('error', failure);
        store.setHealth({ failure, degraded: [] });
      }
    });
  };

  const interval = setInterval(sweep, POLL_INTERVAL_MS);

  void logToApp('info', `detection started (${String(POLL_INTERVAL_MS)}ms interval)`);

  sweep();
  await chain;

  return () => {
    state.stopped = true;
    clearInterval(interval);
  };
};
