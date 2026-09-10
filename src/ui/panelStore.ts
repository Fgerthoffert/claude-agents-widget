import type { Store } from '@tauri-apps/plugin-store';

/** Written to the app config dir, so the panel comes back as the user left it. */
export const PANEL_STORE_FILE = 'panel.json';

/** Window position and size, in physical pixels. */
export const FRAME_KEY = 'frame';

/** User preferences — see `parsePanelSettings`. */
export const SETTINGS_KEY = 'settings';

/** A drag emits a move event per frame; only the resting position is worth writing. */
export const SAVE_DEBOUNCE_MS = 500;

/**
 * The one handle on `panel.json`, shared by the frame and the settings.
 *
 * `load` is idempotent per path — the plugin returns the same store for the same file — so the
 * two callers do not fight, and neither has to know the other exists. Keeping the file name and
 * its keys here rather than in either caller is what stops them drifting apart.
 */
export const loadPanelStore = async (): Promise<Store> => {
  const { load } = await import('@tauri-apps/plugin-store');
  return load(PANEL_STORE_FILE, { autoSave: SAVE_DEBOUNCE_MS });
};
