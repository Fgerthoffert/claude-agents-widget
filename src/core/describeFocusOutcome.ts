import type { LastFocusOutcome } from './evaluateSetupState';

/**
 * Wording per failure reason, in the panel's voice: what happened, then what to do about it.
 * Short enough for one line at 320px, because a message that wraps to three lines pushes the
 * rows it is about off the screen.
 */
const FAILURES: Readonly<Record<string, string>> = {
  'permission-denied': 'macOS blocked that click. Grant Accessibility in Setup, then try again.',
  'window-not-found': 'That window is gone — the terminal was probably closed.',
  'no-host': 'No terminal window found for this session yet.',
  'unsupported-host': 'This terminal is not one the widget can raise yet.',
  timeout: 'Raising that window timed out. Try again.',
  'script-failed': 'Could not raise that window.',
  focus_engine_error: 'Could not raise that window.',
};

/**
 * What to tell the user after a click, or `null` when the click did exactly what it promised.
 *
 * The PRD's rule is that a click is never a no-op, and the focus engine already honours it by
 * always returning a typed result — but until now nothing rendered that result, so from the
 * user's side a failed click *was* a no-op. Silence is reserved for the case that needs no
 * explanation: the exact window came forward.
 *
 * A degraded success still says something. Landing on the app instead of the window is not what
 * the row promised, and the reason is nearly always a missing Accessibility grant — the one
 * thing the user can fix, and the one thing they will never think to look for if the click
 * quietly half-works every time.
 */
export const describeFocusOutcome = (outcome: LastFocusOutcome): string | null => {
  if (outcome.ok && !outcome.degraded) return null;

  if (outcome.ok) {
    return outcome.permissionDenied
      ? 'Raised the app, not the window — grant Accessibility in Setup for an exact match.'
      : 'Raised the app; the exact window could not be found.';
  }

  return FAILURES[outcome.detail] ?? 'Could not raise that window.';
};
