/** A rectangle in physical pixels — the unit Tauri reports monitors and window frames in. */
export interface ScreenRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ClampWindowPositionInput {
  /** The frame we would like to restore: saved position, current size. */
  readonly frame: ScreenRect;
  /** Available monitors, primary first. An empty list means we know nothing. */
  readonly monitors: readonly ScreenRect[];
}

/** Below this much of the panel on screen, the saved position counts as lost. */
const MIN_VISIBLE_FRACTION = 0.6;

const overlapArea = (a: ScreenRect, b: ScreenRect): number => {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

  return width > 0 && height > 0 ? width * height : 0;
};

const clampInto = (frame: ScreenRect, monitor: ScreenRect): { x: number; y: number } => ({
  // Math.min before Math.max so a panel larger than the monitor lands on the monitor's origin
  // rather than being pushed off the far edge.
  x: Math.max(monitor.x, Math.min(frame.x, monitor.x + monitor.width - frame.width)),
  y: Math.max(monitor.y, Math.min(frame.y, monitor.y + monitor.height - frame.height)),
});

/**
 * Decides where a saved panel position may actually be restored.
 *
 * The user parks this panel on whichever monitor they are working on, so a saved position
 * routinely refers to a display that is no longer attached — an external monitor at the office,
 * a laptop that has since been docked. Restoring it verbatim would put the panel somewhere the
 * user cannot see or grab, and an always-on-top window with no decorations offers no other way
 * back.
 *
 * Returns the position to use, or `null` when the frame is already fine (or when there are no
 * monitors to judge against, in which case the caller should leave the window where the OS
 * put it).
 */
export const clampWindowPosition = (
  input: ClampWindowPositionInput,
): { readonly x: number; readonly y: number } | null => {
  const { frame, monitors } = input;
  const [primary, ...rest] = monitors;
  if (primary === undefined) return null;

  const area = frame.width * frame.height;
  const best = rest.reduce(
    (acc, monitor) => {
      const overlap = overlapArea(frame, monitor);
      return overlap > acc.overlap ? { monitor, overlap } : acc;
    },
    { monitor: primary, overlap: overlapArea(frame, primary) },
  );

  if (area > 0 && best.overlap / area >= MIN_VISIBLE_FRACTION) return null;

  return clampInto(frame, best.monitor);
};
