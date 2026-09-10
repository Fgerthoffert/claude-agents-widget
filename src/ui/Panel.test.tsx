import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Panel } from './Panel';
import { startWindowDrag } from './startWindowDrag';
import { aSession } from '../core/testing/aSession';
import type { Session } from '../core/types';

const mocks = vi.hoisted(() => ({
  sessions: { current: [] as Session[] },
  health: { current: { failure: null as string | null, degraded: [] as string[] } },
  onSessionClick: vi.fn(),
  togglePanelVisibility: vi.fn(),
}));

// A fake store: the panel reads the same hook it does in production, we choose what it returns.
vi.mock('./useSessions', () => ({
  useSessions: () => ({ sessions: mocks.sessions.current, health: mocks.health.current }),
}));
vi.mock('./onSessionClick', () => ({ onSessionClick: mocks.onSessionClick }));
vi.mock('./togglePanelVisibility', () => ({ togglePanelVisibility: mocks.togglePanelVisibility }));
vi.mock('./startWindowDrag', () => ({ startWindowDrag: vi.fn(() => Promise.resolve()) }));

/** Fixtures age against the real clock, because `useNowMs` reads it. */
const NOW = Date.now();

const session = (overrides: Partial<Session> & { readonly sessionId: string }): Session =>
  aSession({ title: null, stateSince: NOW - 1_000, ...overrides });

const renderPanel = (sessions: readonly Session[], failure: string | null = null): void => {
  mocks.sessions.current = [...sessions];
  mocks.health.current = { failure, degraded: [] };
  render(<Panel />);
};

const rowByName = (name: RegExp): HTMLElement => screen.getByRole('button', { name });

