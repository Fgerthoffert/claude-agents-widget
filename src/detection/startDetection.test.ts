import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSessionStore } from './createSessionStore';
import type { SessionRecord } from '../core/types';

const mocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  watchImmediate: vi.fn(),
  readHookRecords: vi.fn(),
  scanClaudeSessions: vi.fn(),
  readSessionTitles: vi.fn(),
  logToApp: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { Home: 12 },
  mkdir: mocks.mkdir,
  watchImmediate: mocks.watchImmediate,
}));
vi.mock('./readHookRecords', () => ({
  readHookRecords: mocks.readHookRecords,
  SESSIONS_DIR: '.claude-agents-widget/sessions',
}));
vi.mock('./scanClaudeSessions', () => ({ scanClaudeSessions: mocks.scanClaudeSessions }));
vi.mock('./readSessionTitles', () => ({ readSessionTitles: mocks.readSessionTitles }));
vi.mock('./logToApp', () => ({ logToApp: mocks.logToApp }));

const { startDetection } = await import('./startDetection');

const record = (sessionId: string): SessionRecord => ({
  sessionId,
  cwd: '/Users/test/code/api',
  transcriptPath: null,
  state: 'working',
  lastEvent: 'UserPromptSubmit',
  notificationType: null,
  notificationMessage: null,
  endReason: null,
  agentId: null,
  agentType: null,
  updatedAt: new Date().toISOString(),
  hookPid: 2,
  claudePid: 1,
  ancestors: [],
});

const logged = (): string => mocks.logToApp.mock.calls.map((call) => String(call[1])).join('\n');

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.mkdir.mockResolvedValue(undefined);
  mocks.watchImmediate.mockResolvedValue(() => undefined);
  mocks.readHookRecords.mockResolvedValue([record('a')]);
  mocks.scanClaudeSessions.mockResolvedValue({ scanned: [], livePids: [1] });
  mocks.readSessionTitles.mockResolvedValue(new Map());
  mocks.logToApp.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('startDetection', () => {
  it('publishes sessions and a healthy pipeline on the first sweep', async () => {
    const store = createSessionStore();

    const stop = await startDetection(store);

    expect(store.getSessions()).toHaveLength(1);
    expect(store.getHealth()).toEqual({ failure: null, degraded: [] });
    stop();
  });

  // The v0.2.0 defect: `watchImmediate` rejected because the fs plugin's `watch` feature was
  // off, the rejection was awaited outside the try, and hooks + scanner + interval all died.
  it('still detects sessions when the watcher cannot be created', async () => {
    mocks.watchImmediate.mockRejectedValue('Command plugin:fs|watch not found');
    const store = createSessionStore();

    const stop = await startDetection(store);

    expect(store.getSessions()).toHaveLength(1);
    expect(store.getHealth().failure).toBeNull();
    expect(store.getHealth().degraded).toEqual([
      'Watching the hook state directory failed: Command plugin:fs|watch not found',
    ]);
    expect(logged()).toContain('Command plugin:fs|watch not found');
    stop();
  });

  it('keeps polling when the state directory cannot be created', async () => {
    mocks.mkdir.mockRejectedValue(new Error('EACCES'));
    const store = createSessionStore();

    const stop = await startDetection(store);

    expect(store.getSessions()).toHaveLength(1);
    expect(mocks.watchImmediate).not.toHaveBeenCalled();
    stop();
  });

  // Both sources were awaited in one `Promise.all`, so a `ps` failure discarded good hook data.
  it('keeps the hook records when the process scanner fails', async () => {
    mocks.scanClaudeSessions.mockRejectedValue(new Error('EPERM'));
    const store = createSessionStore();

    const stop = await startDetection(store);

    expect(store.getSessions()).toHaveLength(1);
    expect(store.getHealth().failure).toBeNull();
    expect(store.getHealth().degraded).toEqual([
      'Scanning running Claude Code processes failed: EPERM',
    ]);
    stop();
  });

  it('reports a failure only when both sources are down', async () => {
    mocks.readHookRecords.mockRejectedValue(new Error('EIO'));
    mocks.scanClaudeSessions.mockRejectedValue(new Error('EPERM'));
    const store = createSessionStore();

    const stop = await startDetection(store);

    expect(store.getSessions()).toEqual([]);
    expect(store.getHealth().failure).toBe(
      'Reading the hook state files failed: EIO · Scanning running Claude Code processes failed: EPERM',
    );
    stop();
  });

  it('treats a lost title as decoration, not as a failure', async () => {
    mocks.readSessionTitles.mockRejectedValue(new Error('ENOENT'));
    const store = createSessionStore();

    const stop = await startDetection(store);

    expect(store.getSessions()).toHaveLength(1);
    expect(store.getHealth().failure).toBeNull();
    expect(store.getHealth().degraded).toEqual(['Reading session transcripts failed: ENOENT']);
    stop();
  });

  it('recovers on a later sweep, clearing the failure it reported', async () => {
    mocks.readHookRecords.mockRejectedValueOnce(new Error('EIO'));
    mocks.scanClaudeSessions.mockRejectedValueOnce(new Error('EPERM'));
    const store = createSessionStore();

    const stop = await startDetection(store);
    expect(store.getHealth().failure).not.toBeNull();

    // The watcher callback is the fast path; firing it is what a hook write does.
    const onEvent = mocks.watchImmediate.mock.calls[0]?.[1] as () => void;
    onEvent();
    await vi.waitFor(() => {
      expect(store.getHealth().failure).toBeNull();
    });
    expect(store.getSessions()).toHaveLength(1);
    stop();
  });
});
