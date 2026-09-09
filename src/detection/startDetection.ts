import { BaseDirectory, mkdir, watchImmediate } from '@tauri-apps/plugin-fs';

import { describeDetectionFailure } from '../core/describeDetectionFailure';
import { reconcileSessions } from '../core/reconcileSessions';
import { logDetection } from './logDetection';
import { readHookRecords, SESSIONS_DIR } from './readHookRecords';
import { readSessionTitles } from './readSessionTitles';
import { scanClaudeSessions } from './scanClaudeSessions';
import type { SessionStore } from './createSessionStore';

/** The PRD's ≤2s discovery target with headroom; the hook path handles ≤1s transitions. */
const SCAN_INTERVAL_MS = 5000;

/**
 * Starts the detection pipeline and returns a function that stops it.
 *
 * Two triggers feed one sweep: the FS watcher fires the instant a hook writes a state file
 * (the fast path that meets the ≤1s state-change target), and a 5s interval re-runs the
 * scanner for discovery and liveness. Both funnel through the same reconcile-and-publish step,
 * so there is only ever one code path producing the store's contents.
 *
 * Sweeps are serialized on a promise chain and coalesced to at most one queued behind the one
 * running, so a burst of hook writes cannot pile up a backlog of `ps` calls.
 *
 * Every step here degrades rather than aborts, and records why in the store so the panel can say
 * so (ADR-0011). v0.2.0 did the opposite: the watcher setup was awaited outside the try, so one
 * unavailable Tauri command took down hooks, scanner and interval together — and said nothing.
 */
export const startDetection = async (store: SessionStore): Promise<() => void> => {
  const state = { stopped: false, queued: false, watcherProblem: null as string | null };

  /** Every health update carries the watcher's state: it is set once and stays true all run. */
  const publishHealth = (failure: string | null, degraded: readonly string[]): void => {
    store.setHealth({
      failure,
      degraded: [...degraded, ...(state.watcherProblem === null ? [] : [state.watcherProblem])],
    });
  };

  const sweepOnce = async (): Promise<void> => {
    // Settled, not `all`: the two halves are independent sources (ADR-0003), and one failing
    // must not throw away the other's rows. Partial data beats none as long as it is flagged.
    const [hooks, scan] = await Promise.allSettled([readHookRecords(), scanClaudeSessions()]);

    const problems = [
      ...(hooks.status === 'rejected' ? [describeDetectionFailure('hooks', hooks.reason)] : []),
      ...(scan.status === 'rejected' ? [describeDetectionFailure('scanner', scan.reason)] : []),
    ];
    for (const problem of problems) void logDetection('error', problem);

    if (hooks.status === 'rejected' && scan.status === 'rejected') {
      // Both sources down: the sweep produced nothing, so this is a failure, not a degradation.
      publishHealth(problems.join(' · '), []);
      return;
    }

    const hookRecords = hooks.status === 'fulfilled' ? hooks.value : [];
    const { scanned, livePids } =
      scan.status === 'fulfilled' ? scan.value : { scanned: [], livePids: null };

    const titles = await readSessionTitles([
      ...hookRecords.map(({ sessionId, transcriptPath }) => ({ sessionId, transcriptPath })),
      ...scanned.map(({ sessionId, transcriptPath }) => ({ sessionId, transcriptPath })),
    ]).catch((error: unknown) => {
      // A title is decoration; the row falls back to its project directory without one.
      const problem = describeDetectionFailure('titles', error);
      void logDetection('error', problem);
      problems.push(problem);
      return new Map<string, string>();
    });

    const before = store.getSessions().length;
    store.setSessions(
      reconcileSessions({ hookRecords, scanned, livePids, titles, nowMs: Date.now() }),
    );
    const after = store.getSessions().length;

    // Only on a change, so the log stays a timeline rather than a 5s heartbeat — and so a
    // report of "the panel went empty" can be placed in time.
    if (after !== before) {
      void logDetection('info', `sessions: ${String(before)} -> ${String(after)}`);
    }

    publishHealth(null, problems);
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
        void logDetection('error', failure);
        publishHealth(failure, []);
      }
    });
  };

  // The watcher is an optimisation on top of the interval: without it a state change lands in
  // ≤5s instead of ≤1s. Losing it must therefore cost latency, never detection itself.
  const unwatch = await (async (): Promise<(() => void) | null> => {
    try {
      // The watcher needs the directory to exist; the hook creates it, but not on its first run.
      await mkdir(SESSIONS_DIR, { baseDir: BaseDirectory.Home, recursive: true });
      return await watchImmediate(SESSIONS_DIR, sweep, { baseDir: BaseDirectory.Home });
    } catch (error) {
      state.watcherProblem = describeDetectionFailure('watcher', error);
      void logDetection('error', `${state.watcherProblem} — falling back to the 5s scan only`);
      return null;
    }
  })();

  const interval = setInterval(sweep, SCAN_INTERVAL_MS);

  void logDetection(
    'info',
    `detection started (watcher ${unwatch === null ? 'unavailable' : 'active'}, ${String(SCAN_INTERVAL_MS)}ms interval)`,
  );

  sweep();
  await chain;

  return () => {
    state.stopped = true;
    clearInterval(interval);
    unwatch?.();
  };
};
