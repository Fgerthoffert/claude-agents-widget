import { sessionDisplayTitle } from './sessionDisplayTitle';
import { shortenPath } from './shortenPath';
import type { Session, SessionState } from './types';

/** Everything a panel row renders as text, resolved in one place so the component stays dumb. */
export interface SessionDescription {
  /** Primary line: the session name. */
  readonly title: string;
  /** Secondary line: why it is blocked (if it is), then where it is running. */
  readonly detail: string;
  /** Screen-reader and tray wording for the state dot. */
  readonly stateLabel: string;
  /** Hover text, where there is room for the parts the row had to truncate. */
  readonly tooltip: string;
}

const stateLabels: Readonly<Record<SessionState, string>> = {
  needs_input: 'needs input',
  working: 'working',
  done_idle: 'done',
  ended: 'ended',
};

/**
 * Turns a session into the three strings a row needs.
 *
 * The reason a blocked session is blocked comes straight from `waitingFor` — `permission
 * prompt`, `input needed`, `sandbox request` — which Claude Code reports itself. There used to
 * be a lookup table mapping hook notification matchers to wording, with a fallback for matchers
 * it had not heard of; the CLI's own phrase is already the right words, so it is shown as-is
 * (ADR-0018).
 */
export const describeSession = (session: Session, home: string): SessionDescription => {
  const title = sessionDisplayTitle(session);
  const path = shortenPath(session.cwd, home);
  const reason = session.state === 'needs_input' ? session.waitingFor : null;
  const detail = [reason, path].filter((part) => part !== null && part !== '').join(' · ');

  return {
    title,
    detail,
    stateLabel: stateLabels[session.state],
    tooltip: [title, session.cwd].filter((part) => part !== null && part !== '').join('\n'),
  };
};
