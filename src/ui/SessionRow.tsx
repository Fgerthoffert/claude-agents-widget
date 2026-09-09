import { memo } from 'react';

import { sessionEmoji } from '../core/sessionEmoji';
import type { AgeDisplay } from '../core/describeAge';
import type { Session } from '../core/types';
import type { SessionDescription } from '../core/describeSession';

interface SessionRowProps {
  readonly session: Session;
  readonly description: SessionDescription;
  /** Time in the current state, or `null` when it is not known (scanner-only sessions). */
  readonly age: AgeDisplay | null;
  /** The one row the panel is shouting about, if this is it (`loudSessionId`). */
  readonly loud: boolean;
  /** A click on this row is still being acted on. */
  readonly pending: boolean;
  readonly onSelect: (session: Session) => void;
}

/**
 * One session, in 32 pixels: state emoji, name over path, age.
 *
 * The name is the primary content — identifying a session at a glance is the whole point of
 * this panel — so it takes the full width it can and truncates rather than wraps.
 *
 * Emphasis comes in two strengths (ADR-0013). Every blocked session gets `row--blocked`: an
 * amber accent bar and an amber reason, enough to separate "stopped and stuck" from "stopped and
 * finished" at a glance. Exactly one gets `row--loud` on top of that — the wash, the pulse and
 * the heavier title. Which one is not this component's business; the panel decides.
 *
 * A `<button>` rather than a clickable `<li>`: rows are the panel's one interactive element,
 * and this gets keyboard focus, Enter/Space and screen-reader semantics for free. It carries
 * no `data-tauri-drag-region`, which is what keeps a click on a row from starting a window
 * drag (ADR-0008). Both glyphs are decorative, so the accessible name spells out the state and
 * what the duration measures.
 *
 * Memoised on props that are all either stable references or short strings, so the panel's
 * one-second clock only re-renders the rows whose age label actually changed.
 */
export const SessionRow = memo(
  ({ session, description, age, loud, pending, onSelect }: SessionRowProps) => (
    <li>
      <button
        type="button"
        className={[
          'row',
          session.state === 'needs_input' ? 'row--blocked' : '',
          loud ? 'row--loud' : '',
          pending ? 'row--pending' : '',
        ]
          .filter((part) => part !== '')
          .join(' ')}
        data-state={session.state}
        title={description.tooltip}
        // A click already being acted on: say so rather than letting a repeat press queue a
        // second AppleScript behind the first.
        aria-busy={pending}
        aria-label={[description.title, description.stateLabel, description.detail, age?.label]
          .filter((part) => part !== undefined && part !== '')
          .join(' — ')}
        onClick={() => {
          onSelect(session);
        }}
      >
        <span className="row__emoji" aria-hidden="true">
          {sessionEmoji(session.state)}
        </span>
        <span className="row__body">
          <span className="row__title">{description.title}</span>
          <span className="row__detail">{description.detail}</span>
        </span>
        <span className={`row__age${age === null ? '' : ` row__age--${age.kind}`}`}>
          {pending ? (
            <span className="row__spinner" aria-hidden="true" />
          ) : age === null ? (
            ''
          ) : (
            <>
              <span className="row__age-icon" aria-hidden="true">
                {age.icon}
              </span>
              {age.text}
            </>
          )}
        </span>
      </button>
    </li>
  ),
);
