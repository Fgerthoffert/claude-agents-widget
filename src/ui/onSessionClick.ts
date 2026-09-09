import { focusSession } from '../detection/focusSession';
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
    return result.ok
      ? {
          ok: true,
          method: result.method,
          permissionDenied: result.degradedFrom === 'permission-denied',
          detail: result.method,
        }
      : {
          ok: false,
          method: null,
          permissionDenied: result.reason === 'permission-denied',
          detail: result.reason,
        };
  } catch (error: unknown) {
    console.error('focusSession threw for', session.sessionId, error);
    return { ok: false, method: null, permissionDenied: false, detail: 'focus_engine_error' };
  }
};
