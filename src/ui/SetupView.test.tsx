import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SetupView } from './SetupView';
import type { SetupState } from '../core/evaluateSetupState';
import type { DetectionHealth } from '../core/types';

const state = (overrides: Partial<SetupState> = {}): SetupState => ({
  permissions: { status: 'unknown', lastFocus: null },
  sessions: { total: 3, background: 0 },
  ...overrides,
});

const handlers = () => ({
  onOpenPane: vi.fn(),
  onCopyDiagnostics: vi.fn(),
  onClose: vi.fn(),
  onAutoHeightChange: vi.fn(),
});

const renderView = (
  setup = state(),
  extra: Partial<Parameters<typeof SetupView>[0]> = {},
  health: DetectionHealth = { failure: null, degraded: [] },
) => {
  const spies = handlers();
  render(
    <SetupView
      setup={setup}
      health={health}
      buildIdentity="v0.8.0 (abc1234)"
      logPath="/Users/test/Library/Logs/app/claude-agents-widget.log"
      autoHeight
      {...spies}
      {...extra}
    />,
  );
  return spies;
};

describe('SetupView', () => {
  it('has one step, because there is nothing left to install', () => {
    renderView();

    expect(screen.getByText('Let macOS raise windows')).toBeInTheDocument();
    expect(screen.queryByText(/Install the Claude Code hooks/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install hooks' })).not.toBeInTheDocument();
    expect(document.querySelectorAll('.setup__step')).toHaveLength(1);
  });

  it('deep-links to each macOS permission pane', async () => {
    const user = userEvent.setup();
    const spies = renderView();

    await user.click(screen.getByRole('button', { name: 'Open Accessibility' }));
    await user.click(screen.getByRole('button', { name: 'Open Automation' }));

    expect(spies.onOpenPane.mock.calls).toEqual([['accessibility'], ['automation']]);
  });

  it('collapses the step to a heading once a click has proved the grant', () => {
    renderView(
      state({
        permissions: {
          status: 'done',
          lastFocus: {
            ok: true,
            method: 'window',
            permissionDenied: false,
            degraded: false,
            detail: 'window',
          },
        },
      }),
    );

    expect(screen.getByText('done')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Accessibility' })).not.toBeInTheDocument();
    expect(document.querySelectorAll('.setup__step-body')).toHaveLength(0);
  });

  it('reports a refused click, and only then explains the bundle trap', () => {
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

    expect(screen.getByText(/macOS refused the last click/)).toBeInTheDocument();
    expect(screen.getByText(/permission-denied/)).toBeInTheDocument();
    expect(screen.getByText(/replacing the app/)).toBeInTheDocument();
  });

  it('counts what Claude Code reported, and names the background ones', () => {
    renderView(state({ sessions: { total: 4, background: 2 } }));

    expect(
      screen.getByText(/4 sessions reported by Claude Code, 2 in the background/),
    ).toBeInTheDocument();
  });

  it('says the machine is quiet rather than printing a zero', () => {
    renderView(state({ sessions: { total: 0, background: 0 } }));

    expect(screen.getByText('No agents running right now.')).toBeInTheDocument();
  });

  it('leads with a failing pipeline, because it invalidates everything below it', () => {
    renderView(state(), {}, { failure: 'claude agents --json failed', degraded: [] });

    expect(screen.getByRole('alert')).toHaveTextContent(/Detection is not running/);
  });

  it('reports a degraded sweep without crying failure', () => {
    renderView(state(), {}, { failure: null, degraded: ['something was reduced'] });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/Detection is degraded/)).toBeInTheDocument();
  });

  it('offers the auto-height preference, and says what turning it off gets you', async () => {
    const user = userEvent.setup();
    const spies = renderView();
    const toggle = screen.getByRole('checkbox', { name: /Fit the height to the agents/ });

    expect(toggle).toBeChecked();
    expect(screen.getByText(/grows and shrinks with the list/)).toBeInTheDocument();

    await user.click(toggle);

    expect(spies.onAutoHeightChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('explains how to resize once auto-height is off', () => {
    renderView(state(), { autoHeight: false });

    expect(screen.getByRole('checkbox', { name: /Fit the height/ })).not.toBeChecked();
    expect(screen.getByText(/Drag its bottom edge/)).toBeInTheDocument();
  });

  it('shows the build identity, which is what a bug report needs', () => {
    renderView();

    expect(screen.getByText('v0.8.0 (abc1234)')).toBeInTheDocument();
  });

  it('offers the diagnostics dump and a way out', async () => {
    const user = userEvent.setup();
    const spies = renderView();

    await user.click(screen.getByRole('button', { name: 'Copy diagnostics' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(spies.onCopyDiagnostics).toHaveBeenCalledOnce();
    expect(spies.onClose).toHaveBeenCalledOnce();
  });
});
