import { isTauri } from './isTauri';

/**
 * Re-asserts the window properties that keep the panel drawn inside another app's full-screen
 * Space: `NSStatusWindowLevel`, `FullScreenAuxiliary | CanJoinAllSpaces`, and the non-activating
 * panel style bit (ADR-0010).
 *
 * Rust owns *how* (`src-tauri/src/floating_panel.rs`, the only thing it could own — none of this
 * is reachable from TypeScript); this decides *when*. The startup assertion happens in Rust's
 * `setup`, so the reveals are what is left: `setAlwaysOnTop(true)` rewrites the level back down
 * to 3, so callers must run this **after** it, never before.
 *
 * Failure is logged rather than thrown: the panel is still usable at the floating level, and an
 * app-local command that is missing produces no ACL error to notice, so the only signal there
 * would ever be is this line.
 */
export const floatPanelAboveFullScreen = async (): Promise<void> => {
  if (!isTauri()) return;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('float_panel_above_full_screen');
  } catch (error) {
    console.error('could not float the panel above full-screen apps', error);
  }
};
