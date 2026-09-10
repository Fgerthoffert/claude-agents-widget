import { useCallback, useEffect, useRef } from 'react';

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

/** Give the browser a frame to lay the new rows out before asking how tall they are. */
const SETTLE_MS = 16;

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
 * `dependency` is a string the caller changes whenever the content might have — the section
 * counts, whether a notice is up, whether setup is open. A `ResizeObserver` was the alternative
 * and does not work here: every box that decides this panel's height is either stretched by flex
 * or clipped by `overflow`, so none of them changes size when the content inside them does.
 *
 * Everything is best-effort. A failure to resize leaves the user with a window of the wrong
 * height, which is a great deal better than a panel that does not render.
 */
export const useAutoPanelHeight = (enabled: boolean, dependency: string): AutoPanelHeight => {
  const panelRef = useRef<HTMLElement | null>(null);

  const apply = useCallback(async (): Promise<void> => {
    const panel = panelRef.current;
    if (panel === null) return;

    const contentHeight = measurePanelContentHeight(panel);
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

  useEffect(() => {
    if (!enabled || !isTauri()) return;

    // One frame's grace: React has committed the DOM but the browser may not have laid it out,
    // and measuring mid-layout reports the height the panel had a moment ago.
    const timer = setTimeout(() => {
      apply().catch((error: unknown) => {
        console.warn('could not fit the panel to its content', error);
      });
    }, SETTLE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [enabled, dependency, apply]);

  return { panelRef };
};
