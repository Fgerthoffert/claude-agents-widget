import { describe, expect, it } from 'vitest';

import { mapHookEventToState } from './mapHookEventToState';

describe('mapHookEventToState', () => {
  it('maps every registered event to its PRD state', () => {
    expect(mapHookEventToState('SessionStart')).toBe('done_idle');
    expect(mapHookEventToState('UserPromptSubmit')).toBe('working');
    expect(mapHookEventToState('Stop')).toBe('done_idle');
    expect(mapHookEventToState('Notification')).toBe('needs_input');
    expect(mapHookEventToState('SessionEnd')).toBe('ended');
  });

  it('does not call a session that has only just started `working`', () => {
    // A fresh, cleared, resumed or forked session sits at an empty prompt. Calling that
    // `working` is what made `/clear` look like it left work behind (ADR-0014).
    expect(mapHookEventToState('SessionStart')).not.toBe('working');
  });

  it('treats an idle notification as finished work, not as a question', () => {
    expect(mapHookEventToState('Notification', 'idle_prompt')).toBe('done_idle');
  });

  it('treats a real prompt as blocking', () => {
    expect(mapHookEventToState('Notification', 'permission_prompt')).toBe('needs_input');
    expect(mapHookEventToState('Notification', 'agent_needs_input')).toBe('needs_input');
  });

  it('assumes an unknown notification blocks, since missing a real prompt is the worse failure', () => {
    expect(mapHookEventToState('Notification', 'some_future_matcher')).toBe('needs_input');
    expect(mapHookEventToState('Notification', null)).toBe('needs_input');
  });

  it('ignores a notification type on events that are not notifications', () => {
    expect(mapHookEventToState('UserPromptSubmit', 'idle_prompt')).toBe('working');
    expect(mapHookEventToState('SessionEnd', 'idle_prompt')).toBe('ended');
  });

  it('does not read inherited properties for the notification type either', () => {
    expect(mapHookEventToState('Notification', 'toString')).toBe('needs_input');
    expect(mapHookEventToState('Notification', 'constructor')).toBe('needs_input');
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
