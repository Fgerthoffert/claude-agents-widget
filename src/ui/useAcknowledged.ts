import { useCallback, useState } from 'react';

import type { Session } from '../core/types';

/** Session id -> the `updatedAt` the user was last shown, plus the recorder. */
export interface Acknowledged {
  readonly seen: ReadonlyMap<string, string>;
  readonly acknowledge: (session: Session) => void;
}

/**
 * Remembers which session events the user has already been to.
 *
 * Deliberately in memory only. This is attention state, not data: relaunching the widget is a
 * fresh glance at the desk, and a blocked session the user has never looked at *in this sitting*
 * should shout again. Persisting it would mean a session could go permanently quiet because of a
 * click a week ago.
 *
 * Entries are never pruned. A session id is a UUID and an entry is one short string, so a very
 * long-running widget holds a few kilobytes of dead keys — cheaper than the bookkeeping to notice
 * a session has left the store and might come back on the next sweep.
 */
export const useAcknowledged = (): Acknowledged => {
  const [seen, setSeen] = useState<ReadonlyMap<string, string>>(new Map());

  const acknowledge = useCallback((session: Session) => {
    setSeen((previous) =>
      previous.get(session.sessionId) === session.updatedAt
        ? previous
        : new Map(previous).set(session.sessionId, session.updatedAt),
    );
  }, []);

  return { seen, acknowledge };
};
