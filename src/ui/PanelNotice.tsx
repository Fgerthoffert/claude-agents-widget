import { useEffect } from 'react';

interface PanelNoticeProps {
  /** What to say, or `null` when the last click needed no explanation. */
  readonly message: string | null;
  /**
   * Offered only when the last click was refused by macOS — the one failure the user can fix,
   * and the one they will never go looking for. Absent otherwise: a notice with a button that
   * does not help is worse than a notice.
   */
  readonly onGrantAccess?: (() => void) | undefined;
  readonly onDismiss: () => void;
}

/** Long enough to read one line twice, short enough not to become panel furniture. */
const DISMISS_AFTER_MS = 8_000;

/**
 * A one-line answer to "what happened when I clicked that?", above the legend.
 *
 * The PRD forbids a click ever being a no-op, and the focus engine has always returned a typed
 * result — but nothing rendered it, so a click that could not find its window looked exactly
 * like a click that worked. This is where it gets said (ADR-0013).
 *
 * It occupies no space when there is nothing to say, and it takes the place of no rows: the
 * panel's whole value is the list, and a message that pushed a session off the bottom would
 * cost more than it explains. `role="status"` rather than `role="alert"` — it reports on
 * something the user just did, so it does not need to interrupt them.
 *
 * When macOS refused the click it also carries the way out, because "grant Accessibility in
 * Setup" is three navigations away from the row the user just pressed, and the grant is voided
 * by every app update — so this is a message they will see again and again (ADR-0016).
 */
export const PanelNotice = ({ message, onGrantAccess, onDismiss }: PanelNoticeProps) => {
  useEffect(() => {
    if (message === null) return;

    const timer = setTimeout(onDismiss, DISMISS_AFTER_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [message, onDismiss]);

  if (message === null) return null;

  return (
    <div className="panel__notice" role="status">
      <span className="panel__notice-text">
        {message}
        {onGrantAccess !== undefined && (
          <>
            {' '}
            <button type="button" className="panel__notice-action" onClick={onGrantAccess}>
              Open Accessibility
            </button>
          </>
        )}
      </span>
      <button
        type="button"
        className="panel__notice-dismiss"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        ✕
      </button>
    </div>
  );
};
