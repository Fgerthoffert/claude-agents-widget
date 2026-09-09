import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Panel } from './Panel';
import type { Session } from '../core/types';

const mocks = vi.hoisted(() => ({
  sessions: { current: [] as Session[] },
  onSessionClick: vi.fn(),
  togglePanelVisibility: vi.fn(),
}));

// A fake store: the panel reads the same hook it does in production, we choose what it returns.
vi.mock('./useSessions', () => ({ useSessions: () => mocks.sessions.current }));
vi.mock('./onSessionClick', () => ({ onSessionClick: mocks.onSessionClick }));
vi.mock('./togglePanelVisibility', () => ({ togglePanelVisibility: mocks.togglePanelVisibility }));

const NOW = Date.parse('2026-09-09T12:00:00.000Z');

const session = (overrides: Partial<Session> & { readonly sessionId: string }): Session => ({
  title: null,
  cwd: '/Users/test/code/api',
  transcriptPath: null,
  state: 'working',
  source: 'hook',
  notificationType: null,
  notificationMessage: null,
  updatedAt: new Date(NOW).toISOString(),
  claudePid: 1234,
  ancestors: [],
  ...overrides,
});

const renderPanel = (sessions: readonly Session[]): void => {
  mocks.sessions.current = [...sessions];
  render(<Panel />);
};

const rowByName = (name: RegExp): HTMLElement => screen.getByRole('button', { name });

beforeEach(() => {
  mocks.onSessionClick.mockReset();
  mocks.togglePanelVisibility.mockReset();
});

// Only the ageing test fakes time: `user-event` drives its own microtask queue and deadlocks
// against a fake clock, so interaction tests stay on real timers.
afterEach(() => {
  vi.useRealTimers();
});

