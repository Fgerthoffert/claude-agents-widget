import { focusSession } from '../detection/focusSession';
import { logToApp } from '../detection/logToApp';
import type { LastFocusOutcome } from '../core/evaluateSetupState';
import type { Session } from '../core/types';

/**
 * The one place a session click is acted on, from either the panel or the tray dropdown.
 *
 * `focusSession` (phase 4) never throws and always answers with a typed `FocusResult`
 * (`src/core/focus/types.ts`), so this seam only has to flatten it into the shape the setup
 * view and the diagnostics dump read: `method` on success — `window`, `tab`, or `app` when only
 * the owning application could be raised — and the failure reason otherwise.
 *
 * `permissionDenied` is kept even on success, because a click that fell back to app-level focus
 * *because macOS refused the precise attempt* is exactly the evidence the first-run guide needs
 * to tell the user their Accessibility grant is missing (ADR-0007). The PRD forbids a click
 * ever being a no-op; a rejected promise would still be a bug, so it is caught rather than left
 * to escape into a `void` call site.
 */
export const onSessionClick = async (session: Session): Promise<LastFocusOutcome> => {
  try {
    const result = await focusSession(session);

    // Every click leaves a line in the app log. It did not before, and the first real report
    // against the focus engine — "clicking it opens a new VS Code window" — had to be diagnosed
    // by reading the code and reasoning about which branch could possibly do that, because there
    // was no record of what had actually happened. ADR-0011's rule applied here too late
    // (ADR-0016). The session id is a UUID; nothing here logs a title.
    const id = session.sessionId.slice(0, 8);
    if (result.ok) {
      void logToApp(
        result.degradedFrom === null ? 'info' : 'warn',
        `focus ${id}: ${result.host} → ${result.method}` +
          (result.degradedFrom === null ? '' : ` (degraded from ${result.degradedFrom})`),
      );
    } else {
      void logToApp(
        'warn',
        `focus ${id}: ${result.host} failed — ${result.reason}${result.detail === null ? '' : `: ${result.detail}`}`,
      );
    }

    return result.ok
      ? {
          ok: true,
          method: result.method,
          permissionDenied: result.degradedFrom === 'permission-denied',
          degraded: result.degradedFrom !== null,
          detail: result.method,
        }
      : {
          ok: false,
          method: null,
          permissionDenied: result.reason === 'permission-denied',
          degraded: false,
          detail: result.reason,
        };
  } catch (error: unknown) {
    void logToApp('error', `focus ${session.sessionId.slice(0, 8)}: threw — ${String(error)}`);
    return {
      ok: false,
      method: null,
      permissionDenied: false,
      degraded: false,
      detail: 'focus_engine_error',
    };
  }
};
