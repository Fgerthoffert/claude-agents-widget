import type { SessionState } from './types';

// A Map, not an object literal: the event name comes from a JSON payload, and a plain-object
// lookup would happily resolve `toString` or `constructor` to an inherited value.
const eventStates = new Map<string, SessionState>([
  ['SessionStart', 'working'],
  ['UserPromptSubmit', 'working'],
  ['Stop', 'done_idle'],
  ['Notification', 'needs_input'],
  ['SessionEnd', 'ended'],
]);

/**
 * The PRD state model, keyed by hook event name. Mirrors the table in the hook script; kept
 * here too so the app can re-derive state from `lastEvent` without re-reading the hook.
 * Unregistered events return null, meaning "leave the state alone".
 */
export const mapHookEventToState = (hookEventName: string | null): SessionState | null =>
  hookEventName === null ? null : (eventStates.get(hookEventName) ?? null);
