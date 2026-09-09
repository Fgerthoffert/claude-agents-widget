import { afterEach, describe, expect, it, vi } from 'vitest';

import { onSessionClick } from './onSessionClick';
import type { Session } from '../core/types';

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('onSessionClick', () => {
  it('reports that the focus engine is not wired up yet, without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(onSessionClick(session)).resolves.toEqual({
      ok: false,
      detail: 'focus_engine_missing',
    });
    expect(warn).toHaveBeenCalledOnce();
  });
});
