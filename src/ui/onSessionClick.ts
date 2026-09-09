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
 * Phase 4 owns the focus engine and exports `focusSession(session): Promise<FocusResult>` from
 * `src/detection/focusSession.ts`, where `FocusResult` (`src/core/focus/types.ts`) is
 * `{ok: true, host, method, degradedFrom, detail}` or `{ok: false, host, reason, detail}`.
 * The two phases are being built in parallel, so this seam exists to give that engine exactly
 * one wiring point: when the module lands, the body becomes
 *
 * ```ts
 * const { focusSession } = await import('../detection/focusSession');
 * const result = await focusSession(session);
 * return { ok: result.ok, detail: result.ok ? result.method : result.reason };
 * ```
 *
 * Until then a click is a logged no-op rather than a crash — the honest behaviour for a
 * feature that does not exist yet, and the one thing the PRD forbids permanently
 * ("a click must never be a no-op"), which is why this is a seam and not a decision.
 */
export const onSessionClick = (session: Session): Promise<SessionClickResult> => {
  console.warn('focus engine not installed yet; ignoring click on', session.sessionId);

  return Promise.resolve({ ok: false, detail: 'focus_engine_missing' });
};
