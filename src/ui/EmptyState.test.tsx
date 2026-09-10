import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EmptyState } from './EmptyState';

const renderState = (failure: string | null = null) => {
  const onOpenSetup = vi.fn();
  render(<EmptyState failure={failure} onOpenSetup={onOpenSetup} />);
  return { onOpenSetup };
};

describe('EmptyState', () => {
  it('says the panel is simply idle when nothing is running', () => {
    renderState();

    expect(screen.getByText('No agents running right now')).toBeInTheDocument();
    expect(screen.getByText(/Start one with/)).toBeInTheDocument();
  });

  it('offers no install, because there is nothing left to install', () => {
    // Two of the three empty-panel cases were "you never set up the hook" (ADR-0018).
    renderState();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('never claims all is well when detection is broken', () => {
    // v0.2.0 answered a broken pipeline with "No agents running right now", which sent users
    // looking for a problem in Claude Code instead of in this app (ADR-0011).
    renderState('Asking Claude Code for its sessions failed: command not allowed');

    expect(screen.getByText('Detection is not running')).toBeInTheDocument();
    expect(screen.queryByText('No agents running right now')).not.toBeInTheDocument();
  });

  it('shows the reason verbatim, so it can be pasted into a report', () => {
    const failure = 'Asking Claude Code for its sessions failed: command not allowed';
    renderState(failure);

    expect(screen.getByText(failure)).toBeInTheDocument();
  });

  it('offers a way into diagnostics when it is broken', async () => {
    const user = userEvent.setup();
    const { onOpenSetup } = renderState('boom');

    await user.click(screen.getByRole('button', { name: 'Open diagnostics' }));

    expect(onOpenSetup).toHaveBeenCalledOnce();
  });
});
