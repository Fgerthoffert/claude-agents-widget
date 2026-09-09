import type { Ancestor } from './types';

/**
 * Markers for the Claude desktop app and for the copy of the CLI it ships inside its own support
 * directory (`~/Library/Application Support/Claude/claude-code/<version>/claude.app/…`). That
 * binary's basename is literally `claude`, so nothing shorter than the surrounding path tells it
 * apart from a CLI the user launched.
 */
const DESKTOP_MARKERS: readonly string[] = [
  '/Claude.app/Contents/',
  '/Application Support/Claude/',
];

/**
 * Whether a session belongs to the Claude desktop app rather than to a terminal.
 *
 * Claude Desktop runs Claude Code sessions of its own, and reads the same
 * `~/.claude/settings.json` — so the widget's hook fires for them and they arrive looking like
 * any other session. They are not ones this widget can help with: its whole promise is to take
 * the user back to the terminal window that owns a session, and a desktop conversation has no
 * terminal window to go back to. It is also already on screen, in an app the user switches to
 * directly, which is precisely why a row for it reads as noise.
 *
 * Decided from the ancestor chain rather than from `cwd`, because the working directory of a
 * desktop session is an ordinary project directory and says nothing about who started it.
 */
export const isDesktopSession = (ancestors: readonly Ancestor[]): boolean =>
  ancestors.some((ancestor) =>
    DESKTOP_MARKERS.some(
      (marker) => ancestor.comm.includes(marker) || ancestor.args.includes(marker),
    ),
  );
