import { useEffect } from 'react';

import { clampWindowPosition } from '../core/clampWindowPosition';
import { parseWindowFrame } from '../core/parseWindowFrame';
import { isTauri } from './isTauri';
import type { ScreenRect } from '../core/clampWindowPosition';
import type { Monitor } from '@tauri-apps/api/window';

/** Written to the app config dir, so the panel comes back where the user left it. */
const STORE_FILE = 'panel.json';
const FRAME_KEY = 'frame';

/** A drag emits a move event per frame; only the resting position is worth writing. */
const SAVE_DEBOUNCE_MS = 500;

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
 * Everything here is best-effort — a failure must never stop the panel from rendering.
 */
export const usePersistedPanelFrame = (): void => {
  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void)[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const run = async (): Promise<void> => {
      const [windowApi, { load }] = await Promise.all([
        import('@tauri-apps/api/window'),
        import('@tauri-apps/plugin-store'),
      ]);
      const {
        getCurrentWindow,
        availableMonitors,
        primaryMonitor,
        PhysicalPosition,
        PhysicalSize,
      } = windowApi;

      const panel = getCurrentWindow();
      const store = await load(STORE_FILE, { autoSave: SAVE_DEBOUNCE_MS });
      const saved = parseWindowFrame(await store.get(FRAME_KEY));

      if (saved !== null && !cancelled) {
        const [primary, monitors] = await Promise.all([primaryMonitor(), availableMonitors()]);
        const target = clampWindowPosition({
          frame: saved,
          monitors: workAreas(primary, monitors),
        });

        await panel.setSize(new PhysicalSize(saved.width, saved.height));
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
  }, []);
};
