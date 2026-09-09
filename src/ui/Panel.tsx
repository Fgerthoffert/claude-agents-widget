import { useCallback, useMemo, useState } from 'react';

import { describeAge } from '../core/describeAge';
import { describeSession } from '../core/describeSession';
import { groupSessions } from '../core/groupSessions';
import { openSystemSettings } from '../detection/openSystemSettings';
import { EmptyState } from './EmptyState';
import { PanelHeader } from './PanelHeader';
import { PanelLegend } from './PanelLegend';
import { SessionGroup } from './SessionGroup';
import { SetupView } from './SetupView';
import { copyDiagnostics } from './copyDiagnostics';
import { onSessionClick } from './onSessionClick';
import { showPanel } from './showPanel';
import { togglePanelVisibility } from './togglePanelVisibility';
import { useHomeDir } from './useHomeDir';
import { useNowMs } from './useNowMs';
import { usePersistedPanelFrame } from './usePersistedPanelFrame';
import { useSessions } from './useSessions';
import { useSetupState } from './useSetupState';
import { useTray } from './useTray';
import type { GroupRow } from './SessionGroup';
import type { LastFocusOutcome } from '../core/evaluateSetupState';
import type { Session } from '../core/types';
import './panel.css';

/**
 * The always-on-top floating panel, split into the two things the user actually distinguishes:
 * sessions that are running and need nothing, and sessions that have stopped and need them.
 *
 * Running sits on top: it is the half that changes on its own, and it keeps the section the
 * user has to act on adjacent to the legend that explains it. Order inside each section comes
 * from the store (`needs_input` before `done_idle`, then most recent first) and is deliberately
 * not touched here — emphasis is styling only, so a row never moves under the user's cursor.
 *
 * The panel is also where setup lives. It opens on the setup view by itself when the hooks are
 * not installed, because until they are there is nothing else for it to show; the tray's
 * "Setup / Diagnostics" reopens it at any time (ADR-0009).
 *
 * `data-tauri-drag-region` on this element, the sections and their lists makes the panel's own
 * background draggable while leaving rows clickable: Tauri matches the attribute on the element
 * under the cursor, not on its ancestors (ADR-0008).
 */
export const Panel = () => {
  const sessions = useSessions();
  const nowMs = useNowMs();
  const home = useHomeDir();
  const [lastFocus, setLastFocus] = useState<LastFocusOutcome | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [setupDismissed, setSetupDismissed] = useState(false);
  const setup = useSetupState(sessions, lastFocus);

  usePersistedPanelFrame();

  const openSetup = useCallback(() => {
    setShowSetup(true);
    void showPanel();
  }, []);

  useTray(sessions, { onOpenSetup: openSetup, onFocusResult: setLastFocus });

  const groups = useMemo(() => groupSessions(sessions), [sessions]);
  const toRows = useCallback(
    (group: readonly Session[]): readonly GroupRow[] =>
      group.map((session) => ({
        session,
        description: describeSession(session, home),
        age: describeAge(session, nowMs),
      })),
    [home, nowMs],
  );

  const handleSelect = useCallback((session: Session) => {
    void onSessionClick(session).then(setLastFocus);
  }, []);

  const handleHide = useCallback(() => {
    void togglePanelVisibility();
  }, []);

  const handleCloseSetup = useCallback(() => {
    setShowSetup(false);
    setSetupDismissed(true);
  }, []);

  const handleCopyDiagnostics = useCallback(() => {
    void copyDiagnostics({
      setup: setup.setup,
      hookPath: setup.hookPath,
      settingsPath: setup.settingsPath,
    });
  }, [setup.setup, setup.hookPath, setup.settingsPath]);

  const handleOpenPane = useCallback((pane: 'automation' | 'accessibility') => {
    void openSystemSettings(pane);
  }, []);

  const empty = groups.running.length === 0 && groups.waiting.length === 0;
  // Auto-open only once the probe has really run, so the placeholder state never flashes it up.
  const setupOpen = showSetup || (setup.ready && setup.setup.needsSetup && !setupDismissed);

  return (
    <main className="panel" data-tauri-drag-region>
      <PanelHeader onHide={handleHide} />
      {setupOpen ? (
        <SetupView
          setup={setup.setup}
          hookPath={setup.hookPath}
          settingsPath={setup.settingsPath}
          preview={setup.preview}
          busy={setup.busy}
          outcome={setup.outcome}
          onInstall={setup.install}
          onOpenPane={handleOpenPane}
          onCopyDiagnostics={handleCopyDiagnostics}
          onClose={handleCloseSetup}
        />
      ) : (
        <>
          {empty ? (
            <EmptyState
              hooksInstalled={setup.setup.hooks.status === 'done'}
              busy={setup.busy}
              outcome={setup.outcome}
              onInstall={setup.install}
              onOpenSetup={openSetup}
            />
          ) : (
            <div className="panel__groups" data-tauri-drag-region>
              {groups.running.length > 0 && (
                <SessionGroup
                  label="Running"
                  rows={toRows(groups.running)}
                  attention={false}
                  onSelect={handleSelect}
                />
              )}
              {groups.waiting.length > 0 && (
                <SessionGroup
                  label="Waiting for you"
                  rows={toRows(groups.waiting)}
                  attention={groups.waiting.some((session) => session.state === 'needs_input')}
                  onSelect={handleSelect}
                />
              )}
            </div>
          )}
          <PanelLegend />
        </>
      )}
    </main>
  );
};
