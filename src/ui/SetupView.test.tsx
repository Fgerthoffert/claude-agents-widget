import { cleanup, render, screen } from '@testing-library/react';
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
      health={{ failure: null, degraded: [] }}
      buildIdentity="v0.2.1 (abc1234)"
      logPath="/Users/test/Library/Logs/app/claude-agents-widget.log"
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
  it('names the file it will change before offering the button', () => {
    renderView();

    const step = screen.getByText(/Adds 1 entry to/).textContent;
    expect(step).toContain('/Users/test/.claude/settings.json');
    expect(screen.getByRole('button', { name: 'Install hooks' })).toBeEnabled();
  });

  it('keeps the reassurance behind Show the change, where a suspicious user looks', async () => {
    const user = userEvent.setup();
    renderView();

    // Not in the way of the two buttons the step is actually about (ADR-0013)...
    expect(screen.queryByText(/existing hooks are kept/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show the change' }));

    // ...but one press away, together with the exact diff and the event list.
    const detail = screen.getByText(/existing hooks are kept/).textContent;
    expect(detail).toContain('backup');
    expect(detail).toContain('SessionStart');
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

    // A finished step is a receipt, not an instruction: heading and chip, and nothing else.
    expect(screen.queryByRole('button', { name: 'Install hooks' })).not.toBeInTheDocument();
    expect(screen.getByText('Install the Claude Code hooks')).toBeInTheDocument();
    expect(screen.getByText('done')).toBeInTheDocument();
    expect(document.querySelectorAll('.setup__step-body')).toHaveLength(1);
  });

  it('deep-links to each macOS permission pane', async () => {
    const user = userEvent.setup();
    const spies = renderView();

    await user.click(screen.getByRole('button', { name: 'Open Automation' }));
    await user.click(screen.getByRole('button', { name: 'Open Accessibility' }));

    expect(spies.onOpenPane.mock.calls).toEqual([['automation'], ['accessibility']]);
  });

  it('warns that a grant is tied to this app bundle only once a click has been refused', () => {
    // The upgrade trap is worth explaining exactly when it is biting, and not before.
    renderView();
    expect(screen.queryByText(/replacing the app/)).not.toBeInTheDocument();

    cleanup();
    renderView(
      state({
        permissions: {
          status: 'blocked',
          lastFocus: {
            ok: false,
            method: null,
            permissionDenied: true,
            degraded: false,
            detail: 'permission-denied',
          },
        },
      }),
    );

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
            degraded: false,
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

  it('leads with a failing pipeline, because it invalidates every tick below it', () => {
    renderView(state(), {
      health: {
        failure: 'Watching the hook state directory failed: fs.watch not allowed',
        degraded: [],
      },
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Detection is not running');
    expect(alert.textContent).toContain('fs.watch not allowed');
    // The log is where the untruncated error lives, so the view has to name it.
    expect(alert.textContent).toContain('/claude-agents-widget.log');
  });

  it('reports a degraded sweep without crying failure', () => {
    renderView(state(), {
      health: { failure: null, degraded: ['Scanning running Claude Code processes failed: EPERM'] },
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(document.querySelector('.setup__outcome')?.textContent).toContain(
      'Detection is degraded. Scanning running Claude Code processes failed: EPERM',
    );
  });

  it('shows the build identity, which is what a bug report needs', () => {
    renderView();

    expect(screen.getByText('v0.2.1 (abc1234)')).toHaveClass('setup__build');
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
