import { focusSession } from '../detection/focusSession';
import type { Session } from '../core/types';

/** What a click achieved, so the caller can say so instead of guessing. */
export interface SessionClickResult {
  readonly ok: boolean;
  /** `window` | `tab` | `app` on success; a machine-readable reason on failure. */
  readonly detail: string;
}

/**
 * The one place a session click is acted on, from either the panel or the tray dropdown.
 *
 * `focusSession` (phase 4) never throws and always answers with a typed `FocusResult`
 * (`src/core/focus/types.ts`), so this seam only has to flatten it: `method` on success —
 * `window`, `tab`, or `app` when only the owning application could be raised — and `reason` on
 * failure. The PRD forbids a click ever being a no-op, and the focus engine's degradation chain
 * is what guarantees that; a rejected promise would still be a bug, so it is caught rather than
 * left to escape into a `void` call site.
 */
export const onSessionClick = async (session: Session): Promise<SessionClickResult> => {
  try {
    const result = await focusSession(session);
    return { ok: result.ok, detail: result.ok ? result.method : result.reason };
  } catch (error: unknown) {
    console.error('focusSession threw for', session.sessionId, error);
    return { ok: false, detail: 'focus_engine_error' };
  }
};
