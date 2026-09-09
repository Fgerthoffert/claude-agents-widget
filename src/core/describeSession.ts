import { sessionDisplayTitle } from './sessionDisplayTitle';
import { shortenPath } from './shortenPath';
import type { Session, SessionState } from './types';

/** Everything a panel row renders as text, resolved in one place so the component stays dumb. */
export interface SessionDescription {
  /** Primary line: the session name. */
  readonly title: string;
  /** Secondary line: why it needs you (if it does), then where it is running. */
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
 * Known `Notification` matchers (ADR-0006). An unknown type still says something useful
 * rather than nothing: Claude Code has added matchers before and will again.
 */
const notificationReasons: Readonly<Record<string, string>> = {
  permission_prompt: 'needs permission',
  idle_prompt: 'waiting for you',
  agent_needs_input: 'agent needs input',
};

const reasonFor = (session: Session): string | null => {
  if (session.state !== 'needs_input') return null;
  const { notificationType } = session;
  if (notificationType === null || notificationType === '') return 'waiting for you';

  return notificationReasons[notificationType] ?? notificationType.replace(/_/g, ' ');
};

/**
 * Turns a session into the four strings a row needs.
 *
 * `notificationMessage` is deliberately kept out of the visible detail line: the matcher-based
 * reason is short and predictable, whereas the message is free text that would push the path
 * off a 320px-wide row. It surfaces in the tooltip instead.
 */
export const describeSession = (session: Session, home: string): SessionDescription => {
  const title = sessionDisplayTitle(session);
  const path = shortenPath(session.cwd, home);
  const reason = reasonFor(session);
  const detail = [reason, path].filter((part) => part !== null && part !== '').join(' · ');

  const tooltip = [title, session.notificationMessage, session.cwd]
    .filter((part): part is string => part !== null && part !== '')
    .join('\n');

  return {
    title,
    detail,
    stateLabel: stateLabels[session.state],
    tooltip,
  };
};
