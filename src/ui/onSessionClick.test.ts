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

    await expect(onSessionClick(session)).resolves.toEqual({ ok: true, detail: 'window' });
    expect(mocks.focusSession).toHaveBeenCalledWith(session);
  });

  it('reports an app-level landing as such, rather than as a plain success', async () => {
    resolves({
      ok: true,
      host: 'warp',
      method: 'app',
      degradedFrom: 'permission-denied',
      detail: null,
    });

    await expect(onSessionClick(session)).resolves.toEqual({ ok: true, detail: 'app' });
  });

  it('surfaces the typed failure reason so a click is never silent', async () => {
    resolves({ ok: false, host: 'unknown', reason: 'no-host', detail: null });

    await expect(onSessionClick(session)).resolves.toEqual({ ok: false, detail: 'no-host' });
  });

  it('does not let an unexpected rejection escape into the click handler', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.focusSession.mockRejectedValue(new Error('boom'));

    await expect(onSessionClick(session)).resolves.toEqual({
      ok: false,
      detail: 'focus_engine_error',
    });
    expect(error).toHaveBeenCalledOnce();
  });
});
