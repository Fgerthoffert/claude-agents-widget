import { useEffect, useMemo, useRef, useState } from 'react';

import { describeAge } from '../core/describeAge';
import { groupSessions } from '../core/groupSessions';
import { describeSession } from '../core/describeSession';
import { loudSessionId } from '../core/loudSessionId';
import { EmptyState } from '../ui/EmptyState';
import { PanelHeader } from '../ui/PanelHeader';
import { PanelLegend } from '../ui/PanelLegend';
import { PanelNotice } from '../ui/PanelNotice';
import { SessionGroup } from '../ui/SessionGroup';
import { SetupView } from '../ui/SetupView';
import { measurePanelContentHeight } from '../ui/measurePanelContentHeight';
import { useAcknowledged } from '../ui/useAcknowledged';
import { useNowMs } from '../ui/useNowMs';
import { buildMockSessions } from './buildMockSessions';
import type { MockScenario } from './buildMockSessions';
import type { Session } from '../core/types';
import '../ui/panel.css';
import './preview.css';

/** `setup` is not a session list, so it lives beside `MockScenario` rather than inside it. */
type PreviewScene = MockScenario | 'setup' | 'setup-done';

const scenes: readonly { readonly id: PreviewScene; readonly label: string }[] = [
  { id: 'typical', label: 'Typical (6)' },
  { id: 'busy', label: 'Busy (12)' },
  { id: 'quiet', label: 'All quiet (3)' },
  { id: 'blocked', label: 'One blocked' },
  { id: 'empty', label: 'Empty' },
  { id: 'setup', label: 'Setup' },
  { id: 'setup-done', label: 'Setup (done)' },
];

const isScene = (value: string): value is PreviewScene =>
  scenes.some((scene) => scene.id === value);

/** Everything the harness can be pointed at, as `#<scene>[+glass][+tall]`. */
interface PreviewRoute {
  readonly scene: PreviewScene;
  readonly glass: boolean;
  readonly tall: boolean;
}

/**
 * Reads the route out of the URL hash, so any state can be linked to, reloaded into, or
 * screenshotted from a command line — which is how this design gets reviewed when there is
 * nobody at the keyboard to click the buttons.
 */
