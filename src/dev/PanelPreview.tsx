import { useMemo, useState } from 'react';

import { countSessionStates } from '../core/countSessionStates';
import { describeSession } from '../core/describeSession';
import { formatAggregate } from '../core/formatAggregate';
import { formatTimeInState } from '../core/formatTimeInState';
import { EmptyState } from '../ui/EmptyState';
import { PanelHeader } from '../ui/PanelHeader';
import { SessionRow } from '../ui/SessionRow';
import { useNowMs } from '../ui/useNowMs';
import { buildMockSessions } from './buildMockSessions';
import type { MockScenario } from './buildMockSessions';
import type { Session } from '../core/types';
import '../ui/panel.css';
import './preview.css';

const scenarios: readonly { readonly id: MockScenario; readonly label: string }[] = [
  { id: 'typical', label: 'Typical (6)' },
  { id: 'busy', label: 'Busy (12)' },
  { id: 'quiet', label: 'All quiet (3)' },
  { id: 'blocked', label: 'One blocked' },
  { id: 'empty', label: 'Empty' },
];

const home = '/Users/you';

/** What the row's ancestor chain says about where it runs, for the simulated focus log. */
const hostAppName = (session: Session): string => {
  const gui = session.ancestors.find((ancestor) => ancestor.args.includes('.app/'));
  if (gui === undefined) return 'an unknown host';

  const bundle = gui.args.split('/').find((part) => part.endsWith('.app'));

  return bundle === undefined ? 'an unknown host' : bundle.replace('.app', '');
};

/**
 * A browser harness for the panel: the real row, header and empty-state components, the real
 * stylesheet and the real description logic, driven by fake sessions instead of the detection
 * pipeline. It exists so the design can be judged without launching the native shell, where
 * every Tauri hook the panel uses (tray, window frame, drag regions) no-ops anyway.
 *
 * The panel markup below mirrors `Panel.tsx`; keep the two in step.
 */
export const PanelPreview = () => {
  const [scenario, setScenario] = useState<MockScenario>('typical');
  const [tall, setTall] = useState(false);
  const [lastAction, setLastAction] = useState(
    'Click a row: the real panel would focus that session’s window.',
  );
  const nowMs = useNowMs();

  // Ages are anchored to mount, not to every tick, so rows visibly age as you watch them.
  const [mountedMs] = useState(nowMs);
  const sessions = useMemo(() => buildMockSessions(scenario, mountedMs), [scenario, mountedMs]);
  const counts = countSessionStates(sessions);

  const onSelect = (session: Session) => {
    setLastAction(
      `focusSession('${session.sessionId}') → would raise ${hostAppName(session)} at ${session.cwd ?? 'an unknown path'}`,
    );
  };

  const panel = (theme: 'light' | 'dark') => (
    <div
      className={`preview__frame preview__frame--${theme}${tall ? ' preview__frame--tall' : ''}`}
    >
      <main className="panel">
        <PanelHeader
          aggregate={formatAggregate(counts)}
          attention={counts.needsInput > 0}
          onHide={() => {
            setLastAction(
              'Hide clicked: the real panel would hide until you reopen it from the menu bar.',
            );
          }}
        />
        {sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="panel__list">
            {sessions.map((session) => (
              <SessionRow
                key={session.sessionId}
                session={session}
                description={describeSession(session, home)}
                age={formatTimeInState(session, nowMs)}
                onSelect={onSelect}
              />
            ))}
          </ul>
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
        {scenarios.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`preview__button${scenario === id ? ' preview__button--active' : ''}`}
            onClick={() => {
              setScenario(id);
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className={`preview__button${tall ? ' preview__button--active' : ''}`}
          onClick={() => {
            setTall((previous) => !previous);
          }}
        >
          {tall ? 'Tall window' : 'Default height'}
        </button>
      </div>

      <div className="preview__stage">
        <div className="preview__slot">
          <span className="preview__label">Light</span>
          {panel('light')}
        </div>
        <div className="preview__slot">
          <span className="preview__label">Dark</span>
          {panel('dark')}
        </div>
      </div>

      <p className="preview__log">{lastAction}</p>
    </div>
  );
};
