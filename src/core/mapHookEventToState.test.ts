import { describe, expect, it } from 'vitest';

import { mapHookEventToState } from './mapHookEventToState';

describe('mapHookEventToState', () => {
  it('maps every registered event to its PRD state', () => {
    expect(mapHookEventToState('SessionStart')).toBe('working');
    expect(mapHookEventToState('UserPromptSubmit')).toBe('working');
    expect(mapHookEventToState('Stop')).toBe('done_idle');
    expect(mapHookEventToState('Notification')).toBe('needs_input');
    expect(mapHookEventToState('SessionEnd')).toBe('ended');
  });

  it('returns null for events the widget does not register', () => {
    expect(mapHookEventToState('PreToolUse')).toBeNull();
    expect(mapHookEventToState('SubagentStop')).toBeNull();
    expect(mapHookEventToState('')).toBeNull();
    expect(mapHookEventToState(null)).toBeNull();
  });

  it('does not read inherited object properties', () => {
    expect(mapHookEventToState('toString')).toBeNull();
    expect(mapHookEventToState('constructor')).toBeNull();
  });
});
