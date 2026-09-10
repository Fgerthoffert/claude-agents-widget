import type { Session } from './types';

/**
 * The sessions worth a row in the panel.
 *
 * `ended` means a background job the supervisor has recorded as stopped: there is no process to
 * go back to and nothing left to decide about it. An interactive session never reaches this
 * state — it simply stops being reported (ADR-0018) — so this filter exists for the one case
 * where Claude Code still tells us about something that is over.
 */
export const visibleSessions = (sessions: readonly Session[]): readonly Session[] =>
  sessions.filter((session) => session.state !== 'ended');
