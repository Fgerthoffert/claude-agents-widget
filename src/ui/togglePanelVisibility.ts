import { isTauri } from './isTauri';

/**
 * Shows the panel if it is hidden, hides it if it is not.
 *
 * Serves both the header's dismiss button and the tray's "Show/Hide Panel" item, which are the
 * same gesture from two places. The window is never closed: the app lives in the menu bar and
 * closing the only window would leave nothing to bring it back with.
 */
export const togglePanelVisibility = async (): Promise<void> => {
  if (!isTauri()) return;

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const panel = getCurrentWindow();

    if (await panel.isVisible()) {
      await panel.hide();
      return;
    }

    await panel.show();
    // Always-on-top can be lost when macOS moves the window between spaces; re-assert it on
    // every reveal so the panel comes back on top rather than behind whatever is in front.
    await panel.setAlwaysOnTop(true);
    await panel.setFocus();
  } catch (error) {
    console.error('could not toggle the panel', error);
  }
};
