import { useCallback, useMemo } from 'react';

import { describeAge } from '../core/describeAge';
import { describeSession } from '../core/describeSession';
import { EmptyState } from './EmptyState';
import { PanelHeader } from './PanelHeader';
import { PanelLegend } from './PanelLegend';
import { SessionRow } from './SessionRow';
import { onSessionClick } from './onSessionClick';
import { togglePanelVisibility } from './togglePanelVisibility';
import { useHomeDir } from './useHomeDir';
import { useNowMs } from './useNowMs';
import { usePersistedPanelFrame } from './usePersistedPanelFrame';
import { useSessions } from './useSessions';
import { useTray } from './useTray';
import type { Session } from '../core/types';
import './panel.css';

/**
 * The always-on-top floating panel: one row per session, ordered by what needs attention.
 *
 * The order comes from the store already (`needs_input` → `working` → `done_idle` → `ended`,
 * then most recent first) and is deliberately not touched here — emphasis is styling only, so
 * a row never moves under the user's cursor.
 *
 * `data-tauri-drag-region` on this element and on the list makes the panel's own background
 * draggable while leaving rows clickable: Tauri matches the attribute on the element under the
 * cursor, not on its ancestors (ADR-0008).
 */
export const Panel = () => {
  const sessions = useSessions();
  const nowMs = useNowMs();
  const home = useHomeDir();

  usePersistedPanelFrame();
  useTray(sessions);

  const rows = useMemo(
    () => sessions.map((session) => ({ session, description: describeSession(session, home) })),
    [sessions, home],
  );

  const handleSelect = useCallback((session: Session) => {
    void onSessionClick(session);
  }, []);

  const handleHide = useCallback(() => {
    void togglePanelVisibility();
  }, []);

  return (
    <main className="panel" data-tauri-drag-region>
      <PanelHeader onHide={handleHide} />
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="panel__list" data-tauri-drag-region>
          {rows.map(({ session, description }) => (
            <SessionRow
              key={session.sessionId}
              session={session}
              description={description}
              age={describeAge(session, nowMs)}
              onSelect={handleSelect}
            />
          ))}
        </ul>
      )}
      <PanelLegend />
    </main>
  );
};
