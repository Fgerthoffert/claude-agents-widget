import { memo } from 'react';

import type { Session } from '../core/types';
import type { SessionDescription } from '../core/describeSession';

interface SessionRowProps {
  readonly session: Session;
  readonly description: SessionDescription;
  /** Time in the current state, or `null` when it is not known (scanner-only sessions). */
  readonly age: string | null;
  readonly onSelect: (session: Session) => void;
}

/**
 * One session, in 32 pixels: state dot, name over path, age.
 *
 * The name is the primary content — identifying a session at a glance is the whole point of
 * this panel — so it takes the full width it can and truncates rather than wraps.
 *
 * A `<button>` rather than a clickable `<li>`: rows are the panel's one interactive element,
 * and this gets keyboard focus, Enter/Space and screen-reader semantics for free. It carries
 * no `data-tauri-drag-region`, which is what keeps a click on a row from starting a window
 * drag (ADR-0008). The state is encoded in colour on screen, so the accessible name spells it
 * out.
 *
 * Memoised on props that are all either stable references or short strings, so the panel's
 * one-second clock only re-renders the rows whose age label actually changed.
 */
export const SessionRow = memo(({ session, description, age, onSelect }: SessionRowProps) => (
  <li>
    <button
      type="button"
      className={`row${session.state === 'needs_input' ? ' row--attention' : ''}`}
      data-state={session.state}
      title={description.tooltip}
      aria-label={[description.title, description.stateLabel, description.detail, age]
        .filter((part) => part !== null && part !== '')
        .join(' — ')}
      onClick={() => {
        onSelect(session);
      }}
    >
      <span className="row__dot" aria-hidden="true" />
      <span className="row__body">
        <span className="row__title">{description.title}</span>
        <span className="row__detail">{description.detail}</span>
      </span>
      <span className="row__age">{age ?? ''}</span>
    </button>
  </li>
));
