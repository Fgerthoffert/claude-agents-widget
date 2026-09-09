import type { Session } from './types';

/**
 * The sessions worth a row in the panel.
 *
 * `ended` means the `claude` process is gone — the terminal was closed or the session cleared —
 * so there is nothing left to go back to and nothing to decide about it. The reconciler still
 * tracks the state briefly (it is how a session leaves the store at all, and diagnostics read
 * it), but the panel and the tray both leave it out.
 */
export const visibleSessions = (sessions: readonly Session[]): readonly Session[] =>
  sessions.filter((session) => session.state !== 'ended');
