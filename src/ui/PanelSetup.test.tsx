import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SetupController } from './useSetupState';
import type { Session } from '../core/types';

const mocks = vi.hoisted(() => ({
  sessions: { current: [] as Session[] },
  controller: { current: null as SetupController | null },
  install: vi.fn(),
  openSystemSettings: vi.fn(),
}));

vi.mock('./useSessions', () => ({
  useSessions: () => ({
    sessions: mocks.sessions.current,
    health: { failure: null, degraded: [] },
  }),
}));
vi.mock('./useSetupState', () => ({ useSetupState: () => mocks.controller.current }));
vi.mock('../detection/openSystemSettings', () => ({
  openSystemSettings: mocks.openSystemSettings,
}));

const { Panel } = await import('./Panel');

const controller = (overrides: Partial<SetupController> = {}): SetupController => ({
  setup: {
    hooks: {
      status: 'todo',
      registeredEvents: [],
      missingEvents: ['Stop'],
      scriptInstalled: false,
    },
    permissions: { status: 'unknown', lastFocus: null },
    sessions: { status: 'unknown', total: 0, hookOwned: 0, scannerOnly: 0 },
    needsSetup: true,
  },
  ready: true,
  hookPath: '/Users/test/.claude-agents-widget/hook.mjs',
  settingsPath: '/Users/test/.claude/settings.json',
  preview: '{}',
  busy: false,
  outcome: null,
  install: mocks.install,
  ...overrides,
});

const renderPanel = (setup: SetupController, sessions: readonly Session[] = []): void => {
  mocks.controller.current = setup;
  mocks.sessions.current = [...sessions];
  render(<Panel />);
};

const session: Session = {
  sessionId: 'a',
  title: 'Busy',
  cwd: '/Users/test/code/api',
  transcriptPath: null,
  state: 'working',
  source: 'hook',
  notificationType: null,
  notificationMessage: null,
  updatedAt: new Date().toISOString(),
  claudePid: 1,
  ancestors: [],
};

beforeEach(() => {
  mocks.install.mockReset();
  mocks.openSystemSettings.mockReset();
  mocks.openSystemSettings.mockResolvedValue(true);
});

afterEach(cleanup);

describe('Panel setup view', () => {
  it('opens on setup by itself when the hooks are not installed', () => {
    renderPanel(controller(), [session]);

    expect(screen.getByRole('region', { name: 'Setup and diagnostics' })).toBeInTheDocument();
    // The setup view replaces the list rather than sitting above it.
    expect(document.querySelectorAll('.row')).toHaveLength(0);
  });

  it('waits for the real probe before deciding: the placeholder must not flash it up', () => {
    renderPanel(controller({ ready: false }), [session]);

    expect(screen.queryByRole('region', { name: 'Setup and diagnostics' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('shows the session list once setup is done', () => {
    renderPanel(
      controller({
        setup: {
          hooks: {
            status: 'done',
            registeredEvents: ['Stop'],
            missingEvents: [],
            scriptInstalled: true,
          },
          permissions: { status: 'unknown', lastFocus: null },
          sessions: { status: 'done', total: 1, hookOwned: 1, scannerOnly: 0 },
          needsSetup: false,
        },
      }),
      [session],
    );

    expect(screen.queryByRole('region', { name: 'Setup and diagnostics' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('goes back to the sessions on Done, and stays there', async () => {
    const user = userEvent.setup();
    renderPanel(controller(), [session]);

    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.queryByRole('region', { name: 'Setup and diagnostics' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('installs the hooks on request, exactly once', async () => {
    const user = userEvent.setup();
    renderPanel(controller(), [session]);

    await user.click(screen.getByRole('button', { name: 'Install hooks' }));

    expect(mocks.install).toHaveBeenCalledTimes(1);
  });

  it('opens the System Settings pane the user asked for', async () => {
    const user = userEvent.setup();
    renderPanel(controller(), [session]);

    await user.click(screen.getByRole('button', { name: 'Open Accessibility' }));

    expect(mocks.openSystemSettings).toHaveBeenCalledWith('accessibility');
  });
});
