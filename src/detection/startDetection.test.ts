import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSessionStore } from './createSessionStore';
import type { SessionSnapshot } from '../core/types';

const mocks = vi.hoisted(() => ({
  readAgentSessions: vi.fn(),
  logToApp: vi.fn(),
  watchClaudeProjects: vi.fn(),
  /** Set by the fake watcher, so a test can ring the doorbell. */
  ring: { current: null as (() => void) | null },
}));

vi.mock('./readAgentSessions', () => ({ readAgentSessions: mocks.readAgentSessions }));
vi.mock('./logToApp', () => ({ logToApp: mocks.logToApp }));
vi.mock('./watchClaudeProjects', () => ({
  watchClaudeProjects: mocks.watchClaudeProjects,
}));

const { startDetection } = await import('./startDetection');

const snapshot = (
  sessionId: string,
  overrides: Partial<SessionSnapshot> = {},
): SessionSnapshot => ({
  sessionId,
  title: sessionId,
  cwd: '/Users/test/code/api',
  state: 'working',
  kind: 'interactive',
  waitingFor: null,
  claudePid: 1,
  startedAtMs: 1,
  ...overrides,
});

const answers = (sessions: readonly SessionSnapshot[], failure: string | null = null): void => {
  mocks.readAgentSessions.mockResolvedValue({ sessions, failure });
};

const logged = (): string => mocks.logToApp.mock.calls.map((call) => String(call[1])).join('\n');

