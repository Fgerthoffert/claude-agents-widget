import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SetupView } from './SetupView';
import type { SetupState } from '../core/evaluateSetupState';

const state = (overrides: Partial<SetupState> = {}): SetupState => ({
  hooks: {
    status: 'todo',
    registeredEvents: [],
    missingEvents: ['SessionStart'],
    scriptInstalled: false,
  },
  permissions: { status: 'unknown', lastFocus: null },
  sessions: { status: 'unknown', total: 0, hookOwned: 0, scannerOnly: 0 },
  needsSetup: true,
  ...overrides,
});

const handlers = () => ({
  onInstall: vi.fn(),
  onOpenPane: vi.fn(),
  onCopyDiagnostics: vi.fn(),
  onClose: vi.fn(),
});

const renderView = (setup = state(), extra: Partial<Parameters<typeof SetupView>[0]> = {}) => {
  const spies = handlers();
  render(
    <SetupView
      setup={setup}
      hookPath="/Users/test/.claude-agents-widget/hook.mjs"
      settingsPath="/Users/test/.claude/settings.json"
      preview={'{\n  "hooks": {}\n}'}
      busy={false}
      outcome={null}
      {...spies}
      {...extra}
    />,
  );
  return spies;
};

describe('SetupView', () => {
  it('names the file it will change and promises the backup before offering the button', () => {
    renderView();

    const step = screen.getByText(/Adds 1 entry to/).textContent ?? '';
    expect(step).toContain('/Users/test/.claude/settings.json');
    expect(step).toContain('existing hooks are kept');
    expect(step).toContain('backup');
    expect(screen.getByRole('button', { name: 'Install hooks' })).toBeEnabled();
  });

  it('calls the installer exactly once per press', async () => {
    const user = userEvent.setup();
    const spies = renderView();

    await user.click(screen.getByRole('button', { name: 'Install hooks' }));

    expect(spies.onInstall).toHaveBeenCalledTimes(1);
  });

  it('shows the exact change only when asked', async () => {
    const user = userEvent.setup();
    renderView();

    expect(screen.queryByText(/"hooks"/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show the change' }));
    expect(screen.getByText(/"hooks"/)).toHaveClass('setup__preview');

    await user.click(screen.getByRole('button', { name: 'Hide the change' }));
    expect(screen.queryByText(/"hooks"/)).not.toBeInTheDocument();
  });

  it('disables the install button while an install is running', () => {
    renderView(state(), { busy: true });

    expect(screen.getByRole('button', { name: 'Installing…' })).toBeDisabled();
  });

  it('reports the outcome of the last attempt', () => {
    renderView(state(), { outcome: 'Installed: 5 event(s) registered.' });

    expect(screen.getByText('Installed: 5 event(s) registered.')).toHaveClass('setup__outcome');
  });

  it('refuses to offer an install when the settings file cannot be parsed', () => {
    renderView(state({ hooks: { ...state().hooks, status: 'blocked' } }));

    expect(screen.queryByRole('button', { name: 'Install hooks' })).not.toBeInTheDocument();
    expect(screen.getByText(/is not valid JSON/)).toBeInTheDocument();
  });

  it('says nothing is left to install once the hooks are in', () => {
    renderView(
      state({
        hooks: {
          status: 'done',
          registeredEvents: ['Stop'],
          missingEvents: [],
          scriptInstalled: true,
        },
      }),
    );

    expect(screen.queryByRole('button', { name: 'Install hooks' })).not.toBeInTheDocument();
    expect(screen.getByText(/All five events call/)).toBeInTheDocument();
  });

  it('deep-links to each macOS permission pane', async () => {
    const user = userEvent.setup();
    const spies = renderView();

    await user.click(screen.getByRole('button', { name: 'Open Automation' }));
    await user.click(screen.getByRole('button', { name: 'Open Accessibility' }));

    expect(spies.onOpenPane.mock.calls).toEqual([['automation'], ['accessibility']]);
  });

  it('warns that a permission grant is tied to this app bundle', () => {
    renderView();

    expect(screen.getByText(/replacing the app/)).toBeInTheDocument();
  });

  it('reports a refused click as a permission problem, naming the reason', () => {
    renderView(
      state({
        permissions: {
          status: 'blocked',
          lastFocus: {
            ok: false,
            method: null,
            permissionDenied: true,
            detail: 'permission-denied',
          },
        },
      }),
    );

    expect(screen.getByText(/macOS refused the last click/)).toBeInTheDocument();
    expect(screen.getByText(/permission-denied/)).toBeInTheDocument();
  });

  it('asks for a restart only when sessions exist without hooks', () => {
    renderView(state({ sessions: { status: 'todo', total: 2, hookOwned: 0, scannerOnly: 2 } }));

    expect(screen.getByText(/found by the process\s+scanner/)).toBeInTheDocument();
  });

  it('says the panel is simply idle when there are no sessions at all', () => {
    renderView();

    expect(screen.getByText(/No agents running right now/)).toBeInTheDocument();
  });

  it('offers the diagnostics dump and a way out', async () => {
    const user = userEvent.setup();
    const spies = renderView();

    await user.click(screen.getByRole('button', { name: 'Copy diagnostics' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(spies.onCopyDiagnostics).toHaveBeenCalledTimes(1);
    expect(spies.onClose).toHaveBeenCalledTimes(1);
  });
});
