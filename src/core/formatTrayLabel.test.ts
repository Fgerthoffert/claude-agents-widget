import { describe, expect, it } from 'vitest';

import { formatTrayLabel } from './formatTrayLabel';

describe('formatTrayLabel', () => {
  it('marks the menu bar when a session needs input', () => {
    expect(formatTrayLabel({ working: 0, needsInput: 1, doneIdle: 0 })).toBe('●');
  });

  it('marks the menu bar when a session is done and unread', () => {
    expect(formatTrayLabel({ working: 0, needsInput: 0, doneIdle: 1 })).toBe('●');
  });

  it('carries no count, however many sessions are waiting', () => {
    expect(formatTrayLabel({ working: 2, needsInput: 4, doneIdle: 7 })).toBe('●');
  });

  it('stays empty while every session is working', () => {
    expect(formatTrayLabel({ working: 3, needsInput: 0, doneIdle: 0 })).toBe('');
  });

  it('stays empty when there are no sessions at all', () => {
    expect(formatTrayLabel({ working: 0, needsInput: 0, doneIdle: 0 })).toBe('');
  });
});
