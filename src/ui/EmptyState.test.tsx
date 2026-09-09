import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EmptyState } from './EmptyState';

const renderEmpty = (props: Partial<Parameters<typeof EmptyState>[0]> = {}) => {
  const spies = { onInstall: vi.fn(), onOpenSetup: vi.fn() };
  render(
    <EmptyState
      hooksInstalled={false}
      failure={null}
      busy={false}
      outcome={null}
      {...spies}
      {...props}
    />,
  );
  return spies;
};

describe('EmptyState', () => {
  it('treats an empty panel as a missing install and offers the fix as one button', async () => {
    const user = userEvent.setup();
    const spies = renderEmpty();

    expect(screen.getByText('No Claude Code sessions detected')).toBeInTheDocument();
    // The old copy named `npm run install-hooks`, which a packaged app's user cannot run.
    expect(screen.queryByText(/npm run/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Install hook' }));
    expect(spies.onInstall).toHaveBeenCalledTimes(1);
  });

  it('says what the install will touch before the user presses it', () => {
    renderEmpty();

    const hint = screen.getByText(/hooks are not installed yet/).textContent;
    expect(hint).toContain('~/.claude/settings.json');
    expect(hint).toContain('keeps your existing hooks');
    expect(hint).toContain('backs the file up');
  });

  it('stops nagging once the hooks are in and says the panel is just idle', () => {
    renderEmpty({ hooksInstalled: true });

    expect(screen.getByText('No agents running right now')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install hook' })).not.toBeInTheDocument();
  });

  // The v0.2.0 bug: detection was dead and the panel called it an idle afternoon.
  it('never calls a broken pipeline an idle one', () => {
    renderEmpty({
      hooksInstalled: true,
      failure: 'Watching the hook state directory failed: fs.watch not allowed',
    });

    expect(screen.queryByText('No agents running right now')).not.toBeInTheDocument();
    expect(screen.getByText('Detection is not running')).toBeInTheDocument();
    expect(
      screen.getByText('Watching the hook state directory failed: fs.watch not allowed'),
    ).toBeInTheDocument();
    expect(screen.getByText(/bug in the widget/).textContent).toContain('log file path');
  });

  it('does not offer an install as the fix for a failing sweep', () => {
    renderEmpty({ hooksInstalled: false, failure: 'The detection sweep failed: boom' });

    expect(screen.queryByRole('button', { name: 'Install hook' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Setup & diagnostics' })).toBeInTheDocument();
  });

  it('reports the outcome of an attempt in place', () => {
    renderEmpty({ outcome: 'Installed: 5 event(s) registered.' });

    expect(screen.getByText('Installed: 5 event(s) registered.')).toBeInTheDocument();
  });

  it('disables the button while installing', () => {
    renderEmpty({ busy: true });

    expect(screen.getByRole('button', { name: 'Installing…' })).toBeDisabled();
  });

  it('always offers the full setup view as the other way in', async () => {
    const user = userEvent.setup();
    const spies = renderEmpty({ hooksInstalled: true });

    await user.click(screen.getByRole('button', { name: 'Setup & diagnostics' }));
    expect(spies.onOpenSetup).toHaveBeenCalledTimes(1);
  });
});
