/** The user's panel preferences, as persisted next to the window frame in `panel.json`. */
export interface PanelSettings {
  /** Fit the window height to the number of agents. On by default. */
  readonly autoHeight: boolean;
}

export const DEFAULT_PANEL_SETTINGS: PanelSettings = { autoHeight: true };

/**
 * Validates the settings blob read back from the store.
 *
 * `panel.json` is user-editable and survives upgrades, so anything in it is untrusted: absent on
 * first run, a shape from an older version, hand-edited nonsense. Every unreadable field falls
 * back to its default rather than disabling a behaviour the user never asked to disable — the
 * defaults are what a fresh install gets, and a corrupt file should not silently mean "off".
 */
export const parsePanelSettings = (value: unknown): PanelSettings => {
  if (typeof value !== 'object' || value === null) return DEFAULT_PANEL_SETTINGS;

  const { autoHeight } = value as Record<string, unknown>;

  return {
    autoHeight: typeof autoHeight === 'boolean' ? autoHeight : DEFAULT_PANEL_SETTINGS.autoHeight,
  };
};
