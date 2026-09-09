import { countSessionStates } from './countSessionStates';
import { formatAggregate } from './formatAggregate';
import { sessionDisplayTitle } from './sessionDisplayTitle';
import type { Session, SessionState } from './types';

/** One clickable line in the tray dropdown. */
export interface TrayMenuItem {
  readonly sessionId: string;
  readonly text: string;
}

/** Everything the tray shows, as plain strings the imperative shell hands to the native menu. */
export interface TrayModel {
  /** Menu bar label, e.g. `3▶ 2⏸ 1✔`. */
  readonly label: string;
  /** First (disabled) dropdown line, spelled out because a menu has room for words. */
  readonly summary: string;
  readonly items: readonly TrayMenuItem[];
  /** How many sessions the dropdown had to leave out; 0 when it listed them all. */
  readonly overflow: number;
}

/** macOS truncates long menu bar text, and the label competes with every other tray icon. */
const MAX_LABEL_LENGTH = 20;

/** Beyond this the dropdown stops being scannable; the panel is where the full list lives. */
const MAX_ITEMS = 10;

/** Enough to identify a session in a menu without stretching the menu across the screen. */
const MAX_ITEM_TEXT_LENGTH = 44;

const glyphs: Readonly<Record<SessionState, string>> = {
  needs_input: '⏸',
  working: '▶',
  done_idle: '✔',
  ended: '·',
};

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

const summarise = (sessions: readonly Session[]): string => {
  const counts = countSessionStates(sessions);
  const parts = [
    counts.needsInput > 0 ? `${String(counts.needsInput)} need input` : null,
    counts.working > 0 ? `${String(counts.working)} working` : null,
    counts.doneIdle > 0 ? `${String(counts.doneIdle)} done` : null,
  ].filter((part) => part !== null);

  return parts.length > 0 ? parts.join(' · ') : 'No active sessions';
};

/**
 * Derives the whole tray surface from the session list.
 *
 * `ended` sessions are excluded to stay consistent with `countSessionStates`, which leaves them
 * out of the aggregate: a dropdown listing a session the label does not count reads as a bug.
 * The panel still shows them (dimmed), because there the ordering makes it obvious they are done.
 */
export const buildTrayModel = (sessions: readonly Session[]): TrayModel => {
  const active = sessions.filter((session) => session.state !== 'ended');

  return {
    label: truncate(formatAggregate(countSessionStates(sessions)), MAX_LABEL_LENGTH),
    summary: summarise(sessions),
    items: active.slice(0, MAX_ITEMS).map((session) => ({
      sessionId: session.sessionId,
      text: truncate(
        `${glyphs[session.state]}  ${sessionDisplayTitle(session)}`,
        MAX_ITEM_TEXT_LENGTH,
      ),
    })),
    overflow: Math.max(active.length - MAX_ITEMS, 0),
  };
};
