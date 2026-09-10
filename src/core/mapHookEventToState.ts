import type { SessionState } from './types';

/**
 * `Notification` matchers that are *not* a question.
 *
 * `idle_prompt` is Claude Code observing that nothing has been typed for a while. Nothing is
 * blocked on an answer — the agent finished its turn and the user has not come back yet — so it
 * belongs with finished work, not with a permission prompt (ADR-0014).
 *
 * A Set, and an allow-list of the *idle* case rather than of the blocking ones: an unrecognised
 * future matcher is far more likely to be a real prompt than another idle nag, and a missed
 * blocking prompt is the one failure this widget exists to prevent.
 */
const IDLE_NOTIFICATIONS = new Set(['idle_prompt']);

// A Map, not an object literal: the event name comes from a JSON payload, and a plain-object
// lookup would happily resolve `toString` or `constructor` to an inherited value.
const eventStates = new Map<string, SessionState>([
  // A session that has just started — or just been cleared, resumed or forked — has been asked
  // to do nothing yet. `working` begins when a prompt is submitted (ADR-0014).
  ['SessionStart', 'done_idle'],
  ['UserPromptSubmit', 'working'],
  ['Stop', 'done_idle'],
  ['Notification', 'needs_input'],
  ['SessionEnd', 'ended'],
]);

/**
 * The PRD state model, keyed by hook event name. Mirrors the table in the hook script; kept
 * here too so the app can re-derive state from `lastEvent` without re-reading the hook.
 * Unregistered events return null, meaning "leave the state alone".
 *
 * `notificationType` only matters for `Notification`, where it decides whether the agent is
 * actually blocked or merely idle.
 */
export const mapHookEventToState = (
  hookEventName: string | null,
  notificationType: string | null = null,
): SessionState | null => {
  if (hookEventName === null) return null;
  if (
    hookEventName === 'Notification' &&
    notificationType !== null &&
    IDLE_NOTIFICATIONS.has(notificationType)
  ) {
    return 'done_idle';
  }
  return eventStates.get(hookEventName) ?? null;
};
