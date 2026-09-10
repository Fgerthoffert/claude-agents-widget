import { useCallback, useMemo, useRef, useState } from 'react';

import { describeAge } from '../core/describeAge';
import { describeFocusOutcome } from '../core/describeFocusOutcome';
import { describeSession } from '../core/describeSession';
import { groupSessions } from '../core/groupSessions';
import { loudSessionId } from '../core/loudSessionId';
import { openSystemSettings } from '../detection/openSystemSettings';
import { EmptyState } from './EmptyState';
import { PanelHeader } from './PanelHeader';
import { PanelLegend } from './PanelLegend';
import { PanelNotice } from './PanelNotice';
import { SessionGroup } from './SessionGroup';
import { SetupView } from './SetupView';
import { copyDiagnostics } from './copyDiagnostics';
import { onSessionClick } from './onSessionClick';
import { showPanel } from './showPanel';
import { togglePanelVisibility } from './togglePanelVisibility';
import { useAcknowledged } from './useAcknowledged';
import { useAppVersion } from './useAppVersion';
import { useAutoPanelHeight } from './useAutoPanelHeight';
import { useHomeDir } from './useHomeDir';
import { useHookScriptRefresh } from './useHookScriptRefresh';
import { useLogPath } from './useLogPath';
import { useNowMs } from './useNowMs';
import { usePanelSettings } from './usePanelSettings';
import { usePersistedPanelFrame } from './usePersistedPanelFrame';
import { useSessions } from './useSessions';
import { useSetupState } from './useSetupState';
import { useTray } from './useTray';
import { useWindowDragOnMove } from './useWindowDragOnMove';
import type { GroupRow } from './SessionGroup';
import type { LastFocusOutcome } from '../core/evaluateSetupState';
import type { Session } from '../core/types';
import './panel.css';

/**
 * The always-on-top floating panel, split into the three things the user actually distinguishes:
 * **Running** (busy, needs nothing), **Waiting for you** (blocked on an answer and unable to
 * proceed) and **Done** (stopped, and not blocked).
 *
 * Waiting used to hold finished sessions too, which made the heading claim more than it meant
 * (ADR-0014). Order inside each section comes from the store (`needs_input` before `done_idle`,
 * then most recent first) and is deliberately not touched here — emphasis is styling only, so a
 * row never moves under the user's cursor. An empty section renders nothing at all: vertical
 * space is the panel's scarcest resource and a heading over no rows spends it on an absence.
 *
 * The window fits itself to whatever is on screen (ADR-0015) — including the setup view, which
 * is why this component simply attaches a ref and lets the hook re-measure after every commit
 * rather than trying to describe when the height might have changed.
 *
 * Exactly one row is ever loud, and clicking it makes it calm: this component owns the
 * acknowledgement map and hands `loudSessionId` the decision (ADR-0013). It also owns what
 * happens *after* a click — the row shows it is working, a repeat press is ignored while the
 * first is in flight, and anything short of "the exact window came forward" is said out loud in
 * a notice rather than left for the user to guess at.
 *
 * The panel is also where setup lives. It opens on the setup view by itself when the hooks are
 * not installed, because until they are there is nothing else for it to show; the tray's
 * "Setup / Diagnostics" reopens it at any time (ADR-0009).
 *
 * It can be dragged from anywhere: `data-tauri-drag-region` handles its own background (Tauri
 * matches the attribute on the element under the cursor, not on its ancestors), and
 * `useWindowDragOnMove` covers everything else — a press that moves starts a window drag, a
 * press that does not stays a click on the row (ADR-0008).
 */
