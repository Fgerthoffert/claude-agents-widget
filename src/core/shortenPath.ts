/**
 * Renders a working directory for the row's secondary line: `~/proj/api`, `/etc`, `~`.
 *
 * Only the home prefix is abbreviated. Middle-ellipsis truncation is deliberately not done
 * here — CSS truncates the rendered line, which knows the real pixel width, and a path
 * shortened twice reads worse than one truncated once.
 */
export const shortenPath = (cwd: string | null, home: string): string => {
  if (cwd === null || cwd === '') return '';

  const normalizedHome = home.endsWith('/') ? home.slice(0, -1) : home;
  if (normalizedHome === '') return cwd;
  if (cwd === normalizedHome) return '~';
  if (cwd.startsWith(`${normalizedHome}/`)) return `~${cwd.slice(normalizedHome.length)}`;

  return cwd;
};
