import { useCallback, useMemo } from 'react';

import { describeAge } from '../core/describeAge';
import { describeSession } from '../core/describeSession';
import { groupSessions } from '../core/groupSessions';
import { EmptyState } from './EmptyState';
import { PanelHeader } from './PanelHeader';
import { PanelLegend } from './PanelLegend';
import { SessionGroup } from './SessionGroup';
import { onSessionClick } from './onSessionClick';
import { togglePanelVisibility } from './togglePanelVisibility';
import { useHomeDir } from './useHomeDir';
import { useNowMs } from './useNowMs';
import { usePersistedPanelFrame } from './usePersistedPanelFrame';
import { useSessions } from './useSessions';
import { useTray } from './useTray';
import type { GroupRow } from './SessionGroup';
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
 * `data-tauri-drag-region` on this element, the sections and their lists makes the panel's own
 * background draggable while leaving rows clickable: Tauri matches the attribute on the element
 * under the cursor, not on its ancestors (ADR-0008).
 */
export const Panel = () => {
  const sessions = useSessions();
  const nowMs = useNowMs();
  const home = useHomeDir();

  usePersistedPanelFrame();
  useTray(sessions);

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
    void onSessionClick(session);
  }, []);

  const handleHide = useCallback(() => {
    void togglePanelVisibility();
  }, []);

  const empty = groups.running.length === 0 && groups.waiting.length === 0;

  return (
    <main className="panel" data-tauri-drag-region>
      <PanelHeader onHide={handleHide} />
      {empty ? (
        <EmptyState />
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
    </main>
  );
};