export const Panel = () => {
  const { sessions, health } = useSessions();
  const nowMs = useNowMs();
  const home = useHomeDir();
  const buildIdentity = useAppVersion();
  const logPath = useLogPath();
  const [lastFocus, setLastFocus] = useState<LastFocusOutcome | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [setupDismissed, setSetupDismissed] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { seen, acknowledge } = useAcknowledged();
  const { settings, ready: settingsReady, setAutoHeight } = usePanelSettings();
  const setup = useSetupState(sessions, lastFocus);
  // Read at click time, never captured: a second press while the first is still running would
  // otherwise queue another AppleScript behind it and land the user somewhere twice.
  const inFlight = useRef(false);

  useHookScriptRefresh();
  usePersistedPanelFrame(settings.autoHeight, settingsReady);
  const { onMouseDown, consumeDrag } = useWindowDragOnMove();

  const openSetup = useCallback(() => {
    setShowSetup(true);
    void showPanel();
  }, []);

  const reportFocus = useCallback((outcome: LastFocusOutcome) => {
    setLastFocus(outcome);
    setNotice(describeFocusOutcome(outcome));
  }, []);

  useTray(sessions, {
    onOpenSetup: openSetup,
    onFocusResult: reportFocus,
    onAcknowledge: acknowledge,
  });

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

  const handleSelect = useCallback(
    (session: Session) => {
      // The click that ends a drag is not a click on the row it happened over.
      if (consumeDrag() || inFlight.current) return;

      // Going to look at a session is the user saying they know about it, whether or not the
      // window turns out to be reachable — so the row calms down immediately, not on success.
      acknowledge(session);
      inFlight.current = true;
      setPendingSessionId(session.sessionId);
      setNotice(null);

      void onSessionClick(session).then((outcome) => {
        inFlight.current = false;
        setPendingSessionId(null);
        reportFocus(outcome);
      });
    },
    [consumeDrag, acknowledge, reportFocus],
  );

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
      health,
    });
  }, [setup.setup, setup.hookPath, setup.settingsPath, health]);

  const handleOpenPane = useCallback((pane: 'automation' | 'accessibility') => {
    void openSystemSettings(pane);
  }, []);

  const handleDismissNotice = useCallback(() => {
    setNotice(null);
  }, []);

  const handleOpenAccessibility = useCallback(() => {
    void openSystemSettings('accessibility');
  }, []);

  const loud = useMemo(() => loudSessionId(sessions, seen), [sessions, seen]);

  const empty =
    groups.running.length === 0 && groups.waiting.length === 0 && groups.done.length === 0;
  // Auto-open only once the probe has really run, so the placeholder state never flashes it up.
  const setupOpen = showSetup || (setup.ready && setup.setup.needsSetup && !setupDismissed);

  const { panelRef } = useAutoPanelHeight(settings.autoHeight && settingsReady);

  return (
    <main className="panel" ref={panelRef} onMouseDown={onMouseDown} data-tauri-drag-region>
      <PanelHeader onHide={handleHide} />
      {setupOpen ? (
        <SetupView
          setup={setup.setup}
          health={health}
          buildIdentity={buildIdentity}
          logPath={logPath}
          hookPath={setup.hookPath}
          settingsPath={setup.settingsPath}
          preview={setup.preview}
          busy={setup.busy}
          outcome={setup.outcome}
          onInstall={setup.install}
          onOpenPane={handleOpenPane}
          onCopyDiagnostics={handleCopyDiagnostics}
          onClose={handleCloseSetup}
          autoHeight={settings.autoHeight}
          onAutoHeightChange={setAutoHeight}
        />
      ) : (
        <>
          {empty ? (
            <EmptyState
              hooksInstalled={setup.setup.hooks.status === 'done'}
              failure={health.failure}
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
                  loudSessionId={loud}
                  pendingSessionId={pendingSessionId}
                  onSelect={handleSelect}
                />
              )}
              {groups.waiting.length > 0 && (
                <SessionGroup
                  label="Waiting for you"
                  rows={toRows(groups.waiting)}
                  attention
                  loudSessionId={loud}
                  pendingSessionId={pendingSessionId}
                  onSelect={handleSelect}
                />
              )}
              {groups.done.length > 0 && (
                <SessionGroup
                  label="Done"
                  rows={toRows(groups.done)}
                  attention={false}
                  loudSessionId={loud}
                  pendingSessionId={pendingSessionId}
                  onSelect={handleSelect}
                />
              )}
            </div>
          )}
          <PanelNotice
            message={notice}
            onGrantAccess={
              lastFocus?.permissionDenied === true ? handleOpenAccessibility : undefined
            }
            onDismiss={handleDismissNotice}
          />
          <PanelLegend />
        </>
      )}
    </main>
  );
};
