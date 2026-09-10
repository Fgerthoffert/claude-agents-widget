import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_PANEL_SETTINGS, parsePanelSettings } from '../core/parsePanelSettings';
import { PANEL_STORE_FILE, SETTINGS_KEY, loadPanelStore } from './panelStore';
import { isTauri } from './isTauri';
import type { PanelSettings } from '../core/parsePanelSettings';

export interface PanelSettingsState {
  readonly settings: PanelSettings;
  /** False until the store has answered, so nothing acts on a default that is about to change. */
  readonly ready: boolean;
  readonly setAutoHeight: (on: boolean) => void;
}

/**
 * The user's panel preferences, read from and written back to `panel.json`.
 *
 * `ready` matters more than it looks. Auto-height and the frame restore both key off
 * `autoHeight`, and the store answers a tick or two after mount — so acting on the default in
 * the meantime would resize the window once on the assumption it is on, and again when the file
 * says otherwise. Nothing touches the window until this is true.
 *
 * Outside the native shell (the browser preview harness) there is no store: the defaults stand
 * and `ready` flips immediately, so the harness behaves like a fresh install.
 */
export const usePanelSettings = (): PanelSettingsState => {
  const [settings, setSettings] = useState<PanelSettings>(DEFAULT_PANEL_SETTINGS);
  const [ready, setReady] = useState(!isTauri());

  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;

    loadPanelStore()
      .then(async (store) => {
        const stored = parsePanelSettings(await store.get(SETTINGS_KEY));
        if (!cancelled) {
          setSettings(stored);
          setReady(true);
        }
      })
      .catch((error: unknown) => {
        // A store that will not load must not leave the panel unusable: take the defaults.
        console.warn(`could not read ${PANEL_STORE_FILE}`, error);
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setAutoHeight = useCallback((on: boolean) => {
    setSettings((previous) => ({ ...previous, autoHeight: on }));

    if (!isTauri()) return;
    loadPanelStore()
      .then((store) => store.set(SETTINGS_KEY, { autoHeight: on }))
      .catch((error: unknown) => {
        console.error('could not save the panel settings', error);
      });
  }, []);

  return { settings, ready, setAutoHeight };
};
