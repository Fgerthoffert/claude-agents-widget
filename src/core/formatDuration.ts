const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Compact elapsed time for the right edge of a panel row: `12s`, `4m`, `1h`, `3d`.
 *
 * One unit only, always the largest that fits, always truncated down — a row that reads `1h`
 * for the whole of the second hour is easier to scan than one that rounds to `2h` at 1h30.
 * Negative input (a clock skew between the hook's ISO timestamp and this process) reads `0s`
 * rather than a nonsense negative age.
 */
export const formatDuration = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < SECOND_MS) return '0s';
  if (ms < MINUTE_MS) return `${String(Math.floor(ms / SECOND_MS))}s`;
  if (ms < HOUR_MS) return `${String(Math.floor(ms / MINUTE_MS))}m`;
  if (ms < DAY_MS) return `${String(Math.floor(ms / HOUR_MS))}h`;
  return `${String(Math.floor(ms / DAY_MS))}d`;
};
