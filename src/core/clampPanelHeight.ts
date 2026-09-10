/** Everything the decision needs, in physical pixels. */
export interface PanelHeightRequest {
  /** Height the panel's content actually wants, measured from the live DOM. */
  readonly contentHeight: number;
  /** The window's configured floor (`minHeight` in tauri.conf.json). */
  readonly minHeight: number;
  /** Usable height of the monitor the panel is on — a work area, not the full bounds. */
  readonly availableHeight: number;
}

/** Left below the panel even when it is at full stretch, so it never looks wedged in. */
const BREATHING_ROOM = 24;

/**
 * The window height to ask for, given what the content wants and what the screen allows.
 *
 * Pure, because this is the only judgement in auto-height and the rest is measurement. Two
 * bounds, in this order of authority:
 *
 * - **The screen wins.** A panel taller than the work area cannot be moved back into view by
 *   hand — it has no title bar to grab above the menu bar — so the ceiling is absolute, and
 *   sits a little under the work area so the panel reads as floating rather than jammed.
 * - **The floor is the window's own `minHeight`.** Below that the header and the legend start
 *   eating the rows they frame.
 *
 * When the content is taller than the ceiling the panel stops growing and its sections scroll,
 * which is the behaviour they were built for (ADR-0008). Non-finite or nonsense input falls back
 * to the floor rather than propagating `NaN` into `setSize`, where it would resize the window to
 * nothing.
 */
export const clampPanelHeight = ({
  contentHeight,
  minHeight,
  availableHeight,
}: PanelHeightRequest): number => {
  const floor = Number.isFinite(minHeight) && minHeight > 0 ? Math.ceil(minHeight) : 1;
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) return floor;

  const ceiling =
    Number.isFinite(availableHeight) && availableHeight > 0
      ? Math.max(floor, Math.floor(availableHeight - BREATHING_ROOM))
      : Number.POSITIVE_INFINITY;

  return Math.min(Math.max(Math.ceil(contentHeight), floor), ceiling);
};
