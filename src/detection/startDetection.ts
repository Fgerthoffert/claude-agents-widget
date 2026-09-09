import { BaseDirectory, mkdir, watchImmediate } from '@tauri-apps/plugin-fs';

import { reconcileSessions } from '../core/reconcileSessions';
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
 */
export const startDetection = async (store: SessionStore): Promise<() => void> => {
  const state = { stopped: false, queued: false };

  const sweepOnce = async (): Promise<void> => {
    const [hookRecords, { scanned, livePids }] = await Promise.all([
      readHookRecords(),
      scanClaudeSessions(),
    ]);

    const titles = await readSessionTitles([
      ...hookRecords.map(({ sessionId, transcriptPath }) => ({ sessionId, transcriptPath })),
      ...scanned.map(({ sessionId, transcriptPath }) => ({ sessionId, transcriptPath })),
    ]);

    store.setSessions(
      reconcileSessions({ hookRecords, scanned, livePids, titles, nowMs: Date.now() }),
    );
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
        console.error('detection sweep failed', error);
      }
    });
  };

  // The watcher needs the directory to exist; the hook creates it, but not before its first run.
  await mkdir(SESSIONS_DIR, { baseDir: BaseDirectory.Home, recursive: true });

  const unwatch = await watchImmediate(SESSIONS_DIR, sweep, { baseDir: BaseDirectory.Home });
  const interval = setInterval(sweep, SCAN_INTERVAL_MS);

  sweep();
  await chain;

  return () => {
    state.stopped = true;
    clearInterval(interval);
    unwatch();
  };
};
