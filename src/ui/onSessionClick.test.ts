import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FocusResult } from '../core/focus/types';
import type { Session } from '../core/types';

const mocks = vi.hoisted(() => ({ focusSession: vi.fn() }));
vi.mock('../detection/focusSession', () => ({ focusSession: mocks.focusSession }));

const { onSessionClick } = await import('./onSessionClick');

const session: Session = {
  sessionId: 'session-1',
  title: 'Refactor the scanner',
  cwd: '/Users/test/code/api',
  transcriptPath: null,
  state: 'working',
  source: 'hook',
  notificationType: null,
  notificationMessage: null,
  updatedAt: '2026-09-09T12:00:00.000Z',
  claudePid: 1234,
  ancestors: [],
};

const resolves = (result: FocusResult): void => {
  mocks.focusSession.mockResolvedValue(result);
};

afterEach(() => {
  vi.restoreAllMocks();
  mocks.focusSession.mockReset();
});

describe('onSessionClick', () => {
  it('reports the precision the focus engine achieved', async () => {
    resolves({ ok: true, host: 'vscode', method: 'window', degradedFrom: null, detail: null });

    await expect(onSessionClick(session)).resolves.toEqual({
      ok: true,
      method: 'window',
      permissionDenied: false,
      degraded: false,
      detail: 'window',
    });
    expect(mocks.focusSession).toHaveBeenCalledWith(session);
  });

  it('keeps a refused precise attempt visible even when the fallback worked', async () => {
    resolves({
      ok: true,
      host: 'warp',
      method: 'app',
      degradedFrom: 'permission-denied',
      detail: null,
    });

    await expect(onSessionClick(session)).resolves.toEqual({
      ok: true,
      method: 'app',
      permissionDenied: true,
      // A fallback got there, so this proves nothing about the Accessibility grant.
      degraded: true,
      detail: 'app',
    });
  });

  it('surfaces the typed failure reason so a click is never silent', async () => {
    resolves({ ok: false, host: 'unknown', reason: 'no-host', detail: null });

    await expect(onSessionClick(session)).resolves.toEqual({
      ok: false,
      method: null,
      permissionDenied: false,
      degraded: false,
      detail: 'no-host',
    });
  });

  it('marks window precision reached by a fallback as degraded, not as proof', async () => {
    resolves({
      ok: true,
      host: 'vscode',
      method: 'window',
      degradedFrom: 'window-not-found',
      detail: null,
    });

    await expect(onSessionClick(session)).resolves.toMatchObject({
      ok: true,
      method: 'window',
      degraded: true,
    });
  });

  it('flags a refused click as a permission problem', async () => {
    resolves({ ok: false, host: 'vscode', reason: 'permission-denied', detail: null });

    await expect(onSessionClick(session)).resolves.toMatchObject({
      ok: false,
      permissionDenied: true,
      detail: 'permission-denied',
    });
  });

  it('does not let an unexpected rejection escape into the click handler', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.focusSession.mockRejectedValue(new Error('boom'));

    await expect(onSessionClick(session)).resolves.toEqual({
      ok: false,
      method: null,
      permissionDenied: false,
      degraded: false,
      detail: 'focus_engine_error',
    });
    expect(error).toHaveBeenCalledOnce();
  });
});