beforeEach(() => {
  // `ring` is a plain ref, not a mock — the doorbell handle the fake watcher hands back.
  for (const mock of Object.values(mocks)) {
    if ('mockReset' in mock) mock.mockReset();
  }
  mocks.logToApp.mockResolvedValue(undefined);
  mocks.ring.current = null;
  mocks.watchClaudeProjects.mockImplementation((onChange: () => void) => {
    mocks.ring.current = onChange;
    return Promise.resolve(() => undefined);
  });
  answers([snapshot('a')]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('startDetection', () => {
  it('publishes what Claude Code reported, on the first sweep', async () => {
    const store = createSessionStore();
    const stop = await startDetection(store);

    expect(store.getSessions().map((session) => session.sessionId)).toEqual(['a']);
    expect(store.getHealth()).toEqual({ failure: null, degraded: [] });
    stop();
  });

  it('stamps every session with when its state began', async () => {
    const store = createSessionStore();
    const stop = await startDetection(store);

    expect(store.getSessions()[0]?.stateSince).toBeGreaterThan(0);
    stop();
  });

  it('re-asks on a heartbeat, as a safety net', async () => {
    vi.useFakeTimers();
    const store = createSessionStore();
    const stop = await startDetection(store);
    expect(mocks.readAgentSessions).toHaveBeenCalledTimes(1);

    answers([snapshot('a'), snapshot('b')]);
    await vi.advanceTimersByTimeAsync(5000);

    expect(mocks.readAgentSessions).toHaveBeenCalledTimes(2);
    expect(store.getSessions()).toHaveLength(2);
    stop();
  });

  it('asks as soon as the writes stop, not on the next heartbeat', async () => {
    // The point of the whole exercise: a session that has just gone quiet — a finished turn, a
    // `/clear` — shows up in well under a second (ADR-0020).
    vi.useFakeTimers();
    const store = createSessionStore();
    const stop = await startDetection(store);
    answers([snapshot('a'), snapshot('b')]);

    mocks.ring.current?.();
    await vi.advanceTimersByTimeAsync(300);

    expect(mocks.readAgentSessions).toHaveBeenCalledTimes(2);
    expect(store.getSessions()).toHaveLength(2);
    stop();
  });

  it('still asks even while the writes keep coming', async () => {
    // The trap a pure trailing debounce would fall into: with several agents running, something
    // is always appending, the timer keeps resetting and the watcher never fires — leaving the
    // panel slower than the fixed interval it replaced. MAX_DEFER_MS is the ceiling (ADR-0020).
    vi.useFakeTimers();
    const store = createSessionStore();
    const stop = await startDetection(store);

    for (let write = 0; write < 12; write += 1) {
      mocks.ring.current?.();
      await vi.advanceTimersByTimeAsync(200);
    }

    // 2.4s of unbroken writing: deferred, but not indefinitely, and not once per write either.
    const asks = mocks.readAgentSessions.mock.calls.length;
    expect(asks).toBeGreaterThan(1);
    expect(asks).toBeLessThan(6);
    stop();
  });

  it('coalesces a burst of writes into one ask', async () => {
    vi.useFakeTimers();
    const store = createSessionStore();
    const stop = await startDetection(store);

    for (let write = 0; write < 5; write += 1) mocks.ring.current?.();
    await vi.advanceTimersByTimeAsync(300);

    expect(mocks.readAgentSessions).toHaveBeenCalledTimes(2);
    stop();
  });

  it('says so when the watcher could not be set up, rather than just feeling slow', async () => {
    mocks.watchClaudeProjects.mockResolvedValue(null);
    const store = createSessionStore();
    const stop = await startDetection(store);

    expect(store.getHealth().degraded.join(' ')).toContain('watch');
    expect(store.getHealth().failure).toBeNull();
    stop();
  });

  it('stops watching when stopped', async () => {
    const unwatch = vi.fn();
    mocks.watchClaudeProjects.mockResolvedValue(unwatch);
    const stop = await startDetection(createSessionStore());

    stop();

    expect(unwatch).toHaveBeenCalledOnce();
  });

  it('reports a failed ask instead of emptying the panel', async () => {
    // A CLI that failed once says nothing about whether those agents are still running, and
    // blanking the list would be a worse lie than showing it stale (ADR-0011).
    vi.useFakeTimers();
    const store = createSessionStore();
    const stop = await startDetection(store);

    answers([], '`claude agents --json` failed (not found).');
    await vi.advanceTimersByTimeAsync(5000);

    expect(store.getSessions()).toHaveLength(1);
    expect(store.getHealth().failure).toContain('claude agents --json');
    expect(logged()).toContain('claude agents --json');
    stop();
  });

  it('recovers when the next ask works', async () => {
    vi.useFakeTimers();
    const store = createSessionStore();
    const stop = await startDetection(store);

    answers([], 'boom');
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.getHealth().failure).toBe('boom');

    answers([snapshot('a')]);
    await vi.advanceTimersByTimeAsync(5000);

    expect(store.getHealth().failure).toBeNull();
    stop();
  });

  it('accepts an empty list as a real answer', async () => {
    answers([]);
    const store = createSessionStore();
    const stop = await startDetection(store);

    expect(store.getSessions()).toEqual([]);
    expect(store.getHealth().failure).toBeNull();
    stop();
  });

  it('logs only when the count changes, so the log stays a timeline', async () => {
    vi.useFakeTimers();
    const store = createSessionStore();
    const stop = await startDetection(store);

    await vi.advanceTimersByTimeAsync(15_000);

    expect(logged().match(/sessions: /g)).toHaveLength(1);
    stop();
  });

  it('survives a thrown sweep and keeps going', async () => {
    vi.useFakeTimers();
    const store = createSessionStore();
    const stop = await startDetection(store);

    mocks.readAgentSessions.mockRejectedValue(new Error('exploded'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.getHealth().failure).toContain('exploded');

    answers([snapshot('a')]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.getHealth().failure).toBeNull();
    stop();
  });

  it('stops asking once stopped', async () => {
    vi.useFakeTimers();
    const store = createSessionStore();
    const stop = await startDetection(store);
    stop();

    await vi.advanceTimersByTimeAsync(30_000);

    expect(mocks.readAgentSessions).toHaveBeenCalledTimes(1);
  });
});
