import { carryStateSince } from '../core/carryStateSince';
import { describeDetectionFailure } from '../core/describeDetectionFailure';
import { logToApp } from './logToApp';
import { readAgentSessions } from './readAgentSessions';
import { watchClaudeProjects } from './watchClaudeProjects';
import type { SessionStore } from './createSessionStore';

/**
 * The safety net, not the mechanism.
 *
 * Asking costs ~330ms of CPU, so a short interval is expensive: at 1s it is a third of a core,
 * forever. The watcher below is what makes the panel feel immediate, and this is what covers the
 * cases it cannot see — a session's process being killed writes nothing to a transcript — and
 * the case where the watcher could not be set up at all (ADR-0020).
 */
const HEARTBEAT_MS = 5000;

/**
 * How long to wait after the last write before asking.
 *
 * Trailing, so a burst of writes becomes one sweep at the end of the burst — and the end of a
 * burst is exactly the moment worth being fast about: a turn finished, or a session cleared.
 */
const SETTLE_MS = 300;

/**
 * The longest a sweep will be deferred, however long the writes keep coming.
 *
 * A pure trailing debounce would be wrong here, and interestingly wrong: with several agents
 * running, something is always appending to something, so the timer would keep resetting and the
 * watcher would never fire at all — leaving the panel *slower* than the fixed interval it
 * replaced. This is the ceiling that stops that (ADR-0020).
 */
const MAX_DEFER_MS = 1500;

/**
 * Starts the detection pipeline and returns a function that stops it.
 *
 * One source, one sweep: `claude agents --json`, parsed, stamped with how long each state has
 * held, published. There used to be two sources feeding a reconciler — a hook script pushing
 * events and a `ps`/`lsof`/transcript scanner inferring the rest — and both existed to work out
 * things Claude Code now states directly (ADR-0018).
 *
 * Two triggers, one sweep. A watcher on `~/.claude/projects` fires when Claude Code writes
 * anything, and a trailing debounce turns a burst of writes into a single sweep once the burst
 * ends — which is exactly when a session has just stopped doing something. A slow heartbeat
 * covers what the watcher cannot see. The watcher supplies *timing only*; it reads nothing
 * (ADR-0020).
 *
 * Sweeps are serialized on a promise chain and coalesced to at most one queued behind the one
 * running, so a slow answer cannot pile up a backlog of processes.
 *
 * Every step degrades rather than aborts, and records why in the store so the panel can say so
 * (ADR-0011): an empty list because nothing is running and an empty list because the CLI could
 * not be run must never look the same.
 */
export const startDetection = async (store: SessionStore): Promise<() => void> => {
  const state = { stopped: false, queued: false, watcherProblem: null as string | null };

  /**
   * Every health update carries the watcher's state, because it is set once and stays true for
   * the whole run — and a sweep that succeeds must not erase the reason the panel feels slow.
   */
  const publishHealth = (failure: string | null): void => {
    store.setHealth({
      failure,
      degraded: state.watcherProblem === null ? [] : [state.watcherProblem],
    });
  };

  const sweepOnce = async (): Promise<void> => {
    const { sessions, failure } = await readAgentSessions();

    if (failure !== null) {
      // The last good snapshot stays on screen: a CLI that failed once says nothing about
      // whether those agents are still running, and blanking the panel would be a worse lie.
      void logToApp('error', failure);
      publishHealth(failure);
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

    publishHealth(null);
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
        publishHealth(failure);
      }
    });
  };

  let settle: ReturnType<typeof setTimeout> | null = null;
  let deferringSince: number | null = null;

  /**
   * Coalesces a burst of writes into one sweep — at the end of the burst, or after
   * `MAX_DEFER_MS`, whichever comes first.
   */
  const sweepWhenQuiet = (): void => {
    const now = Date.now();
    deferringSince ??= now;

    const remaining = MAX_DEFER_MS - (now - deferringSince);
    const wait = Math.max(0, Math.min(SETTLE_MS, remaining));

    if (settle !== null) clearTimeout(settle);
    settle = setTimeout(() => {
      settle = null;
      deferringSince = null;
      sweep();
    }, wait);
  };

  const unwatch = await watchClaudeProjects(sweepWhenQuiet);
  const interval = setInterval(sweep, HEARTBEAT_MS);

  void logToApp(
    'info',
    `detection started (watcher ${unwatch === null ? 'unavailable' : 'active'}, ${String(HEARTBEAT_MS)}ms heartbeat)`,
  );
  if (unwatch === null) {
    // Losing the watcher costs latency, never detection — but the panel feeling slow is a
    // symptom worth being able to explain from a log (ADR-0011). Set before the first sweep, so
    // it is carried by every health update from here on.
    state.watcherProblem = 'Could not watch ~/.claude/projects — updates may lag by a few seconds.';
    void logToApp('error', state.watcherProblem);
  }

  sweep();
  await chain;

  return () => {
    state.stopped = true;
    if (settle !== null) clearTimeout(settle);
    clearInterval(interval);
    unwatch?.();
  };
};
