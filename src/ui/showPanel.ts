import { isTauri } from './isTauri';

/**
 * Reveals the panel without toggling it away when it is already visible.
 *
 * The tray's "Setup / Diagnostics" item has to end with the user looking at the panel, so it
 * needs "show" rather than the "show or hide" the toggle offers. Always-on-top is re-asserted
 * on every reveal for the same reason `togglePanelVisibility` does it: macOS can drop the flag
 * when it moves a window between spaces.
 */
export const showPanel = async (): Promise<void> => {
  if (!isTauri()) return;

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const panel = getCurrentWindow();
    await panel.show();
    await panel.setAlwaysOnTop(true);
    await panel.setFocus();
  } catch (error) {
    console.error('could not show the panel', error);
  }
};
