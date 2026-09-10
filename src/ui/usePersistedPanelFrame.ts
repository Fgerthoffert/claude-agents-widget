import { useEffect, useRef } from 'react';

import { clampWindowPosition } from '../core/clampWindowPosition';
import { parseWindowFrame } from '../core/parseWindowFrame';
import { FRAME_KEY, SAVE_DEBOUNCE_MS, loadPanelStore } from './panelStore';
import { isTauri } from './isTauri';
import type { ScreenRect } from '../core/clampWindowPosition';
import type { Monitor } from '@tauri-apps/api/window';

/**
 * Monitor *work areas*, primary first, in physical pixels.
 *
 * Work area rather than full bounds keeps a restored panel clear of the menu bar and the Dock.
 * Primary first is what `clampWindowPosition` falls back to when the saved monitor is gone.
 * Identity is by origin, not by `name`, which is `null` on some displays.
 */
const workAreas = (primary: Monitor | null, monitors: readonly Monitor[]): ScreenRect[] => {
  const ordered = [
    ...(primary === null ? [] : [primary]),
    ...monitors.filter(
      (monitor) =>
        monitor.position.x !== primary?.position.x || monitor.position.y !== primary.position.y,
    ),
  ];

  return ordered.map(({ workArea }) => ({
    x: workArea.position.x,
    y: workArea.position.y,
    width: workArea.size.width,
    height: workArea.size.height,
  }));
};

/**
 * Restores the panel's saved position and size on launch, then keeps them up to date.
 *
 * Restore is clamped against the monitors actually attached (`clampWindowPosition`): the user
 * moves this panel from screen to screen, so a saved position routinely names a display that
 * is gone, and an undecorated always-on-top window placed off-screen cannot be recovered by
 * hand.
 *
 * With `autoHeight` on, the saved **height** is deliberately not restored — `useAutoPanelHeight`
 * is about to compute one, and restoring first would show the previous session's height for a
 * frame before it was replaced (ADR-0015). Width and position are restored either way. The
 * height still gets *saved*, so turning the setting off leaves the panel where auto-height last
 * put it rather than jumping back to a size from days ago.
 *
 * Runs once the settings are loaded, not on mount: `autoHeight` decides what this does, and the
 * store answers a tick or two late.
 *
 * Everything here is best-effort — a failure must never stop the panel from rendering.
 */
export const usePersistedPanelFrame = (autoHeight: boolean, ready: boolean): void => {
  // Read at restore time rather than captured, so this effect does not re-run — and re-restore
  // the saved position over a window the user has since moved — every time the setting changes.
  const autoHeightRef = useRef(autoHeight);
  autoHeightRef.current = autoHeight;

  useEffect(() => {
    if (!isTauri() || !ready) return;

    let unlisten: (() => void)[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const run = async (): Promise<void> => {
      const [windowApi, store] = await Promise.all([
        import('@tauri-apps/api/window'),
        loadPanelStore(),
      ]);
      const {
        getCurrentWindow,
        availableMonitors,
        primaryMonitor,
        PhysicalPosition,
        PhysicalSize,
      } = windowApi;

      const panel = getCurrentWindow();
      const saved = parseWindowFrame(await store.get(FRAME_KEY));

      if (saved !== null && !cancelled) {
        const [primary, monitors, current] = await Promise.all([
          primaryMonitor(),
          availableMonitors(),
          panel.outerSize(),
        ]);
        const target = clampWindowPosition({
          frame: saved,
          monitors: workAreas(primary, monitors),
        });

        const height = autoHeightRef.current ? current.height : saved.height;
        await panel.setSize(new PhysicalSize(saved.width, height));
        await panel.setPosition(new PhysicalPosition(target?.x ?? saved.x, target?.y ?? saved.y));
      }

      const persist = async (): Promise<void> => {
        const [position, size] = await Promise.all([panel.outerPosition(), panel.outerSize()]);
        await store.set(FRAME_KEY, {
          x: position.x,
          y: position.y,
          width: size.width,
          height: size.height,
        });
      };

      const save = (): void => {
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(() => {
          persist().catch((error: unknown) => {
            console.warn('could not save the panel frame', error);
          });
        }, SAVE_DEBOUNCE_MS);
      };

      unlisten = await Promise.all([panel.onMoved(save), panel.onResized(save)]);
      if (cancelled) for (const stop of unlisten) stop();
    };

    run().catch((error: unknown) => {
      console.warn('panel frame persistence unavailable', error);
    });

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      for (const stop of unlisten) stop();
    };
  }, [ready]);
};
