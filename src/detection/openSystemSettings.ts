import { Command } from '@tauri-apps/plugin-shell';

/** The two consent surfaces the focus engine needs (ADR-0007). */
export type SystemSettingsPane = 'automation' | 'accessibility';

const URLS: Record<SystemSettingsPane, string> = {
  automation: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
};

/**
 * Opens the System Settings pane where a permission is granted.
 *
 * Neither grant can be made programmatically, and pretending otherwise would be the worst
 * possible first-run experience — so the app takes the user to the exact pane and says what to
 * tick. The URL is one of two constants and the allowlist in `capabilities/default.json`
 * restricts the argument to the `x-apple.systempreferences:` scheme, so nothing session-derived
 * can reach `open`.
 */
export const openSystemSettings = async (pane: SystemSettingsPane): Promise<boolean> => {
  try {
    const { code } = await Command.create('open-settings-pane', [URLS[pane]]).execute();
    return code === 0;
  } catch (error) {
    console.error('could not open System Settings', error);
    return false;
  }
};