describe('Panel', () => {
  it('renders one row per session, in the order the store gave them', () => {
    renderPanel([
      session({ sessionId: 'a', title: 'Blocked on permission', state: 'needs_input' }),
      session({ sessionId: 'b', title: 'Refactoring the scanner' }),
      session({ sessionId: 'c', title: 'Docs pass', state: 'done_idle' }),
    ]);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    // Titles rather than whole rows: every row now opens with a state emoji.
    expect(rows.map((row) => row.querySelector('.row__title')?.textContent)).toEqual([
      'Blocked on permission',
      'Refactoring the scanner',
      'Docs pass',
    ]);
    expect(screen.getByText('Refactoring the scanner')).toBeInTheDocument();
  });

  it('shows the session name as the primary content', () => {
    renderPanel([session({ sessionId: 'a', title: 'Wire up the tray' })]);

    expect(screen.getByText('Wire up the tray')).toHaveClass('row__title');
  });

  it('falls back to the project directory when a session has no name yet', () => {
    renderPanel([session({ sessionId: 'a', title: null, cwd: '/Users/test/code/api' })]);

    expect(screen.getByText('api')).toHaveClass('row__title');
  });

  it('marks a needs-input row as the one that needs attention', () => {
    renderPanel([
      session({
        sessionId: 'a',
        title: 'Blocked',
        state: 'needs_input',
        notificationType: 'permission_prompt',
      }),
      session({ sessionId: 'b', title: 'Busy' }),
    ]);

    expect(rowByName(/^Blocked/)).toHaveClass('row--attention');
    expect(rowByName(/^Blocked/)).toHaveAttribute('data-state', 'needs_input');
    expect(rowByName(/^Busy/)).not.toHaveClass('row--attention');
    expect(screen.getByText('needs permission · /Users/test/code/api')).toBeInTheDocument();
  });

  it('keeps ended sessions visible but marked as ended', () => {
    renderPanel([session({ sessionId: 'a', title: 'Finished', state: 'ended' })]);

    expect(rowByName(/^Finished/)).toHaveAttribute('data-state', 'ended');
  });

  it('leaves rows out of the drag region so a click is not read as a drag', () => {
    renderPanel([session({ sessionId: 'a', title: 'Clickable' })]);

    // Tauri matches `data-tauri-drag-region` on the element under the cursor, so the shell and
    // the list background drag while the row itself does not.
    expect(rowByName(/^Clickable/)).not.toHaveAttribute('data-tauri-drag-region');
    expect(screen.getByRole('list')).toHaveAttribute('data-tauri-drag-region');
    expect(screen.getByRole('banner')).toHaveAttribute('data-tauri-drag-region');
    expect(screen.getByRole('main')).toHaveAttribute('data-tauri-drag-region');
    expect(screen.getByRole('button', { name: 'Hide panel' })).not.toHaveAttribute(
      'data-tauri-drag-region',
    );
  });

  it('focuses the session that was clicked', async () => {
    const user = userEvent.setup();
    renderPanel([
      session({ sessionId: 'a', title: 'First' }),
      session({ sessionId: 'b', title: 'Second' }),
    ]);

    await user.click(rowByName(/^Second/));

    expect(mocks.onSessionClick).toHaveBeenCalledTimes(1);
    expect(mocks.onSessionClick.mock.calls[0]?.[0]).toMatchObject({ sessionId: 'b' });
  });

  it('reaches a row from the keyboard', async () => {
    const user = userEvent.setup();
    renderPanel([session({ sessionId: 'a', title: 'First' })]);

    rowByName(/^First/).focus();
    await user.keyboard('{Enter}');

    expect(mocks.onSessionClick).toHaveBeenCalledTimes(1);
  });

  it('renders the empty state with the hook-install hint when nothing is detected', () => {
    renderPanel([]);

    expect(screen.getByText('No Claude Code sessions detected')).toBeInTheDocument();
    expect(screen.getByText('npm run install-hooks')).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('hides the panel on request', async () => {
    const user = userEvent.setup();
    renderPanel([session({ sessionId: 'a', title: 'Busy' })]);

    await user.click(screen.getByRole('button', { name: 'Hide panel' }));
    expect(mocks.togglePanelVisibility).toHaveBeenCalledTimes(1);
  });

  it('keeps counts out of the header, where the rows already are the count', () => {
    renderPanel([
      session({ sessionId: 'a', state: 'needs_input', title: 'Blocked' }),
      session({ sessionId: 'b', title: 'Busy' }),
    ]);

    expect(screen.getByRole('banner').textContent).not.toMatch(/\d/);
  });

  it('explains every glyph it uses in the legend', () => {
    renderPanel([session({ sessionId: 'a', title: 'Busy' })]);

    const legend = screen.getByRole('contentinfo');
    for (const label of ['needs you', 'working', 'done', 'ended', 'working for', 'inactive for']) {
      expect(legend.textContent).toContain(label);
    }
    for (const glyph of ['✋', '🔄', '✅', '💤', '⏱', '⏳']) {
      expect(legend.textContent).toContain(glyph);
    }
  });

  it('distinguishes time spent working from time spent idle', () => {
    renderPanel([
      session({ sessionId: 'a', title: 'Busy', state: 'working' }),
      session({ sessionId: 'b', title: 'Waiting', state: 'needs_input' }),
      session({ sessionId: 'c', title: 'Finished', state: 'done_idle' }),
    ]);

    const age = (name: RegExp) => rowByName(name).querySelector('.row__age');
    expect(age(/Busy/)?.textContent).toContain('⏱');
    expect(age(/Busy/)).toHaveClass('row__age--active');
    expect(age(/Waiting/)?.textContent).toContain('⏳');
    expect(age(/Waiting/)).not.toHaveClass('row__age--active');
    expect(age(/Finished/)?.textContent).toContain('⏳');
  });

  it('labels the state and what the duration measures for screen readers', () => {
    renderPanel([session({ sessionId: 'a', title: 'Busy', state: 'working' })]);

    expect(rowByName(/Busy/).getAttribute('aria-label')).toContain('working for');
  });

  it('ages a row on its own, without new store data', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    renderPanel([session({ sessionId: 'a', title: 'Long runner' })]);

    expect(rowByName(/^Long runner/)).toHaveTextContent('0s');

    act(() => {
      vi.advanceTimersByTime(12_000);
    });
    expect(rowByName(/^Long runner/)).toHaveTextContent('12s');

    act(() => {
      vi.advanceTimersByTime(4 * 60_000 - 12_000);
    });
    expect(rowByName(/^Long runner/)).toHaveTextContent('4m');
  });

  it('shows no age for a scanner-only session, whose timestamp is the scan not the transition', () => {
    renderPanel([session({ sessionId: 'a', title: 'Discovered', source: 'scanner' })]);

    expect(rowByName(/^Discovered/).querySelector('.row__age')?.textContent).toBe('');
  });

  it('stays legible with ten concurrent sessions', () => {
    renderPanel(
      Array.from({ length: 10 }, (_, index) =>
        session({ sessionId: `s${String(index)}`, title: `Session ${String(index)}` }),
      ),
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(10);
  });
});