const routeFromHash = (): PreviewRoute => {
  const parts = globalThis.location.hash.replace(/^#/, '').split('+');
  const scene = parts[0] ?? '';

  return {
    scene: isScene(scene) ? scene : 'typical',
    glass: parts.includes('glass'),
    tall: parts.includes('tall'),
  };
};

const writeHash = (route: PreviewRoute): void => {
  globalThis.location.hash = [route.scene, route.glass ? 'glass' : '', route.tall ? 'tall' : '']
    .filter((part) => part !== '')
    .join('+');
};

const home = '/Users/you';

/** Accessibility never proved, which is what a fresh install looks like. */
const setupTodo = {
  permissions: { status: 'unknown' as const, lastFocus: null },
  sessions: { total: 9, background: 2 },
};

/**
 * A click that reached a window, so the one step collapses to a heading and a chip.
 *
 * This is the short-content case, and the one that catches an auto-height measurement that can
 * only grow: `.setup__scroll` both stretches and scrolls, so a naive `scrollHeight` reports the
 * window's height rather than the content's whenever the content is the shorter of the two.
 */
const setupDone = {
  permissions: {
    status: 'done' as const,
    lastFocus: {
      ok: true,
      method: 'window' as const,
      permissionDenied: false,
      degraded: false,
      detail: 'window',
    },
  },
  sessions: { total: 9, background: 0 },
};

/**
 * A browser harness for the panel: the real row, header and empty-state components, the real
 * stylesheet and the real description logic, driven by fake sessions instead of the detection
 * pipeline. It exists so the design can be judged without launching the native shell, where
 * every Tauri hook the panel uses (tray, window frame, drag regions) no-ops anyway.
 *
 * The panel markup below mirrors `Panel.tsx`; keep the two in step. The chosen scene is kept in
 * the URL hash, so a state can be linked to, reloaded into, or screenshotted from the command
 * line — which is the only way the design gets reviewed without a person at the keyboard.
 */
export const PanelPreview = () => {
  const [route, setRoute] = useState<PreviewRoute>(routeFromHash);
  const { scene, glass, tall } = route;
  const [autoHeight, setAutoHeight] = useState(true);
  const frames = useRef<(HTMLDivElement | null)[]>([]);
  const [lastAction, setLastAction] = useState(
    'Click a row: the real panel would focus that session’s window.',
  );
  const nowMs = useNowMs();

  // Ages are anchored to mount, not to every tick, so rows visibly age as you watch them.
  const [mountedMs] = useState(nowMs);
  const isSetup = scene === 'setup' || scene === 'setup-done';
  const sessions = useMemo(
    () => (isSetup ? [] : buildMockSessions(scene, mountedMs)),
    [isSetup, scene, mountedMs],
  );
  const { seen, acknowledge } = useAcknowledged();
  const groups = groupSessions(sessions);
  // Same rule as the real panel: one loud row, and clicking it calms it (ADR-0013).
  const loud = loudSessionId(sessions, seen);
  const toRows = (group: readonly Session[]) =>
    group.map((session) => ({
      session,
      description: describeSession(session, home),
      age: describeAge(session, nowMs),
    }));

  const go = (change: Partial<PreviewRoute>) => {
    const next = { ...route, ...change };
    writeHash(next);
    setRoute(next);
  };

  const selectScene = (id: PreviewScene) => {
    go({ scene: id });
  };

  // The real thing resizes the window (`useAutoPanelHeight`); here the frame stands in for it,
  // running the same `measurePanelContentHeight` against the same layout. It is the only way to
  // see auto-height, and to check the measurement, without launching the native shell.
  useEffect(() => {
    for (const frame of frames.current) {
      if (frame === null) continue;
      const panel = frame.querySelector<HTMLElement>('.panel');
      frame.style.height =
        autoHeight && panel !== null ? `${String(measurePanelContentHeight(panel))}px` : '';
    }
    // No dependency list, matching `useAutoPanelHeight`: the height also depends on state inside
    // SetupView that nothing out here can see, so the only correct trigger is "after any commit".
  });

  const onSelect = (session: Session) => {
    acknowledge(session);
    setLastAction(
      `focusSession('${session.sessionId}') → would walk pid ${String(session.claudePid ?? 0)} to its window (${session.cwd ?? 'an unknown path'})`,
    );
  };

  const panel = (theme: 'light' | 'dark', index: number) => (
    <div
      ref={(node) => {
        frames.current[index] = node;
      }}
      // `data-theme` is what panel.css keys its palette off, so the frame gets the real tokens
      // rather than a copy of them.
      data-theme={theme}
      className={[
        'preview__frame',
        glass ? '' : 'preview__frame--opaque',
        tall ? 'preview__frame--tall' : '',
      ]
        .filter((part) => part !== '')
        .join(' ')}
    >
      <main className="panel">
        <PanelHeader
          onHide={() => {
            setLastAction(
              'Hide clicked: the real panel would hide until you reopen it from the menu bar.',
            );
          }}
        />
        {isSetup ? (
          <SetupView
            setup={scene === 'setup-done' ? setupDone : setupTodo}
            health={{ failure: null, degraded: [] }}
            buildIdentity="v0.8.0 (a1b2c3d)"
            logPath="/Users/you/Library/Logs/claude-agents-widget/app.log"
            onOpenPane={(pane) => {
              setLastAction(`Would open the ${pane} pane in System Settings.`);
            }}
            onCopyDiagnostics={() => {
              setLastAction('Would copy the diagnostics dump to the clipboard.');
            }}
            onClose={() => {
              selectScene('typical');
            }}
            autoHeight={autoHeight}
            onAutoHeightChange={setAutoHeight}
          />
        ) : groups.running.length === 0 &&
          groups.waiting.length === 0 &&
          groups.done.length === 0 &&
          groups.idle.length === 0 ? (
          <EmptyState
            failure={null}
            onOpenSetup={() => {
              setLastAction('Setup clicked: the real panel would open the setup view.');
            }}
          />
        ) : (
          <div className="panel__groups">
            {groups.running.length > 0 && (
              <SessionGroup
                label="Running"
                rows={toRows(groups.running)}
                attention={false}
                loudSessionId={loud}
                pendingSessionId={null}
                onSelect={onSelect}
              />
            )}
            {groups.waiting.length > 0 && (
              <SessionGroup
                label="Waiting for you"
                rows={toRows(groups.waiting)}
                attention
                loudSessionId={loud}
                pendingSessionId={null}
                onSelect={onSelect}
              />
            )}
            {groups.done.length > 0 && (
              <SessionGroup
                label="Done"
                rows={toRows(groups.done)}
                attention={false}
                loudSessionId={loud}
                pendingSessionId={null}
                onSelect={onSelect}
              />
            )}
            {groups.idle.length > 0 && (
              <SessionGroup
                label="Idle"
                rows={toRows(groups.idle)}
                attention={false}
                loudSessionId={loud}
                pendingSessionId={null}
                onSelect={onSelect}
              />
            )}
          </div>
        )}
        {!isSetup && (
          <>
            <PanelNotice
              message={
                scene === 'blocked'
                  ? 'Raised the app, not the window — grant Accessibility in Setup for an exact match.'
                  : null
              }
              onDismiss={() => {
                setLastAction('Notice dismissed.');
              }}
            />
            <PanelLegend appVersion="v0.9.0 (a1b2c3d)" claudeVersion="2.1.236" />
          </>
        )}
      </main>
    </div>
  );

  return (
    <div className="preview">
      <h1 className="preview__title">Claude Agents Widget — panel preview</h1>
      <p className="preview__note">
        The real components and stylesheet with fake sessions. Both themes are shown side by side;
        each frame is the true 320×400 window size. Window behaviour (always-on-top, dragging
        between monitors, the menu bar itself) exists only in the packaged app.
      </p>

      <div className="preview__controls">
        {scenes.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`preview__button${scene === id ? ' preview__button--active' : ''}`}
            onClick={() => {
              selectScene(id);
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className={`preview__button${tall ? ' preview__button--active' : ''}`}
          onClick={() => {
            go({ tall: !tall });
          }}
        >
          {tall ? 'Tall window' : 'Default height'}
        </button>
        <button
          type="button"
          className={`preview__button${autoHeight ? ' preview__button--active' : ''}`}
          onClick={() => {
            setAutoHeight((previous) => !previous);
          }}
        >
          {autoHeight ? 'Auto height' : 'Fixed height'}
        </button>
        <button
          type="button"
          className={`preview__button${glass ? ' preview__button--active' : ''}`}
          onClick={() => {
            go({ glass: !glass });
          }}
        >
          {glass ? 'Glass (as shipped)' : 'Opaque'}
        </button>
      </div>

      <div className="preview__stage">
        <div className="preview__slot">
          <span className="preview__label">Light</span>
          {panel('light', 0)}
        </div>
        <div className="preview__slot">
          <span className="preview__label">Dark</span>
          {panel('dark', 1)}
        </div>
      </div>

      <p className="preview__log">{lastAction}</p>
    </div>
  );
};
