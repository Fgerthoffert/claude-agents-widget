import { SessionRow } from './SessionRow';
import type { AgeDisplay } from '../core/describeAge';
import type { Session } from '../core/types';
import type { SessionDescription } from '../core/describeSession';

/** One row's worth of already-resolved presentation data. */
export interface GroupRow {
  readonly session: Session;
  readonly description: SessionDescription;
  readonly age: AgeDisplay | null;
}

interface SessionGroupProps {
  readonly label: string;
  readonly rows: readonly GroupRow[];
  readonly attention: boolean;
  /** The single session the panel is shouting about, if it is in this group. */
  readonly loudSessionId: string | null;
  /** The session whose click is still being acted on, if it is in this group. */
  readonly pendingSessionId: string | null;
  readonly onSelect: (session: Session) => void;
}

/**
 * A labelled section of the panel — "running" or "waiting for you".
 *
 * Each section scrolls on its own and is sized by its content up to half the list area, so one
 * long group cannot push the other off screen. The caller omits empty groups rather than
 * rendering a heading over nothing, which would spend the panel's scarcest resource (vertical
 * space) on the absence of work. The heading counts its rows: the count belongs next to what it
 * counts, not in a header above everything (ADR-0008). `aria-label` gives the section a name, so
 * a screen reader announces which half of the panel it has moved into.
 */
export const SessionGroup = ({
  label,
  rows,
  attention,
  loudSessionId,
  pendingSessionId,
  onSelect,
}: SessionGroupProps) => (
  <section className="group" aria-label={label} data-tauri-drag-region>
    <h2
      className={`group__heading${attention ? ' group__heading--attention' : ''}`}
      data-tauri-drag-region
    >
      {label}
      <span className="group__count">{rows.length}</span>
    </h2>
    <ul className="group__list" data-tauri-drag-region>
      {rows.map(({ session, description, age }) => (
        <SessionRow
          key={session.sessionId}
          session={session}
          description={description}
          age={age}
          loud={session.sessionId === loudSessionId}
          pending={session.sessionId === pendingSessionId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  </section>
);
