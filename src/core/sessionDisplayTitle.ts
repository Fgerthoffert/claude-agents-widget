import type { Session } from './types';

/**
 * The primary text of a panel row — the thing the user complained was missing from the tool
 * they tried before this one, so it must always resolve to something recognisable.
 *
 * Order: the Claude Code session title, then the project directory's basename, then a short
 * session-id prefix. The last two are worse than a real title but never worse than a blank row.
 */
export const sessionDisplayTitle = (session: Session): string => {
  const title = session.title?.trim();
  if (title !== undefined && title !== '') return title;

  const basename = (session.cwd ?? '')
    .split('/')
    .filter((segment) => segment !== '')
    .at(-1);
  if (basename !== undefined) return basename;

  return session.sessionId === '' ? 'unknown session' : session.sessionId.slice(0, 8);
};
