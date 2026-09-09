import type { ScreenRect } from './clampWindowPosition';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Validates a persisted panel frame read back from the settings store.
 *
 * The file is user-editable and survives app upgrades, so anything in it is untrusted: a
 * half-written record, a shape from an older version, `null` on first run. Returning `null`
 * for all of those lets the caller fall back to the window's configured default instead of
 * moving the panel to `NaN`.
 */
export const parseWindowFrame = (value: unknown): ScreenRect | null => {
  if (typeof value !== 'object' || value === null) return null;

  const { x, y, width, height } = value as Record<string, unknown>;
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;
  if (!isFiniteNumber(width) || !isFiniteNumber(height)) return null;
  if (width <= 0 || height <= 0) return null;

  return { x, y, width, height };
};