beforeEach(() => {
  mocks.onSessionClick.mockReset();
  // The panel records the outcome of every click, so the mock has to answer with one.
  mocks.onSessionClick.mockResolvedValue({
    ok: true,
    method: 'window',
    permissionDenied: false,
    degraded: false,
    detail: 'window',
  });
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

    // Running comes first as a section, so a working session precedes a blocked one here even
    // though the store sorts blocked sessions to the top. Titles rather than whole rows:
    // every row now opens with a state emoji.
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.querySelector('.row__title')?.textContent)).toEqual([
      'Refactoring the scanner',
      'Blocked on permission',
      'Docs pass',
    ]);
  });

  it('shows the session name as the primary content', () => {
    renderPanel([session({ sessionId: 'a', title: 'Wire up the tray' })]);

    expect(screen.getByText('Wire up the tray')).toHaveClass('row__title');
  });

  it('falls back to the project directory when a session has no name yet', () => {
    renderPanel([session({ sessionId: 'a', title: null, cwd: '/Users/test/code/api' })]);

    expect(screen.getByText('api')).toHaveClass('row__title');
  });

  it('marks every blocked row and shouts about only the most recent one', () => {
    renderPanel([
      session({
        sessionId: 'a',
        title: 'Newest',
        state: 'needs_input',
        waitingFor: 'permission prompt',
        stateSince: NOW - 1_000,
      }),
      session({
        sessionId: 'b',
        title: 'Older',
        state: 'needs_input',
        stateSince: NOW - 60_000,
      }),
      session({ sessionId: 'c', title: 'Busy' }),
    ]);

    // Marked: both blocked rows carry the accent bar and the amber reason.
    expect(rowByName(/^Newest/)).toHaveClass('row--blocked');
    expect(rowByName(/^Older/)).toHaveClass('row--blocked');
    expect(rowByName(/^Busy/)).not.toHaveClass('row--blocked');

    // Loud: exactly one, and it is the first the store gave, which is the most recent.
    expect(rowByName(/^Newest/)).toHaveClass('row--loud');
    expect(rowByName(/^Older/)).not.toHaveClass('row--loud');
    expect(rowByName(/^Newest/)).toHaveAttribute('data-state', 'needs_input');
    expect(screen.getByText('permission prompt · /Users/test/code/api')).toBeInTheDocument();
  });

  it('stops shouting about a session once the user has been to it', async () => {
    const user = userEvent.setup();
    renderPanel([
      session({
        sessionId: 'a',
        title: 'Newest',
        state: 'needs_input',
        waitingFor: 'permission prompt',
        stateSince: NOW - 1_000,
      }),
      session({
        sessionId: 'b',
        title: 'Older',
        state: 'needs_input',
        stateSince: NOW - 60_000,
      }),
    ]);

    await user.click(rowByName(/^Newest/));

    // Calm, but still marked — it is still blocked, the user just knows about it now.
    expect(rowByName(/^Newest/)).not.toHaveClass('row--loud');
    expect(rowByName(/^Newest/)).toHaveClass('row--blocked');
    // The loud slot passes to the next one the user has not seen.
    expect(rowByName(/^Older/)).toHaveClass('row--loud');
  });

  it('shouts again when an acknowledged session does something new', async () => {
    const user = userEvent.setup();
    const blocked = (stateSince: number) =>
      session({ sessionId: 'a', title: 'Blocked', state: 'needs_input', stateSince });

    renderPanel([blocked(NOW - 60_000)]);
    await user.click(rowByName(/^Blocked/));
    expect(rowByName(/^Blocked/)).not.toHaveClass('row--loud');

    // A new hook event moves updatedAt on, so the acknowledgement no longer covers it.
    cleanup();
    renderPanel([blocked(NOW)]);
    expect(rowByName(/^Blocked/)).toHaveClass('row--loud');
  });

  it('offers the grant, in one click, when macOS refused the click', async () => {
    const user = userEvent.setup();
    mocks.onSessionClick.mockResolvedValue({
      ok: false,
      method: null,
      permissionDenied: true,
      degraded: false,
      detail: 'permission-denied',
    });
    renderPanel([session({ sessionId: 'a', title: 'Blocked', state: 'needs_input' })]);

    await user.click(rowByName(/^Blocked/));

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent(/Accessibility/);
    expect(screen.getByRole('button', { name: 'Open Accessibility' })).toBeInTheDocument();
  });

  it('does not offer the grant for a failure the grant cannot fix', async () => {
    const user = userEvent.setup();
    mocks.onSessionClick.mockResolvedValue({
      ok: false,
      method: null,
      permissionDenied: false,
      degraded: false,
      detail: 'window-not-found',
    });
    renderPanel([session({ sessionId: 'a', title: 'Blocked', state: 'needs_input' })]);

    await user.click(rowByName(/^Blocked/));

    await screen.findByRole('status');
    expect(screen.queryByRole('button', { name: 'Open Accessibility' })).not.toBeInTheDocument();
  });

  it('says what happened when a click could not reach the window', async () => {
    const user = userEvent.setup();
    mocks.onSessionClick.mockResolvedValue({
      ok: false,
      method: null,
      permissionDenied: false,
      degraded: false,
      detail: 'window-not-found',
    });
    renderPanel([session({ sessionId: 'a', title: 'Blocked', state: 'needs_input' })]);

    await user.click(rowByName(/^Blocked/));

    expect(await screen.findByRole('status')).toHaveTextContent(/window is gone/i);
  });

  it('stays quiet when the click did exactly what the row promised', async () => {
    const user = userEvent.setup();
    renderPanel([session({ sessionId: 'a', title: 'Busy' })]);

    await user.click(rowByName(/^Busy/));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('ignores a second press while the first click is still being acted on', async () => {
    const user = userEvent.setup();
    let release = (): void => undefined;
    mocks.onSessionClick.mockReturnValue(
      new Promise((resolve) => {
        release = () => {
          resolve({
            ok: true,
            method: 'window',
            permissionDenied: false,
            degraded: false,
            detail: 'window',
          });
        };
      }),
    );
    renderPanel([session({ sessionId: 'a', title: 'Busy' })]);

    await user.click(rowByName(/^Busy/));
    expect(rowByName(/^Busy/)).toHaveAttribute('aria-busy', 'true');

    await user.click(rowByName(/^Busy/));
    expect(mocks.onSessionClick).toHaveBeenCalledTimes(1);

    // The promise resolves synchronously; act() flushes the state updates it triggers.
    await act(() => {
      release();
      return Promise.resolve();
    });
    expect(rowByName(/^Busy/)).toHaveAttribute('aria-busy', 'false');
  });

  it('leaves ended sessions out: the process is gone, so there is nothing to go back to', () => {
    renderPanel([
      session({ sessionId: 'a', title: 'Gone', state: 'ended' }),
      session({ sessionId: 'b', title: 'Busy' }),
    ]);

    expect(screen.queryByText('Gone')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('splits the panel into running, blocked on the user, and done', () => {
    renderPanel([
      session({ sessionId: 'a', title: 'Blocked', state: 'needs_input' }),
      session({ sessionId: 'b', title: 'Busy' }),
      session({ sessionId: 'c', title: 'Finished', state: 'done_idle' }),
    ]);

    const sections = screen.getAllByRole('region');
    expect(sections).toHaveLength(3);

    const [running, waiting, done] = sections;
    expect(running?.querySelector('.group__heading')?.textContent).toBe('Running1');
    expect(
      [...(running?.querySelectorAll('.row__title') ?? [])].map((node) => node.textContent),
    ).toEqual(['Busy']);

    // Only the genuinely blocked session, which is what the heading claims (ADR-0014).
    expect(waiting?.querySelector('.group__heading')?.textContent).toBe('Waiting for you1');
    expect(
      [...(waiting?.querySelectorAll('.row__title') ?? [])].map((node) => node.textContent),
    ).toEqual(['Blocked']);

    expect(done?.querySelector('.group__heading')?.textContent).toBe('Done1');
    expect(
      [...(done?.querySelectorAll('.row__title') ?? [])].map((node) => node.textContent),
    ).toEqual(['Finished']);
  });

  it('omits a section with nothing in it rather than heading an absence', () => {
    renderPanel([session({ sessionId: 'a', title: 'Finished', state: 'done_idle' })]);

    const sections = screen.getAllByRole('region');
    expect(sections).toHaveLength(1);
    expect(sections[0]?.querySelector('.group__heading')?.textContent).toBe('Done1');
    expect(screen.queryByText('Waiting for you')).not.toBeInTheDocument();
    expect(screen.queryByText('Running')).not.toBeInTheDocument();
  });

  it('shows a finished session as a row rather than as an empty panel', () => {
    renderPanel([session({ sessionId: 'a', title: 'Finished', state: 'done_idle' })]);

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText('No agents running right now.')).not.toBeInTheDocument();
  });

  it('omits a section that has nothing in it rather than heading an empty list', () => {
    renderPanel([session({ sessionId: 'a', title: 'Busy' })]);

    const sections = screen.getAllByRole('region');
    expect(sections).toHaveLength(1);
    expect(sections[0]?.querySelector('.group__heading')?.textContent).toBe('Running1');
  });

  it('marks the waiting section as needing attention only when a session is blocked', () => {
    renderPanel([session({ sessionId: 'a', title: 'Finished', state: 'done_idle' })]);
    expect(document.querySelector('.group__heading--attention')).toBeNull();

    cleanup();
    renderPanel([session({ sessionId: 'b', title: 'Blocked', state: 'needs_input' })]);
    expect(document.querySelector('.group__heading--attention')?.textContent).toBe(
      'Waiting for you1',
    );
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

  it('says the machine is quiet, with nothing to install', () => {
    renderPanel([]);

    expect(screen.getByText('No agents running right now')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Install/ })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('says detection is broken rather than idle when the sweep is failing', () => {
    renderPanel([], 'Watching the hook state directory failed: fs.watch not allowed');

    expect(screen.getByText('Detection is not running')).toBeInTheDocument();
    expect(screen.queryByText('No Claude Code sessions detected')).not.toBeInTheDocument();
    expect(screen.queryByText('No agents running right now')).not.toBeInTheDocument();
  });

  it('drags the window when a press moves, from anywhere including over a row', async () => {
    const user = userEvent.setup();
    renderPanel([session({ sessionId: 'a', title: 'Busy' })]);

    const row = rowByName(/Busy/);
    await user.pointer([
      { keys: '[MouseLeft>]', target: row },
      { coords: { clientX: 40, clientY: 40 } },
      { keys: '[/MouseLeft]' },
    ]);

    expect(startWindowDrag).toHaveBeenCalledTimes(1);
    // The click that ended the drag is not a click on the row it happened over.
    expect(mocks.onSessionClick).not.toHaveBeenCalled();
  });

  it('does not drag when a press does not move, so rows stay clickable', async () => {
    const user = userEvent.setup();
    renderPanel([session({ sessionId: 'a', title: 'Busy' })]);

    await user.click(rowByName(/Busy/));

    expect(startWindowDrag).not.toHaveBeenCalled();
    expect(mocks.onSessionClick).toHaveBeenCalledTimes(1);
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
    for (const label of [
      'needs an answer',
      'working',
      'done',
      'processing time',
      'inactive time',
    ]) {
      expect(legend.textContent).toContain(label);
    }
    for (const glyph of ['✋', '🔄', '✅', '▶', '⏸']) {
      expect(legend.textContent).toContain(glyph);
    }
    // Ended sessions are never rendered, so the legend must not advertise them.
    expect(legend.textContent).not.toContain('ended');
  });

  it('distinguishes time spent working from time spent idle', () => {
    renderPanel([
      session({ sessionId: 'a', title: 'Busy', state: 'working' }),
      session({ sessionId: 'b', title: 'Waiting', state: 'needs_input' }),
      session({ sessionId: 'c', title: 'Finished', state: 'done_idle' }),
    ]);

    const age = (name: RegExp) => rowByName(name).querySelector('.row__age');
    expect(age(/Busy/)?.textContent).toContain('▶');
    expect(age(/Busy/)).toHaveClass('row__age--active');
    expect(age(/Waiting/)?.textContent).toContain('⏸');
    expect(age(/Waiting/)).not.toHaveClass('row__age--active');
    expect(age(/Finished/)?.textContent).toContain('⏸');
  });

  it('labels the state and what the duration measures for screen readers', () => {
    renderPanel([session({ sessionId: 'a', title: 'Busy', state: 'working' })]);

    expect(rowByName(/Busy/).getAttribute('aria-label')).toContain('processing for');
  });

  it('ages a row on its own, without new store data', () => {
    const frozen = Date.parse('2026-09-09T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(frozen);
    renderPanel([session({ sessionId: 'a', title: 'Long runner', stateSince: frozen })]);

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

  it('shows an age for every session, whatever its kind', () => {
    // The old two-source pipeline had rows whose timestamp was the sweep that found them, so
    // they showed nothing. There is one source and one real transition time now (ADR-0018).
    renderPanel([
      session({ sessionId: 'a', title: 'Attached', stateSince: NOW - 12_000 }),
      session({
        sessionId: 'b',
        title: 'Dispatched',
        kind: 'background',
        stateSince: NOW - 12_000,
      }),
    ]);

    expect(rowByName(/^Attached/)).toHaveTextContent('12s');
    expect(rowByName(/^Dispatched/)).toHaveTextContent('12s');
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
