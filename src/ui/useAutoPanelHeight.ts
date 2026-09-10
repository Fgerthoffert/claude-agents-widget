import { useCallback, useLayoutEffect, useRef } from 'react';

import { clampPanelHeight } from '../core/clampPanelHeight';
import { isTauri } from './isTauri';
import { measurePanelContentHeight } from './measurePanelContentHeight';
import type { RefObject } from 'react';

/**
 * The window's own floor, from `minHeight` in tauri.conf.json. Duplicated rather than read back
 * because there is no API for it, and a wrong value here only ever means a slightly-too-short
 * panel — never a broken one.
 */
const MIN_HEIGHT = 120;

export interface AutoPanelHeight {
  /** Attach to the panel's root element — the thing whose content is being measured. */
  readonly panelRef: RefObject<HTMLElement | null>;
}

/**
 * Keeps the window's height equal to the height of what it is showing.
 *
 * The panel's whole purpose is to be glanceable beside real work, and a fixed 400px window is
 * wrong in both directions: mostly empty with two agents, and scrolling with twelve. This
 * measures the rendered content and asks for exactly that (ADR-0015).
 *
 * Width is never touched. The user picks it, it is persisted, and nothing here has an opinion
 * about it.
 *
 * Measured **after every commit**, in a layout effect, and compared against the last measurement
 * before anything async happens. Two alternatives were tried and rejected:
 *
 * - A `ResizeObserver` cannot see this at all: every box that decides the panel's height is
 *   either stretched by flex or clipped by `overflow`, so none of them changes size when the
 *   content inside it does. It would have looked right and fired never.
 * - A dependency string naming everything that affects the height worked for the session list
 *   and quietly failed for the setup view, whose height also depends on state this hook cannot
 *   see: whether *Show the change* is expanded, whether an install has reported an outcome,
 *   whether detection has started failing. Enumerating another component's internals is a list
 *   that goes stale the first time someone adds a paragraph.
 *
 * So there is no list. A layout effect runs after React has written the DOM and before the
 * browser paints, and reading `scrollHeight` there forces the layout to be current — so the
 * measurement is always of what is actually on screen. The panel re-renders about once a second
 * for the clock, and an unchanged measurement costs one DOM read and returns.
 *
 * Everything is best-effort. A failure to resize leaves the user with a window of the wrong
 * height, which is a great deal better than a panel that does not render.
 */
export const useAutoPanelHeight = (enabled: boolean): AutoPanelHeight => {
  const panelRef = useRef<HTMLElement | null>(null);
  /** Last height measured, so a re-render that changed nothing does no work. */
  const measured = useRef<number | null>(null);

  const apply = useCallback(async (contentHeight: number): Promise<void> => {
    const { getCurrentWindow, currentMonitor, PhysicalSize } =
      await import('@tauri-apps/api/window');
    const window = getCurrentWindow();
    const [size, scaleFactor, monitor] = await Promise.all([
      window.outerSize(),
      window.scaleFactor(),
      currentMonitor(),
    ]);

    // Measurement is in CSS pixels and setSize wants physical ones: on a Retina display the two
    // differ by a factor of two, which is the difference between the right height and half of it.
    const height = clampPanelHeight({
      contentHeight: contentHeight * scaleFactor,
      minHeight: MIN_HEIGHT * scaleFactor,
      availableHeight: monitor?.workArea.size.height ?? 0,
    });

    if (height !== size.height) await window.setSize(new PhysicalSize(size.width, height));
  }, []);

  useLayoutEffect(() => {
    if (!enabled || !isTauri()) {
      // Forget the last measurement, so re-enabling the setting resizes rather than deciding
      // nothing has changed since it was switched off.
      measured.current = null;
      return;
    }

    const panel = panelRef.current;
    if (panel === null) return;

    const contentHeight = measurePanelContentHeight(panel);
    if (contentHeight === measured.current) return;
    measured.current = contentHeight;

    apply(contentHeight).catch((error: unknown) => {
      console.warn('could not fit the panel to its content', error);
    });
  });

  return { panelRef };
};
