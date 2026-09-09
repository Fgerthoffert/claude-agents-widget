import { useEffect, useMemo, useRef, useState } from 'react';

import { buildTrayModel } from '../core/buildTrayModel';
import { isTauri } from './isTauri';
import { onSessionClick } from './onSessionClick';
import { togglePanelVisibility } from './togglePanelVisibility';
import type { LastFocusOutcome } from '../core/evaluateSetupState';
import type { Session } from '../core/types';
import type { TrayModel } from '../core/buildTrayModel';
import type { Menu, MenuOptions } from '@tauri-apps/api/menu';

/** Must match `TrayIconBuilder::with_id` in src-tauri/src/lib.rs. */
const TRAY_ID = 'main';

/** What the dropdown can do beyond focusing a session. */
export interface TrayActions {
  readonly onOpenSetup: () => void;
  readonly onFocusResult: (outcome: LastFocusOutcome) => void;
}

/**
 * Builds the dropdown from the model plus the app-level items.
 *
 * Items are passed as plain option objects rather than constructed one by one: the native menu
 * is rebuilt whenever the session list changes, so the fewer resources created per rebuild the
 * better. Session actions read `sessionsRef` at click time, never a captured snapshot — the
 * list may have moved on between the menu opening and the user picking a line, and `actionsRef`
 * is read the same way so a new render's callbacks do not force a menu rebuild.
 */
const menuOptions = (
  model: TrayModel,
  autostart: boolean,
  sessionsRef: { current: readonly Session[] },
  actionsRef: { current: TrayActions },
  onAutostartToggle: () => void,
): MenuOptions => ({
  items: [
    { text: model.summary, enabled: false },
    { item: 'Separator' },
    ...model.items.map((item) => ({
      id: `session:${item.sessionId}`,
      text: item.text,
      action: () => {
        const session = sessionsRef.current.find(
          (candidate) => candidate.sessionId === item.sessionId,
        );
        if (session !== undefined) {
          void onSessionClick(session).then((outcome) => {
            actionsRef.current.onFocusResult(outcome);
          });
        }
      },
    })),
    ...(model.overflow > 0
      ? [{ text: `…and ${String(model.overflow)} more in the panel`, enabled: false }]
      : []),
    { item: 'Separator' },
    {
      text: 'Show/Hide Panel',
      action: () => {
        void togglePanelVisibility();
      },
    },
    // Permanently reachable, not only on first run: it is also the diagnostics dump.
    {
      text: 'Setup / Diagnostics',
      action: () => {
        actionsRef.current.onOpenSetup();
      },
    },
    { text: 'Launch at Login', checked: autostart, action: onAutostartToggle },
    { item: 'Separator' },
    {
      text: 'Quit',
      accelerator: 'CmdOrCtrl+Q',
      action: () => {
        void import('@tauri-apps/plugin-process').then(({ exit }) => exit(0));
      },
    },
  ],
});

/**
 * Keeps the menu bar in sync with the session store.
 *
 * The tray itself is created in Rust so that quitting still works if the webview never loads,
 * but its label and dropdown live here (ADR-0002, ADR-0008): the dropdown is a projection of
 * the same store the panel renders, and building it in TypeScript means one model, one code
 * path and no second polling loop.
 */
export const useTray = (sessions: readonly Session[], actions: TrayActions): void => {
  const model = useMemo(() => buildTrayModel(sessions), [sessions]);
  const [autostart, setAutostart] = useState(false);
  const sessionsRef = useRef(sessions);
  const actionsRef = useRef(actions);
  const menuRef = useRef<Menu | null>(null);
  sessionsRef.current = sessions;
  actionsRef.current = actions;

  useEffect(() => {
    if (!isTauri()) return;

    import('@tauri-apps/plugin-autostart')
      .then(async ({ isEnabled }) => {
        setAutostart(await isEnabled());
      })
      .catch((error: unknown) => {
        console.warn('could not read the launch-at-login setting', error);
      });
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    const state = { cancelled: false };

    const toggleAutostart = (): void => {
      void (async () => {
        try {
          const { enable, disable, isEnabled } = await import('@tauri-apps/plugin-autostart');
          if (await isEnabled()) await disable();
          else await enable();
          setAutostart(await isEnabled());
        } catch (error) {
          console.error('could not change the launch-at-login setting', error);
        }
      })();
    };

    const run = async (): Promise<void> => {
      const [{ TrayIcon }, { Menu: MenuApi }] = await Promise.all([
        import('@tauri-apps/api/tray'),
        import('@tauri-apps/api/menu'),
      ]);

      const tray = await TrayIcon.getById(TRAY_ID);
      if (tray === null) return;

      const menu = await MenuApi.new(
        menuOptions(model, autostart, sessionsRef, actionsRef, toggleAutostart),
      );
      // A newer session list arrived while we were building: that run owns the tray now.
      if (state.cancelled) {
        await menu.close();
        return;
      }

      // null, not '', is how Tauri spells "no title at all" — an empty string leaves the label
      // in place on some macOS versions, which would strand a `●` after the last session stopped.
      await tray.setTitle(model.label === '' ? null : model.label);
      await tray.setTooltip(model.summary);
      await tray.setMenu(menu);

      // Release the menu we just replaced, never the one on screen: the tray keeps its own
      // reference, and a menu rebuilt every few seconds would otherwise leak native handles.
      const stale = menuRef.current;
      menuRef.current = menu;
      await stale?.close();
    };

    run().catch((error: unknown) => {
      console.warn('could not update the tray', error);
    });

    return () => {
      state.cancelled = true;
    };
  }, [model, autostart]);
};
