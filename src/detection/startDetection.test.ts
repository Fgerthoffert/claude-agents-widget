import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSessionStore } from './createSessionStore';
import type { SessionSnapshot } from '../core/types';

const mocks = vi.hoisted(() => ({
  readAgentSessions: vi.fn(),
  logToApp: vi.fn(),
}));

vi.mock('./readAgentSessions', () => ({ readAgentSessions: mocks.readAgentSessions }));
vi.mock('./logToApp', () => ({ logToApp: mocks.logToApp }));

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
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.logToApp.mockResolvedValue(undefined);
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

  it('re-asks on an interval', async () => {
    vi.useFakeTimers();
    const store = createSessionStore();
    const stop = await startDetection(store);
    expect(mocks.readAgentSessions).toHaveBeenCalledTimes(1);

    answers([snapshot('a'), snapshot('b')]);
    await vi.advanceTimersByTimeAsync(3000);

    expect(mocks.readAgentSessions).toHaveBeenCalledTimes(2);
    expect(store.getSessions()).toHaveLength(2);
    stop();
  });

  it('reports a failed ask instead of emptying the panel', async () => {
    // A CLI that failed once says nothing about whether those agents are still running, and
    // blanking the list would be a worse lie than showing it stale (ADR-0011).
    vi.useFakeTimers();
    const store = createSessionStore();
    const stop = await startDetection(store);

    answers([], '`claude agents --json` failed (not found).');
    await vi.advanceTimersByTimeAsync(3000);

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
    await vi.advanceTimersByTimeAsync(3000);
    expect(store.getHealth().failure).toBe('boom');

    answers([snapshot('a')]);
    await vi.advanceTimersByTimeAsync(3000);

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

    await vi.advanceTimersByTimeAsync(9000);

    expect(logged().match(/sessions: /g)).toHaveLength(1);
    stop();
  });

  it('survives a thrown sweep and keeps going', async () => {
    vi.useFakeTimers();
    const store = createSessionStore();
    const stop = await startDetection(store);

    mocks.readAgentSessions.mockRejectedValue(new Error('exploded'));
    await vi.advanceTimersByTimeAsync(3000);
    expect(store.getHealth().failure).toContain('exploded');

    answers([snapshot('a')]);
    await vi.advanceTimersByTimeAsync(3000);
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
