import { countSessionStates } from '../core/countSessionStates';
import { formatAggregate } from '../core/formatAggregate';
import { useSessions } from './useSessions';
import './panel.css';

// Phase 2 placeholder: proves the detection pipeline reaches the UI. Phase 3 replaces the
// body with the real session list. `data-tauri-drag-region` makes the whole surface draggable.
export const Panel = () => {
  const sessions = useSessions();
  const counts = countSessionStates(sessions);

  return (
    <main className="panel" data-tauri-drag-region>
      <h1 className="panel__title">Claude Agents Widget</h1>
      {sessions.length === 0 ? (
        <p className="panel__empty">no sessions yet</p>
      ) : (
        <>
          <p className="panel__empty">
            {sessions.length} session{sessions.length === 1 ? '' : 's'} detected ·{' '}
            {formatAggregate(counts)}
          </p>
          <ul className="panel__list">
            {sessions.map((session) => (
              <li key={session.sessionId} className="panel__row">
                <span className="panel__row-title">{session.title ?? session.sessionId}</span>
                <span className="panel__row-state">{session.state}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
};
