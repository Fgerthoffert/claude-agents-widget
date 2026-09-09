import { getCurrentWindow } from '@tauri-apps/api/window';

import { isTauri } from './isTauri';

/**
 * Hands the window over to the compositor for a native drag.
 *
 * `data-tauri-drag-region` covers the panel's own background, but with a full list there is
 * barely any background left, so pressing and moving anywhere calls this instead. Needs the
 * `core:window:allow-start-dragging` capability — without it the call, and every drag region on
 * the page, silently does nothing (ADR-0008).
 */
export const startWindowDrag = async (): Promise<void> => {
  if (!isTauri()) return;

  await getCurrentWindow().startDragging();
};
